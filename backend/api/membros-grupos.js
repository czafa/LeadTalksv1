import { applyCors } from "../lib/cors.js";
import { supabase } from "../lib/supabase.js";

export default async function handler(req, res) {
  if (applyCors(res, req)) return;

  const { usuario_id } = req.query;

  if (!usuario_id)
    return res.status(400).json({ error: "usuario_id é obrigatório" });

  const { data, error } = await supabase
    .from("membros_grupos")
    .select("grupo_jid, membro_nome, membro_numero")
    .eq("usuario_id", usuario_id);

  if (error) {
    console.error("Erro Supabase membros_grupos:", error);
    return res.status(500).json({ error: "Erro ao buscar membros dos grupos" });
  }

  // Agrupar por grupo_jid
  const agrupado = {};
  data.forEach((membro) => {
    if (!agrupado[membro.grupo_jid]) agrupado[membro.grupo_jid] = [];
    agrupado[membro.grupo_jid].push({
      nome: membro.membro_nome,
      numero: membro.membro_numero,
    });
  });

  return res.status(200).json({ grupos: agrupado });
}
