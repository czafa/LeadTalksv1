// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { setQrCode, getQrCode } from "./qrStore.js";
import { startLeadTalk } from "./leadtalks.js";
import { supabase } from "./supabase.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());

let socketInstancia = null;

console.log("🔧 Iniciando server.js...");

// Endpoint para retornar o último QR code diretamente da memória
app.get("/api/qr", async (req, res) => {
  const { usuario_id } = req.query;

  if (!usuario_id) {
    return res.status(400).json({ error: "usuario_id é obrigatório" });
  }

  try {
    const { data, error } = await supabase
      .from("qr")
      .select("qr")
      .eq("usuario_id", usuario_id)
      .order("criado_em", { ascending: false })
      .limit(1)
      .single();

    if (error || !data?.qr) {
      console.warn(
        `[API /qr] ❌ QR não encontrado no Supabase para ${usuario_id}`
      );
      return res.status(404).json({ error: "QR não encontrado" });
    }

    console.log(`[API /qr] ✅ QR recuperado para ${usuario_id}`);
    return res.status(200).json({ qr: data.qr });
  } catch (err) {
    console.error("Erro ao buscar QR no Supabase:", err.message);
    return res.status(500).json({ error: "Erro interno ao buscar QR" });
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

// Novo endpoint para iniciar sessão com usuário específico
// server.js
app.post("/start", async (req, res) => {
  const { usuario_id } = req.body;

  if (!usuario_id) {
    return res.status(400).json({ error: "usuario_id é obrigatório" });
  }

  if (socketInstancia) {
    console.log(`[LeadTalk] ⚠️ Sessão já está ativa para ${usuario_id}`);
    return res.status(200).json({ status: "Sessão já ativa" });
  }

  try {
    const { data: usuario, error } = await supabase.auth.admin.getUserById(
      usuario_id
    );

    if (error || !usuario) {
      return res
        .status(404)
        .json({ error: "Usuário não encontrado no Supabase Auth" });
    }

    console.log(`[LeadTalk] Iniciando sessão para o usuário: ${usuario_id}`);

    await supabase
      .from("sessao")
      .upsert(
        { usuario_id, ativo: false, atualizado_em: new Date().toISOString() },
        { onConflict: "usuario_id" }
      );

    socketInstancia = await startLeadTalk({
      usuario_id,
      onQr: (qr) => {
        console.log("[LeadTalk] QR code recebido.", qr);
        setQrCode(qr);
      },
    });

    res.status(200).json({ status: "Sessão iniciada com sucesso" });
  } catch (err) {
    console.error("Erro ao iniciar sessão:", err);
    res.status(500).json({ error: "Falha ao iniciar sessão" });
  }
});

async function reconectarSessao() {
  try {
    const { data, error } = await supabase
      .from("sessao")
      .select("usuario_id")
      .eq("ativo", true);

    if (error) throw error;
    if (!data || data.length === 0) return;

    const usuario_id = data[0].usuario_id;
    console.log(`[LeadTalk] 🔁 Reconectando sessão para ${usuario_id}...`);

    socketInstancia = await startLeadTalk({
      usuario_id,
      onQr: (qr) => {
        console.log("[LeadTalk] 🔄 QR gerado na reativação.");
        setQrCode(qr);
      },
    });
  } catch (err) {
    console.error("[LeadTalk] ⚠️ Erro ao reconectar sessão:", err.message);
  }
}

app.listen(3001, () => {
  console.log("Servidor local do WhatsApp rodando na porta 3001.");
  reconectarSessao(); // ✅ chamada correta
});

// exoporta a instancia do socket para uso em outros módulos (envio de mensagens)
export function getSocketInstance() {
  return socketInstancia;
}

// 🌀 Inicializa o processador da fila (enviar mensagens)
import "./filaProcessor.js";
