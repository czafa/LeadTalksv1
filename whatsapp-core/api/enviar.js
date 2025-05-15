// whatsapp-core/api/enviar.js
import express from "express";
import { startLeadTalk } from "../leadtalks.js";
import { enviarMensagensEmLote } from "../sender.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.post("/api/enviar", async (req, res) => {
  const {
    usuario_id,
    contatos,
    mensagem,
    intervaloMin = 5,
    intervaloMax = 10,
  } = req.body;

  if (
    !usuario_id ||
    !Array.isArray(contatos) ||
    contatos.length === 0 ||
    !mensagem
  ) {
    return res
      .status(400)
      .json({ error: "Parâmetros obrigatórios ausentes ou inválidos." });
  }

  try {
    const sock = await startLeadTalk({ usuario_id });

    await new Promise((resolve, reject) => {
      const handler = ({ connection }) => {
        if (connection === "open") {
          sock.ev.off("connection.update", handler);
          resolve();
        }
        if (connection === "close") {
          sock.ev.off("connection.update", handler);
          reject(new Error("Conexão encerrada antes de abrir."));
        }
      };
      sock.ev.on("connection.update", handler);
    });

    await enviarMensagensEmLote(
      sock,
      contatos,
      mensagem,
      intervaloMin,
      intervaloMax
    );
    res.status(200).json({ status: "Mensagens enviadas com sucesso." });
  } catch (error) {
    console.error("[LeadTalk] Erro ao enviar mensagem:", error);
    res.status(500).json({ error: "Erro ao enviar mensagem." });
  }
});

app.listen(PORT, () => {
  console.log(`[LeadTalk] API de envio ativa na porta ${PORT}`);
});
