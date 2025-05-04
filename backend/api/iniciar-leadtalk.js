// backend/api/iniciar-leadtalk.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // 🔍 Recupera a URL atual do ngrok salva na tabela 'configuracoes'
    const { data, error } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "ngrok_url")
      .single();

    if (error || !data?.valor) {
      throw new Error("URL do ngrok não encontrada no Supabase");
    }

    const ngrokUrl = data.valor;

    const response = await fetch(ngrokUrl + "/start", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await response.json();
    return res.status(200).json(result);
  } catch (error) {
    console.error("Erro no handler iniciar-leadtalk:", error);
    return res.status(500).json({ error: "Erro interno" });
  }
}
