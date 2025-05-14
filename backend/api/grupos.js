import { applyCors } from "../lib/cors.js";
import { supabase } from "../lib/supabase.js";

export default async function handler(req, res) {
  if (applyCors(res, req)) return;

  const { usuario_id } = req.query;

  if (!usuario_id)
    return res.status(400).json({ error: "usuario_id é obrigatório" });

  const { data, error } = await supabase
    .from("grupos")
    .select("grupo_jid, nome, tamanho")
    .eq("usuario_id", usuario_id)
    .order("nome", { ascending: true });

  if (error) {
    console.error("Erro Supabase grupos:", error);
    return res.status(500).json({ error: "Erro ao buscar grupos" });
  }

  return res.status(200).json(data);
}
