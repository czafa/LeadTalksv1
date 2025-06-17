// backend/api/socket-url.js
import { supabase } from "../lib/supabase.js";
import { applyCors } from "../lib/cors.js";

export default async function handler(req, res) {
  if (applyCors(res, req)) return;

  const { data, error } = await supabase
    .from("configuracoes")
    .select("valor")
    .eq("chave", "ngrok_url")
    .single();

  if (error || !data?.valor) {
    return res.status(500).json({ error: "Erro ao buscar socket URL" });
  }

  return res.status(200).json({ socketUrl: data.valor });
}
