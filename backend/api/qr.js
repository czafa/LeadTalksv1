import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    const resposta = await fetch("http://IP_DA_VM:3000/api/qr");
    const qrData = await resposta.json();
    return res.status(200).json(qrData);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro ao buscar QR code" });
  }
}
