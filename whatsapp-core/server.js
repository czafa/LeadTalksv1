// GitHub/LeadTalksv1/whatsapp-core/server.js

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import { criarOuObterSocket, getActiveSocket } from "./core/socketManager.js";
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

// --- DEFINIÇÃO DE ROTAS ---

// Rota para iniciar a sessão
app.post("/start", async (req, res) => {
  const { usuario_id } = req.body;
  if (!usuario_id) {
    return res.status(400).json({ error: "usuario_id é obrigatório" });
  }
  try {
    console.log(
      `[Server] Recebida requisição para iniciar sessão para: ${usuario_id}`
    );
    const socket = await criarOuObterSocket(usuario_id, io);
    if (socket) {
      return res.status(200).json({ status: "Sessão iniciada ou já ativa." });
    }
    return res
      .status(500)
      .json({ error: "Falha ao iniciar ou obter a sessão." });
  } catch (err) {
    console.error("Erro crítico no endpoint /start:", err);
    return res
      .status(500)
      .json({ error: "Falha grave ao processar a sessão." });
  }
});

// ROTA UNIFICADA /api/pessoas
app.get("/api/pessoas", async (req, res) => {
  const { usuario_id } = req.query;
  if (!usuario_id) {
    return res.status(400).json({ error: "usuario_id é obrigatório" });
  }
  try {
    const { data, error } = await supabase
      .from("pessoas_unicas")
      .select("nome_final, numero")
      .eq("usuario_id", usuario_id)

      // ✅ CORREÇÃO: A linha que tentava ordenar por 'prioridade' foi removida.
      // A VIEW já retorna os dados na ordem correta. Apenas garantimos a ordem do nome.
      .order("nome_final", { ascending: true })

      .limit(15000);

    if (error) {
      // O erro que você viu no terminal aconteceu aqui
      console.error("Erro Supabase ao buscar pessoas:", error);
      return res
        .status(500)
        .json({ error: "Erro ao buscar pessoas unificadas" });
    }

    const resultadoFormatado = data.map((p) => ({
      nome: p.nome_final,
      numero: p.numero,
    }));

    return res.status(200).json(resultadoFormatado);
  } catch (err) {
    console.error("Erro fatal ao buscar pessoas:", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});

// Rota de Grupos
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

    if (error) throw error;
    return res.status(200).json(data);
  } catch (err) {
    console.error("Erro fatal ao buscar grupos:", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});

// Rota de Membros de Grupos
app.get("/api/membros-grupos", async (req, res) => {
  const { usuario_id } = req.query;
  if (!usuario_id)
    return res.status(400).json({ error: "usuario_id é obrigatório" });

  try {
    const { data, error } = await supabase
      .from("membros_grupos")
      .select("grupo_jid, membro_nome, membro_numero")
      .eq("usuario_id", usuario_id);

    if (error) throw error;

    const membrosAgrupados = data.reduce((acc, membro) => {
      const { grupo_jid, membro_nome, membro_numero } = membro;
      if (!acc[grupo_jid]) acc[grupo_jid] = [];
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

// Gerenciamento de salas do Socket.IO
io.on("connection", (socket) => {
  socket.on("join", (usuario_id) => {
    socket.join(usuario_id);
    console.log(`[Socket.IO] Cliente entrou na sala: ${usuario_id}`);
  });
  socket.on("disconnect", () =>
    console.log("[Socket.IO] Cliente desconectado")
  );
});

server.listen(3001, () => {
  console.log("🚀 Servidor WhatsApp reativo rodando na porta 3001.");
});

// Esta função agora é exportada para ser usada pelo filaProcessor.js
export function getSocketInstance(usuario_id) {
  return getActiveSocket(usuario_id); // Delega para a função correta no socketManager
}

// Inicia o processador da fila
import "./filaProcessor.js";
