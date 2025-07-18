// backend/api/pessoas.js

import { applyCors } from "../lib/cors.js";
import { validarRequisicaoSessao } from "../lib/secureRequest.js";
import { getNgrokUrl } from "../lib/getNgrokUrl.js";

export default async function handler(req, res) {
  // ✅ INÍCIO DA CORREÇÃO DE CORS
  if (req.method === "OPTIONS") {
    applyCors(res, req);
    return;
  }
  // 1. Aplica as regras de CORS
  if (applyCors(res, req)) return;

  // 2. Valida o token JWT do usuário para garantir a autenticação
  const validacao = await validarRequisicaoSessao(req);
  if (!validacao.autorizado) {
    return res.status(401).json({ erro: "Não autorizado" });
  }

  // 3. Extrai o ID do usuário validado
  const { usuario_id } = validacao;

  try {
    // 4. Obtém a URL do serviço principal (whatsapp-core)
    const ngrokUrl = await getNgrokUrl();
    if (!ngrokUrl) {
      return res.status(503).json({ erro: "Serviço de conexão indisponível." });
    }

    // 5. Repassa a requisição para a NOVA ROTA /api/pessoas no whatsapp-core
    const resposta = await fetch(
      `${ngrokUrl}/api/pessoas?usuario_id=${usuario_id}`
    );

    if (!resposta.ok) {
      return res.status(resposta.status).json({
        erro: "Falha ao buscar a lista de pessoas no serviço principal.",
      });
    }

    const dados = await resposta.json();
    return res.status(200).json(dados);
  } catch (error) {
    console.error("Erro no proxy de pessoas:", error);
    return res.status(500).json({ erro: "Erro interno no servidor." });
  }
}
