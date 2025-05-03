// api/qr.js
import { applyCors } from "../lib/cors.js";
import fetch from "node-fetch";
import { supabase } from "../lib/supabase.js";

export default async function handler(req, res) {
  if (applyCors(res, req)) return; // Handle CORS preflight

  try {
    // Busca a URL dinâmica do whatsapp-core via Supabase
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

    const apiUrl = `${data.valor}/api/qr`;
    const resposta = await fetch(apiUrl);
    const qrData = await resposta.json();

    return res.status(200).json(qrData);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro ao buscar QR code" });
  }
}
