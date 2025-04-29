import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { numero, mensagem } = req.body;
  const API_WHATSAPP_CORE_URL = process.env.API_WHATSAPP_CORE_URL;

  try {
    const resposta = await fetch(`${API_WHATSAPP_CORE_URL}/enviar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numero, mensagem }),
    });

    const resultado = await resposta.json();
    return res.status(200).json({ status: "enviado", retorno: resultado });
  } catch (e) {
    console.error("Erro no envio:", e);
    return res.status(500).json({ error: "Falha ao enviar mensagem" });
  }
}
