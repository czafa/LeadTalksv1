import { supabase } from "../lib/supabase.js";

export default async function handler(req, res) {
  const { data, error } = await supabase
    .from("grupos")
    .select("id, nome, tamanho");

  if (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro ao buscar grupos" });
  }

  return res.status(200).json(data);
}
