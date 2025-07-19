// backend/api/grupos.js

import { configurarCors } from "../lib/cors.js";
import { validarRequisicaoSessao } from "../lib/secureRequest.js";
import { getNgrokUrl } from "../lib/getNgrokUrl.js";

export default async function handler(req, res) {
  if (configurarCors(req, res)) {
    return;
  }

  const validacao = await validarRequisicaoSessao(req);
  if (!validacao.autorizado) {
    return res.status(401).json({ erro: "Não autorizado" });
  }
  const { usuario_id } = validacao;
  try {
    const ngrokUrl = await getNgrokUrl();
    if (!ngrokUrl) {
      return res.status(503).json({ erro: "Serviço de conexão indisponível." });
    }

    const resposta = await fetch(
      `${ngrokUrl}/api/grupos?usuario_id=${usuario_id}`,
      { headers: { "ngrok-skip-browser-warning": "true" } } // Adicionado header do Ngrok
    );

    if (!resposta.ok) {
      return res
        .status(resposta.status)
        .json({ erro: "Falha ao buscar grupos no serviço principal." });
    }

    const dados = await resposta.json();
    return res.status(200).json(dados);
  } catch (error) {
    console.error("Erro no proxy de grupos:", error);
    return res.status(500).json({ erro: "Erro interno no servidor." });
  }
}
