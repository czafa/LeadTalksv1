// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { startLeadTalk } from "./leadtalks.js";
import { supabase } from "./supabase.js";

dotenv.config();
const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

let socketInstancia = null;
let ultimoQrCode = null;

console.log("🔧 Iniciando server.js...");

// Inicia o processo do WhatsApp ao iniciar o servidor
(async () => {
  socketInstancia = await startLeadTalk({
    onQr: (qr) => {
      ultimoQrCode = qr; // Armazena o QR quando for gerado
    },
  });
})();

// Endpoint para retornar o último QR code diretamente da memória
app.get("/api/qr", async (req, res) => {
  if (ultimoQrCode) {
    return res.status(200).json({ qr: ultimoQrCode });
  } else {
    return res.status(404).json({ error: "QR code ainda não gerado" });
  }
});

// Endpoint para envio direto de mensagem via WhatsApp já autenticado
app.post("/api/enviar", async (req, res) => {
  const { numero, mensagem } = req.body;

  if (!socketInstancia) {
    return res.status(500).json({ error: "WhatsApp ainda não conectado" });
  }

  try {
    const jid = `${numero.replace(/[^\d]/g, "")}@s.whatsapp.net`;
    await socketInstancia.sendMessage(jid, { text: mensagem });
    console.log(`[LeadTalk] ✅ Mensagem enviada para ${numero}`);
    return res.status(200).json({ status: "Mensagem enviada" });
  } catch (err) {
    console.error(`[LeadTalk] ❌ Erro ao enviar mensagem:`, err.message);
    return res.status(500).json({ error: "Falha no envio" });
  }
});

app.listen(3001, () => {
  console.log("Servidor local do WhatsApp rodando na porta 3001.");
});
