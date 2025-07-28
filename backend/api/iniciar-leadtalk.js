// backend/api/iniciar-leadtalk.js

// 1. A importação foi trocada para a nova função
import { configurarCors } from "./_lib/cors.js";
import { supabase } from "./_lib/supabase.js";
import { validarRequisicaoSessao } from "./_lib/secureRequest.js";
import { getNgrokUrl } from "./_lib/getNgrokUrl.js";

export default async function handler(req, res) {
  // 2. Bloco de CORS antigo foi substituído por esta única linha
  if (configurarCors(req, res)) {
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido" });
  }

  // 3. Validação da sessão do usuário
  const validacao = await validarRequisicaoSessao(req);
  if (!validacao.autorizado) {
    return res
      .status(validacao.status || 401)
      .json({ erro: validacao.erro || "Não autorizado" });
  }

  const { usuario_id } = validacao;
  if (!usuario_id) {
    return res
      .status(400)
      .json({ erro: "ID do usuário ausente após validação" });
  }

  console.log("[LeadTalk] ✅ Validação de sessão autorizada para:", usuario_id);

  try {
    // 4. Garante que a sessão esteja marcada como 'logado' no banco
    const { error: upsertError } = await supabase.from("sessao").upsert(
      {
        usuario_id,
        logado: true,
        conectado: false, // Define como 'false' até que o Baileys confirme a conexão
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: ["usuario_id"] }
    );

    if (upsertError) {
      console.error(
        "[LeadTalk] ❌ Erro ao ativar sessão no Supabase:",
        upsertError
      );
      return res
        .status(500)
        .json({ erro: "Erro ao registrar estado da sessão." });
    }

    // 5. Aciona o backend local (whatsapp-core) para iniciar a conexão
    const ngrokUrl = await getNgrokUrl();
    if (!ngrokUrl) {
      console.error(
        "[LeadTalk] ❌ URL do backend local (ngrok) não foi encontrada no banco."
      );
      return res.status(503).json({
        erro: "Serviço de conexão temporariamente indisponível. (URL não configurada)",
      });
    }

    try {
      const resposta = await fetch(`${ngrokUrl}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario_id }),
      });

      if (!resposta.ok) {
        const corpoErro = await resposta.text();
        console.warn(
          `[LeadTalk] ⚠️ Backend local respondeu com erro. Status: ${resposta.status}, Corpo: ${corpoErro}`
        );
        return res.status(502).json({
          erro: "Falha ao comunicar com o serviço de conexão. Tente novamente mais tarde.",
        });
      }
    } catch (fetchError) {
      console.error(
        "[LeadTalk] ❌ Erro de rede ao contatar o backend local:",
        fetchError.message
      );
      return res.status(504).json({
        erro: "O serviço de conexão parece estar offline. Verifique o servidor local.",
      });
    }

    // Retorna para o frontend
    return res.status(200).json({
      status: "Requisição para iniciar a conexão enviada com sucesso.",
    });
  } catch (err) {
    console.error("[LeadTalk] ❌ Erro inesperado no handler:", err);
    return res.status(500).json({ erro: "Erro interno no servidor." });
  }
}
