import { createClient } from "@supabase/supabase-js";
import { applyCors } from "../lib/cors.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: user } = await supabase.auth.getUser(token);

export default async function handler(req, res) {
  if (applyCors(res, req)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { data, error } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "ngrok_url")
      .single();

    if (error || !data?.valor) {
      throw new Error("URL do ngrok não encontrada no Supabase");
    }

    // Extrai o usuário logado via token
    const { data: userData, error: userError } = await supabase.auth.getUser(
      token
    );
    if (userError || !userData?.user?.id) {
      throw new Error("Usuário inválido.");
    }

    const usuario_id = userData.user.id;

    const response = await fetch(data.valor + "/start", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ usuario_id }),
    });

    const result = await response.json();
    return res.status(200).json(result);
  } catch (error) {
    console.error("Erro no handler iniciar-leadtalk:", error);
    return res.status(500).json({ error: "Erro interno" });
  }
}
