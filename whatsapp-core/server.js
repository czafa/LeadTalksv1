//GitHub/LeadTalksv1/whatsapp-core/server.js

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import { startLeadTalk } from "./leadtalks.js";
import { supabase } from "./supabase.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  path: "/socket.io",
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

console.log("🔧 Iniciando server.js...");

// 🧠 Multiusuário: gerencia múltiplas sessões simultâneas
const socketMap = new Map();

/**
 * Centraliza a criação e armazenamento do socket
 */
async function iniciarSocket(usuario_id) {
  const socket = await startLeadTalk({
    usuario_id,
    onQr: (qr) => {
      console.log(
        "[LeadTalk] 📸 QR recebido e sendo processado pelo socketManager."
      );
      // A emissão do QR via socket.io pode ser mantida como um fallback,
      // mas o fluxo principal do frontend usará o Supabase Realtime.
      io.to(usuario_id).emit("qr", { qr });
    },
    io,
  });

  if (socket) {
    socketMap.set(usuario_id, socket);
    return true;
  }

  return false;
}

// Rota para msg
app.post("/api/enviar", async (req, res) => {
  const { usuario_id, numero, mensagem } = req.body;
  const instancia = socketMap.get(usuario_id);

  if (!instancia)
    return res.status(500).json({ error: "WhatsApp ainda não conectado" });

  try {
    const jid = `${numero.replace(/[^\d]/g, "")}@s.whatsapp.net`;
    await instancia.sendMessage(jid, { text: mensagem });
    return res.status(200).json({ status: "Mensagem enviada" });
  } catch (err) {
    return res.status(500).json({ error: "Falha no envio" });
  }
});

// Rota de Iniciar sessão
app.post("/start", async (req, res) => {
  const { usuario_id } = req.body;
  if (!usuario_id)
    return res.status(400).json({ error: "usuario_id é obrigatório" });

  if (socketMap.has(usuario_id)) {
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

    if (!sessao?.logado)
      return res.status(403).json({ error: "Usuário não está logado" });

    if (sessao?.conectado === true) {
      return res.status(200).json({ status: "Sessão já conectada" });
    }

    const sucesso = await iniciarSocket(usuario_id);
    if (!sucesso)
      return res.status(500).json({ error: "Falha ao iniciar sessão" });

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

    for (const sessao of data) {
      const usuario_id = sessao.usuario_id;
      console.log(`[LeadTalk] 🔁 Reconectando sessão para ${usuario_id}...`);
      await iniciarSocket(usuario_id);
    }
  } catch (err) {
    console.error("[LeadTalk] ⚠️ Erro ao reconectar sessão:", err.message);
  }
}

// Gerenciar entrada nas salas socket por usuario_id
io.on("connection", (socket) => {
  socket.on("join", (usuario_id) => {
    socket.join(usuario_id);
    console.log(`[Socket] ✅ Usuário ${usuario_id} entrou na sala`);
  });

  socket.on("disconnect", () => {
    console.log("[Socket] 🔌 Socket desconectado");
  });
});

server.listen(3001, () => {
  console.log("Servidor local do WhatsApp rodando na porta 3001.");
  reconectarSessao();
});

// Para testes ou reinicializações forçadas
export function getSocketInstance(usuario_id) {
  return socketMap.get(usuario_id);
}

import "./filaProcessor.js";
