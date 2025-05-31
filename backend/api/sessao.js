// backend/api/sessao.js
import { applyCors } from "../lib/cors.js";
import { supabase } from "../lib/supabase.js";
import { validarRequisicaoSessao } from "../lib/secureRequest.js";
export default async function handler(req, res) {
  console.log("Origin recebida:", req.headers.origin);
  console.log("Ambiente:", process.env.NODE_ENV);

  if (applyCors(res, req)) return;

  try {
    const validacao = await validarRequisicaoSessao(req);

    if (!validacao.autorizado) {
      return res.status(validacao.status).json({ erro: validacao.erro });
    }

    const { usuario_id, viaToken } = validacao;

    if (req.method === "POST") {
      const ativo = req.body?.ativo ?? true;

      const { error } = await supabase.from("sessao").upsert(
        {
          usuario_id,
          ativo,
          atualizado_em: new Date(),
        },
        { onConflict: ["usuario_id"] }
      );

      if (error) {
        console.error("Erro ao atualizar sessão:", error);
        return res.status(500).json({ erro: "Erro ao atualizar sessão" });
      }

      return res.status(200).json({ atualizado: true });
    }

    return res.status(405).json({ erro: "Método não permitido" });
  } catch (err) {
    console.error("Erro em /api/sessao:", err);
    return res.status(500).json({ erro: "Erro interno no servidor" });
  }
}
