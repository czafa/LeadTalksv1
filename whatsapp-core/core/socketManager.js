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
import { iniciarSincronizacaoCompleta } from "./syncManager.js";

const logger = pino({ level: "silent" });
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

  // Cria uma nova store em memória para cada sessão
  const store = makeInMemoryStore({ logger });
  const storeFilePath = `./baileys_store_${usuario_id}.json`;
  store?.readFromFile(storeFilePath);
  setInterval(() => {
    store?.writeToFile(storeFilePath);
  }, 10_000);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: process.env.NODE_ENV !== "production",
    logger,
    syncFullHistory: false,
    browser: ["LeadTalks", "Chrome", "114.0.0"],
    getMessage: async (key) => {
      return store.loadMessage(key.remoteJid, key.id)?.message || undefined;
    },
  });

  // Vincula a store ao socket imediatamente
  store.bind(sock.ev);
  activeSockets.set(usuario_id, sock);

  let syncJaIniciada = false;

  // A FORMA CORRETA E RECOMENDADA PELO MANUAL
  // Ouve o evento que sinaliza o fim da sincronização inicial.
  sock.ev.on("messaging-history.set", (update) => {
    const { isLatest } = update;
    if (isLatest && !syncJaIniciada) {
      syncJaIniciada = true;
      console.log(
        "[SocketManager] ✅ Sincronização inicial do Baileys concluída. A iniciar a nossa sincronização para o Supabase..."
      );
      // ✅ PASSA A INSTÂNCIA 'io' PARA O SYNC MANAGER
      iniciarSincronizacaoCompleta(sock, store, usuario_id, io);
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info({ usuario_id }, "QR Code gerado.");
      io?.to(usuario_id).emit("qr_code_updated", { qr });
      await salvarQrNoSupabase(qr, usuario_id);
    }

    if (connection === "open") {
      logger.info({ usuario_id }, "Conexão WhatsApp estabelecida com sucesso.");
      await updateSessionStatus(usuario_id, true);
      await supabase.from("qr").delete().eq("usuario_id", usuario_id);
      io?.to(usuario_id).emit("connection_open", { usuario_id });
      console.log(
        "[SocketManager] Conexão aberta. Aguardando fim da sincronização do Baileys..."
      );
    }

    if (connection === "close") {
      syncJaIniciada = false; // Reseta o controle de sincronização
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
        // Outros casos de desconexão...
        default:
          await updateSessionStatus(usuario_id, false);
          break;
      }
    }
  });

  return sock;
}

export function getActiveSocket(usuario_id) {
  return activeSockets.get(usuario_id) || null;
}
