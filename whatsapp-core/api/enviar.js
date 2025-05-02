// whatsapp-core/api/enviar.js
import express from "express";
import { enviarMensagens } from "../sender.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.post("/api/enviar", async (req, res) => {
  try {
    console.log("[LeadTalk] Requisição recebida para envio de mensagens.");
    await enviarMensagens();
    res.status(200).json({ status: "Mensagens enviadas com sucesso." });
  } catch (error) {
    console.error("[LeadTalk] Erro ao enviar mensagens:", error);
    res.status(500).json({ error: "Erro ao enviar mensagens." });
  }
});

app.listen(PORT, () => {
  console.log(`[LeadTalk] API de envio ativa na porta ${PORT}`);
});
