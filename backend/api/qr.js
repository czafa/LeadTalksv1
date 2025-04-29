import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    const API_WHATSAPP_CORE_URL = process.env.API_WHATSAPP_CORE_URL;

    const resposta = await fetch(`${API_WHATSAPP_CORE_URL}/qr`);

    const qrData = await resposta.json();
    return res.status(200).json(qrData);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro ao buscar QR code" });
  }
}
