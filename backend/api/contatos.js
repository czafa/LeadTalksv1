// GitHub/LeadTalksv1/backend/api/contatos.js

import { applyCors } from "../lib/cors.js";
import { validarRequisicaoSessao } from "../lib/secureRequest.js"; // Assumindo que você tem um validador
import { getNgrokUrl } from "../lib/getNgrokUrl.js";

export default async function handler(req, res) {
  // ✅ PASSO 1: Aplica as regras de CORS. Essencial para o navegador não bloquear a requisição.
  if (applyCors(res, req)) return;

  // ✅ PASSO 2: Valida o token JWT do usuário para garantir que ele está autenticado.
  const validacao = await validarRequisicaoSessao(req);
  if (!validacao.autorizado) {
    return res.status(401).json({ erro: "Não autorizado" });
  }

  // ✅ PASSO 3: Extrai o ID do usuário validado. Agora a variável 'usuario_id' existe.
  const { usuario_id } = validacao;

  try {
    // PASSO 4: Obtém a URL do serviço principal (whatsapp-core)
    const ngrokUrl = await getNgrokUrl();
    if (!ngrokUrl) {
      return res.status(503).json({ erro: "Serviço de conexão indisponível." });
    }

    // PASSO 5: Repassa a requisição para o whatsapp-core, incluindo o usuario_id
    const resposta = await fetch(
      `${ngrokUrl}/api/contatos?usuario_id=${usuario_id}`
    );

    if (!resposta.ok) {
      // Se o whatsapp-core der erro, repassa o erro para o frontend
      return res
        .status(resposta.status)
        .json({ erro: "Falha ao buscar contatos no serviço principal." });
    }

    const dados = await resposta.json();
    return res.status(200).json(dados);
  } catch (error) {
    console.error("Erro no proxy de contatos:", error);
    return res.status(500).json({ erro: "Erro interno no servidor." });
  }
}
