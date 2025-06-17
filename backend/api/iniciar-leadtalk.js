// backend/api/iniciar-leadtalk.js
import { applyCors } from "../lib/cors.js";
import { supabase } from "../lib/supabase.js";
import { validarRequisicaoSessao } from "../lib/secureRequest.js";
import { getNgrokUrl } from "../lib/getNgrokUrl.js";

export default async function handler(req, res) {
  if (applyCors(res, req)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido" });
  }

  const validacao = await validarRequisicaoSessao(req);

  if (!validacao.autorizado) {
    return res
      .status(validacao.status || 401)
      .json({ erro: validacao.erro || "Não autorizado" });
  }

  const { usuario_id } = validacao;

  if (!usuario_id) {
    return res.status(400).json({ erro: "usuario_id ausente após validação" });
  }

  console.log("[LeadTalk] ✅ Validação autorizada para:", usuario_id);

  try {
    const { error } = await supabase.from("sessao").upsert(
      {
        usuario_id,
        logado: true,
        conectado: false,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: ["usuario_id"] }
    );

    if (error) {
      console.error("[LeadTalk] ❌ Erro ao ativar sessão:", error);
      return res.status(500).json({ erro: "Erro ao ativar sessão" });
    }

    // 🚀 Aciona o backend local para iniciar o socket
    const ngrokUrl = await getNgrokUrl();
    const resposta = await fetch(`${ngrokUrl}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario_id }),
    });

    if (!resposta.ok) {
      console.warn(
        `[LeadTalk] ⚠️ Backend local respondeu erro ao iniciar sessão. Status: ${resposta.status}`
      );
      // Ainda retornamos sucesso para não quebrar o frontend
    }

    return res
      .status(200)
      .json({ status: "sessão logada e conexão em andamento" });
  } catch (err) {
    console.error("[LeadTalk] ❌ Erro inesperado:", err);
    return res.status(500).json({ erro: "Erro interno no servidor" });
  }
}
