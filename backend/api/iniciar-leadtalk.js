import { createClient } from "@supabase/supabase-js";
import { applyCors } from "../lib/cors.js";
import fs from "fs";
import path from "path";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (applyCors(res, req)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;

  if (!token) {
    return res.status(401).json({ error: "Token de autenticação ausente" });
  }

  try {
    const { data: configData, error: configError } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "ngrok_url")
      .single();

    if (configError || !configData?.valor) {
      throw new Error("URL do ngrok não encontrada no Supabase");
    }

    const ngrokUrl = configData.valor;

    const { data: userData, error: userError } = await supabase.auth.getUser(
      token
    );

    if (userError || !userData?.user?.id) {
      return res.status(401).json({ error: "Usuário não autorizado" });
    }

    const usuario_id = userData.user.id;

    // 📁 Verifica se a pasta do usuário existe localmente
    const pastaUsuario = path.join("./auth", usuario_id);
    const pastaExiste = fs.existsSync(pastaUsuario);

    if (!pastaExiste) {
      console.warn(
        `[LeadTalk] ⚠️ Pasta local auth/${usuario_id} não existe. Marcando sessão como inativa.`
      );

      // Atualiza a sessão para inativa no Supabase
      await supabase
        .from("sessao")
        .upsert(
          { usuario_id, ativo: false, atualizado_em: new Date() },
          { onConflict: ["usuario_id"] }
        );

      return res.status(202).json({
        mensagem: "Sessão marcada como inativa pois pasta local não existe",
        ativo: false,
      });
    }

    // ▶️ Se pasta existe, aciona o backend local via ngrok normalmente
    const response = await fetch(`${ngrokUrl}/start`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ usuario_id }),
    });

    let result;
    try {
      result = await response.json();
    } catch (jsonError) {
      console.error(
        "❌ Erro ao interpretar resposta do backend local:",
        jsonError
      );
      return res
        .status(502)
        .json({ error: "Erro ao interpretar resposta do servidor local" });
    }

    return res.status(response.status).json(result);
  } catch (error) {
    console.error("❌ Erro interno no handler iniciar-leadtalk:", error);
    return res.status(500).json({ error: "Erro interno no servidor" });
  }
}
