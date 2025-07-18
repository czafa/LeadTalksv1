// whatsapp-core/core/socketManager.js

import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  makeInMemoryStore,
} from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";
import path from "path";
import { Boom } from "@hapi/boom";
import { supabase } from "../supabase.js";
import { salvarQrNoSupabase } from "./qrManager.js";
import { sincronizarContatosEmBackground } from "./exportadores.js";

const logger = pino({ level: "trace" });
const store = makeInMemoryStore({ logger });
store?.readFromFile("./baileys_store.json");
setInterval(() => {
  store?.writeToFile("./baileys_store.json");
}, 10_000);

const activeSockets = new Map();

async function updateSessionStatus(usuario_id, isConnected) {
  try {
    const { error } = await supabase
      .from("sessao")
      .update({
        conectado: isConnected,
        atualizado_em: new Date().toISOString(),
      })
      .eq("usuario_id", usuario_id);

    if (error) {
      logger.error(
        { usuario_id, error },
        "Falha ao atualizar status da sessão no Supabase"
      );
    } else {
      logger.info(
        { usuario_id, isConnected },
        "Status da sessão atualizado no Supabase"
      );
    }
  } catch (err) {
    logger.error(
      { usuario_id, err },
      "Erro catastrófico ao atualizar status da sessão"
    );
  }
}

function clearAuthData(usuario_id) {
  const authDir = path.join("./auth", usuario_id);
  if (fs.existsSync(authDir)) {
    fs.rmSync(authDir, { recursive: true, force: true });
    logger.info({ usuario_id }, "Dados de autenticação locais limpos.");
  }
  activeSockets.delete(usuario_id);
}

export async function criarOuObterSocket(usuario_id, io) {
  if (activeSockets.has(usuario_id)) {
    logger.info(
      { usuario_id },
      "Socket já existente encontrado. Retornando instância ativa."
    );
    return activeSockets.get(usuario_id);
  }

  const authDir = path.join("./auth", usuario_id);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  // ✅ INÍCIO DA CORREÇÃO DEFINITIVA
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: process.env.NODE_ENV !== "production",
    logger,
    syncFullHistory: false,

    // CORREÇÃO 1: Fornece um valor de array válido para o browser
    browser: ["LeadTalks", "Chrome", "114.0.0"],

    // CORREÇÃO 2: Sintaxe JS pura e segura para getMessage
    getMessage: async (key) => {
      if (store) {
        const msg = await store.loadMessage(key.remoteJid, key.id);
        return msg?.message || undefined;
      }
      // Retorna uma mensagem vazia se o store não estiver disponível
      return { conversation: "" };
    },
  });
  // ✅ FIM DA CORREÇÃO DEFINITIVA

  store.bind(sock.ev);
  activeSockets.set(usuario_id, sock);

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info({ usuario_id }, "QR Code gerado.");
      await salvarQrNoSupabase(qr, usuario_id);
    }

    if (connection === "open") {
      logger.info({ usuario_id }, "Conexão WhatsApp estabelecida com sucesso.");
      await updateSessionStatus(usuario_id, true);
      await supabase.from("qr").delete().eq("usuario_id", usuario_id);
      io?.to(usuario_id).emit("connection_open", { usuario_id });
      sincronizarContatosEmBackground(sock, store, usuario_id);
    }

    if (connection === "close") {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      logger.warn({ usuario_id, reason }, "Conexão WhatsApp fechada.");
      activeSockets.delete(usuario_id);

      switch (reason) {
        case DisconnectReason.loggedOut:
          logger.warn({ usuario_id }, "Usuário deslogado. Limpando sessão.");
          await updateSessionStatus(usuario_id, false);
          clearAuthData(usuario_id);
          break;

        case DisconnectReason.restartRequired:
          logger.info(
            { usuario_id },
            "Reinício necessário. Recriando socket..."
          );
          criarOuObterSocket(usuario_id, io);
          break;

        case DisconnectReason.timedOut:
        case DisconnectReason.connectionLost:
        case DisconnectReason.connectionClosed:
          logger.info(
            { usuario_id, reason },
            "Conexão perdida. Tentando reconectar..."
          );
          await updateSessionStatus(usuario_id, false);
          criarOuObterSocket(usuario_id, io);
          break;

        case DisconnectReason.badSession:
          logger.error(
            { usuario_id },
            "Sessão inválida. Limpando dados de autenticação."
          );
          await updateSessionStatus(usuario_id, false);
          clearAuthData(usuario_id);
          criarOuObterSocket(usuario_id, io);
          break;

        case DisconnectReason.connectionReplaced:
          logger.warn(
            { usuario_id },
            "Conexão substituída. Encerrando esta sessão."
          );
          await updateSessionStatus(usuario_id, false);
          break;

        default:
          logger.error(
            { usuario_id, reason },
            "Razão de desconexão não tratada. Encerrando."
          );
          await updateSessionStatus(usuario_id, false);
          break;
      }
    }
  });

  return sock;
}
