// backend/api/iniciar-leadtalk.js
import { supabase } from "../lib/supabase.js";
import { criarSocket } from "../core/socketManager.js";
import { validarRequisicaoSessao } from "../lib/secureRequest.js";

export default async function handler(req, res) {
  try {
    const validacao = await validarRequisicaoSessao(req);
    if (!validacao.autorizado) {
      return res.status(validacao.status).json({ erro: validacao.erro });
    }

    const { usuario_id } = validacao;

    // ✅ Atualiza a sessão como ativa ANTES de criar o socket
    const { error } = await supabase.from("sessao").upsert(
      {
        usuario_id,
        ativo: true,
        atualizado_em: new Date(),
      },
      { onConflict: ["usuario_id"] }
    );

    if (error) {
      console.error("[LeadTalk] ❌ Erro ao ativar sessão:", error);
      return res.status(500).json({ erro: "Erro ao ativar sessão" });
    }

    // ✅ Inicia o socket
    await criarSocket(usuario_id);
    return res.status(200).json({ iniciado: true });
  } catch (err) {
    console.error("[LeadTalk] ❌ Erro em iniciar-leadtalk:", err);
    return res.status(500).json({ erro: "Erro interno" });
  }
}
