import { supabase } from "../lib/supabase.js";

export default async function handler(req, res) {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: "Faltando user_id" });
  }

  const { data, error } = await supabase
    .from("sessao")
    .select("ativo")
    .eq("usuario_id", user_id)
    .single();

  if (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro ao buscar status da sessão" });
  }

  return res.status(200).json(data);
}
