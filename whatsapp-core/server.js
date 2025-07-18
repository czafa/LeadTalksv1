// GitHub/LeadTalksv1/whatsapp-core/server.js

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import { criarOuObterSocket } from "./core/socketManager.js";
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

// Rota de envio de mensagem
app.post("/api/enviar", async (req, res) => {
  const { usuario_id, numero, mensagem } = req.body;

  // Usa a própria função para obter a instância
  const instancia = await criarOuObterSocket(usuario_id, io);

  if (!instancia) {
    return res
      .status(500)
      .json({ error: "WhatsApp não está conectado ou sessão não encontrada." });
  }

  try {
    const jid = `${numero.replace(/[^\d]/g, "")}@s.whatsapp.net`;
    await instancia.sendMessage(jid, { text: mensagem });
    return res.status(200).json({ status: "Mensagem enviada" });
  } catch (err) {
    console.error("Falha no envio da mensagem:", err);
    return res.status(500).json({ error: "Falha no envio da mensagem" });
  }
});

app.post("/start", async (req, res) => {
  const { usuario_id } = req.body;
  if (!usuario_id) {
    return res.status(400).json({ error: "usuario_id é obrigatório" });
  }

  try {
    // A lógica de verificação de usuário/sessão foi movida para o core/socketManager.js
    // O server.js apenas delega a tarefa.
    console.log(
      `[Server] Recebida requisição para iniciar sessão para: ${usuario_id}`
    );

    // Chama a função importada corretamente
    const socket = await criarOuObterSocket(usuario_id, io);

    if (socket) {
      return res.status(200).json({ status: "Sessão iniciada ou já ativa." });
    } else {
      // Este caso agora é menos provável, pois o connectionManager trata as falhas.
      return res
        .status(500)
        .json({ error: "Falha ao iniciar ou obter a sessão." });
    }
  } catch (err) {
    console.error("Erro crítico no endpoint /start:", err);
    return res
      .status(500)
      .json({ error: "Falha grave ao processar a sessão." });
  }
});

// ROTA DE CONTATOS
app.get("/api/contatos", async (req, res) => {
  const { usuario_id } = req.query;

  if (!usuario_id) {
    return res.status(400).json({ error: "usuario_id é obrigatório" });
  }

  try {
    const { data, error } = await supabase
      .from("contatos")
      .select("id, nome, numero")
      .eq("usuario_id", usuario_id)
      .order("nome", { ascending: true });

    if (error) {
      console.error("Erro Supabase ao buscar contatos:", error);
      return res.status(500).json({ error: "Erro ao buscar contatos" });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("Erro fatal ao buscar contatos:", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});

// ✅ ROTA DE GRUPOS
app.get("/api/grupos", async (req, res) => {
  const { usuario_id } = req.query;
  if (!usuario_id)
    return res.status(400).json({ error: "usuario_id é obrigatório" });

  try {
    const { data, error } = await supabase
      .from("grupos")
      .select("grupo_jid, nome, tamanho")
      .eq("usuario_id", usuario_id)
      .order("nome", { ascending: true });

    if (error) {
      console.error("Erro Supabase ao buscar grupos:", error);
      return res.status(500).json({ error: "Erro ao buscar grupos" });
    }
    return res.status(200).json(data);
  } catch (err) {
    console.error("Erro fatal ao buscar grupos:", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});

// ✅ ROTA DE MEMBROS DE GRUPOS
app.get("/api/membros-grupos", async (req, res) => {
  const { usuario_id } = req.query;
  if (!usuario_id)
    return res.status(400).json({ error: "usuario_id é obrigatório" });

  try {
    const { data, error } = await supabase
      .from("membros_grupos")
      .select("grupo_jid, membro_nome, membro_numero")
      .eq("usuario_id", usuario_id);

    if (error) {
      console.error("Erro Supabase ao buscar membros:", error);
      return res
        .status(500)
        .json({ error: "Erro ao buscar membros de grupos" });
    }

    // Transforma o array plano em um objeto agrupado por grupo_jid para o frontend
    const membrosAgrupados = data.reduce((acc, membro) => {
      const { grupo_jid, membro_nome, membro_numero } = membro;
      if (!acc[grupo_jid]) {
        acc[grupo_jid] = [];
      }
      acc[grupo_jid].push({ nome: membro_nome, numero: membro_numero });
      return acc;
    }, {});

    return res.status(200).json({ grupos: membrosAgrupados });
  } catch (err) {
    console.error("Erro fatal ao buscar membros:", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});

// --- FIM DA DEFINIÇÃO DE ROTAS ---

// Gerenciamento de salas do Socket.IO (sem alterações)
io.on("connection", (socket) => {
  socket.on("join", (usuario_id) => {
    socket.join(usuario_id);
    console.log(`[Socket.IO] Cliente entrou na sala: ${usuario_id}`);
  });

  socket.on("disconnect", () => {
    console.log("[Socket.IO] Cliente desconectado");
  });
});

// ✅ O SERVIDOR SÓ COMEÇA A ESCUTAR DEPOIS DE TODAS AS ROTAS SEREM DEFINIDAS
server.listen(3001, () => {
  console.log(
    "🚀 Servidor WhatsApp reativo rodando na porta 3001. Aguardando requisições..."
  );
});

export function getSocketInstance(usuario_id) {
  // A lógica interna da função para obter o socket do 'socketMap'
  // deve ser adicionada aqui se não estiver já presente.
  // Supondo que 'socketMap' está definido no escopo superior deste ficheiro.
  const activeSockets = new Map(); // Esta linha é um placeholder, use o seu 'socketMap'
  return activeSockets.get(usuario_id);
}

import "./filaProcessor.js";
