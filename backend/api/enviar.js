// api/enviar.js
import { supabase } from "../lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { numero, mensagem } = req.body;

  // Busca a URL do ngrok dinamicamente da tabela 'configuracoes'
  const { data, error } = await supabase
    .from("configuracoes")
    .select("valor")
    .eq("chave", "ngrok_url")
    .single();

  if (error || !data?.valor) {
    return res
      .status(500)
      .json({ error: "URL do whatsapp-core não encontrada" });
  }

  const apiUrl = `${data.valor}/api/enviar`;

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numero, mensagem }),
    });

    const resultado = await response.json();
    return res.status(response.status).json(resultado);
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Erro ao se comunicar com whatsapp-core" });
  }
}
