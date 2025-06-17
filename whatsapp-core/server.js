//GitHub/LeadTalksv1/whatsapp-core/server.js

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { setQrCode, getQrCode } from "./qrStore.js";
import { startLeadTalk } from "./leadtalks.js";
import { supabase } from "./supabase.js";

dotenv.config();

const app = express();
let socketInstancia = null;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

console.log("🔧 Iniciando server.js...");

// === QR ===
app.get("/api/qr", async (req, res) => {
  const { usuario_id } = req.query;
  if (!usuario_id)
    return res.status(400).json({ error: "usuario_id é obrigatório" });

  try {
    const { data, error } = await supabase
      .from("qr")
      .select("qr")
      .eq("usuario_id", usuario_id)
      .order("criado_em", { ascending: false })
      .limit(1)
      .single();

    if (error || !data?.qr)
      return res.status(404).json({ error: "QR não encontrado" });
    return res.status(200).json({ qr: data.qr });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao buscar QR" });
  }
});

// === Enviar mensagem ===
app.post("/api/enviar", async (req, res) => {
  const { numero, mensagem } = req.body;

  if (!socketInstancia)
    return res.status(500).json({ error: "WhatsApp ainda não conectado" });

  try {
    const jid = `${numero.replace(/[^\d]/g, "")}@s.whatsapp.net`;
    await socketInstancia.sendMessage(jid, { text: mensagem });
    return res.status(200).json({ status: "Mensagem enviada" });
  } catch (err) {
    return res.status(500).json({ error: "Falha no envio" });
  }
});

// === Iniciar sessão ===
app.post("/start", async (req, res) => {
  const { usuario_id } = req.body;
  if (!usuario_id)
    return res.status(400).json({ error: "usuario_id é obrigatório" });

  if (socketInstancia) {
    console.log(`[LeadTalk] ⚠️ Sessão já ativa para ${usuario_id}`);
    return res.status(200).json({ status: "Sessão já ativa" });
  }

  try {
    const { data: usuario, error } = await supabase.auth.admin.getUserById(
      usuario_id
    );
    if (error || !usuario)
      return res.status(404).json({ error: "Usuário não encontrado" });

    const { data: sessao } = await supabase
      .from("sessao")
      .select("logado", "conectado")
      .eq("usuario_id", usuario_id)
      .single();

    if (!sessao?.logado) {
      return res.status(403).json({ error: "Usuário não está logado" });
    }

    if (sessao?.conectado === true) {
      return res.status(200).json({ status: "Sessão já conectada" });
    }

    socketInstancia = await startLeadTalk({
      usuario_id,
      onQr: (qr) => {
        console.log("[LeadTalk] 📸 QR recebido.");
        setQrCode(qr);
      },
    });

    await supabase
      .from("sessao")
      .update({
        conectado: true,
        atualizado_em: new Date().toISOString(),
      })
      .eq("usuario_id", usuario_id);

    return res.status(200).json({ status: "Sessão iniciada com sucesso" });
  } catch (err) {
    console.error("Erro ao iniciar sessão:", err);
    return res.status(500).json({ error: "Falha ao iniciar sessão" });
  }
});

// === Reconectar sessão ===
async function reconectarSessao() {
  try {
    const { data, error } = await supabase
      .from("sessao")
      .select("usuario_id")
      .eq("logado", true)
      .eq("conectado", false);

    if (error || !data?.length) return;

    const usuario_id = data[0].usuario_id;
    console.log(`[LeadTalk] 🔁 Reconectando sessão para ${usuario_id}...`);

    socketInstancia = await startLeadTalk({
      usuario_id,
      onQr: (qr) => {
        console.log("[LeadTalk] 🔄 QR gerado na reativação.");
        setQrCode(qr);
      },
    });

    await supabase
      .from("sessao")
      .update({
        conectado: true,
        atualizado_em: new Date().toISOString(),
      })
      .eq("usuario_id", usuario_id);
  } catch (err) {
    console.error("[LeadTalk] ⚠️ Erro ao reconectar sessão:", err.message);
  }
}

app.listen(3001, () => {
  console.log("Servidor local do WhatsApp rodando na porta 3001.");
  reconectarSessao();
});

export function getSocketInstance() {
  return socketInstancia;
}

import "./filaProcessor.js";
