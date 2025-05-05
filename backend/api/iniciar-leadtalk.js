import { createClient } from "@supabase/supabase-js";
import { applyCors } from "../lib/cors.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Aplica CORS e trata requisições OPTIONS
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
    // Recupera a URL pública do ngrok armazenada no Supabase
    const { data: configData, error: configError } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "ngrok_url")
      .single();

    if (configError || !configData?.valor) {
      throw new Error("URL do ngrok não encontrada no Supabase");
    }

    const ngrokUrl = configData.valor;

    // Valida o token e extrai o usuário logado
    const { data: userData, error: userError } = await supabase.auth.getUser(
      token
    );

    if (userError || !userData?.user?.id) {
      return res.status(401).json({ error: "Usuário não autorizado" });
    }

    const usuario_id = userData.user.id;

    // Faz a chamada para o backend local via ngrok
    const response = await fetch(`${ngrokUrl}/start`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ usuario_id }),
    });

    // Tenta interpretar a resposta JSON do servidor local
    let result;
    try {
      result = await response.json();
    } catch (jsonError) {
      console.error(
        "❌ Falha ao interpretar resposta do backend local:",
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
