// backend/api/pessoas.js

// 1. A importação foi trocada para a nova função
import { configurarCors } from "./_lib/cors.js";
import { validarRequisicaoSessao } from "./_lib/secureRequest.js";
import { getNgrokUrl } from "./_lib/getNgrokUrl.js";

export default async function handler(req, res) {
  console.log("Authorization header:", req.headers.authorization);
  // 2. Bloco de CORS antigo foi substituído por esta única linha
  if (configurarCors(req, res)) {
    return;
  }

  // 3. Valida o token JWT do usuário para garantir a autenticação
  const validacao = await validarRequisicaoSessao(req);
  if (!validacao.autorizado) {
    return res.status(401).json({ erro: "Não autorizado" });
  }

  // 4. Extrai o ID do usuário validado
  const { usuario_id } = validacao;

  try {
    const ngrokUrl = await getNgrokUrl();
    if (!ngrokUrl) {
      /* ... */
    }

    // Repassa a requisição para a NOVA ROTA /api/pessoas no whatsapp-core
    const resposta = await fetch(
      `${ngrokUrl}/api/pessoas?usuario_id=${usuario_id}`,
      {
        headers: {
          "ngrok-skip-browser-warning": "true",
        },
      }
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
