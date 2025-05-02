// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { startLeadTalk, latestQr } from "./leadtalks.js";
import { supabase } from "./supabase.js";

dotenv.config();
const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

let socketInstancia = null;

// Inicia o processo do WhatsApp ao iniciar o servidor
(async () => {
  socketInstancia = await startLeadTalk();
})();

// Endpoint para retornar o último QR code salvo no Supabase
app.get("/api/qr", async (req, res) => {
  const { data, error } = await supabase
    .from("qr")
    .select("qr")
    .order("criado_em", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: "QR code não encontrado" });
  }

  res.status(200).json({ qr: data.qr });
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

app.listen(3000, () => {
  console.log("Servidor local do WhatsApp rodando na porta 3000.");
});
