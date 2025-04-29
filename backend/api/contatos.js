import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { data, error } = await supabase
    .from("contatos")
    .select("id, nome, numero");

  if (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro ao buscar contatos" });
  }

  return res.status(200).json(data);
}
