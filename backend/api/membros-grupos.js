import { applyCors } from "../lib/cors.js";
import { supabase } from "../lib/supabase.js";

export default async function handler(req, res) {
  if (applyCors(res, req)) return; // Handle CORS preflight

  const { data, error } = await supabase
    .from("membros_grupos")
    .select("grupo_nome, membro_nome, membro_numero");

  if (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro ao buscar membros dos grupos" });
  }

  // Estruturar agrupado por grupo
  const agrupado = {};
  data.forEach((membro) => {
    if (!agrupado[membro.grupo_nome]) agrupado[membro.grupo_nome] = [];
    agrupado[membro.grupo_nome].push({
      nome: membro.membro_nome,
      numero: membro.membro_numero,
    });
  });

  return res.status(200).json({ grupos: agrupado });
}
