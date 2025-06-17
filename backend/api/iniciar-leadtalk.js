// backend/api/iniciar-leadtalk.js
import { applyCors } from "../lib/cors.js";
import { supabase } from "../lib/supabase.js";
import { validarRequisicaoSessao } from "../lib/secureRequest.js";

export default async function handler(req, res) {
  if (applyCors(res, req)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido" });
  }

  const validacao = await validarRequisicaoSessao(req);
  if (!validacao.autorizado) {
    return res
      .status(validacao.status)
      .json({ erro: validacao.erro || "Não autorizado" });
  }

  const { usuario_id } = validacao;

  console.log("[LeadTalk] ✅ Validação autorizada para:", usuario_id);

  const { error } = await supabase.from("sessao").upsert(
    {
      usuario_id,
      logado: true, // ✅ marca como logado
      conectado: false, // ❌ ainda não está conectado ao WhatsApp
      atualizado_em: new Date(),
    },
    { onConflict: ["usuario_id"] }
  );

  if (error) {
    console.error("Erro ao ativar sessão:", error);
    return res.status(500).json({ erro: "Erro ao ativar sessão" });
  }

  return res.status(200).json({ status: "sessão logada aguardando conexão" });
}
