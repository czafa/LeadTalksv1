// whatsapp-core/api/enviar.js
import express from "express";
import { getSocketInstance } from "../server.js";
import { enviarMensagens } from "../sender.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.post("/api/enviar", async (req, res) => {
  const { contatos, mensagem, intervaloSegundos = 5 } = req.body;

  const sock = getSocketInstance();
  if (!sock) {
    return res.status(500).json({ error: "Sessão do WhatsApp não conectada." });
  }

  try {
    await enviarMensagens(sock, contatos, mensagem, intervaloSegundos);
    res.status(200).json({ status: "Mensagens enviadas com sucesso." });
  } catch (err) {
    console.error("[LeadTalk] ❌ Erro no envio:", err.message);
    res.status(500).json({ error: "Falha no envio de mensagens." });
  }
});

app.listen(PORT, () => {
  console.log(`[LeadTalk] API de envio ativa na porta ${PORT}`);
});
