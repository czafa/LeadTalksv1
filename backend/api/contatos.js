import { applyCors } from "../lib/cors.js";
import { supabase } from "../lib/supabase.js";

export default async function handler(req, res) {
  if (applyCors(res, req)) return; // Handle CORS preflight

  const { data, error } = await supabase
    .from("contatos")
    .select("id, nome, numero");

  if (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro ao buscar contatos" });
  }

  return res.status(200).json(data);
}
