// GitHub/LeadTalksv1/whatsapp-core/core/socketManager.js

import {
  makeWASocket,
  useMultiFileAuthState,
  makeInMemoryStore,
  DisconnectReason,
} from "@whiskeysockets/baileys";

import pino from "pino";
import fs from "fs";
import path from "path";
import { supabase } from "../supabase.js";
import { salvarQrNoSupabase } from "./qrManager.js";
import {
  exportarContatos,
  exportarGruposESuasPessoas,
} from "./exportadores.js";

const DATA_DIR = "./data";
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const store = makeInMemoryStore({ logger: pino({ level: "trace" }) });

async function sincronizarContatosEmBackground(sock, store, usuario_id) {
  console.log("[BG Sync] 🔄 Sincronizando contatos em segundo plano...");

  async function aguardarContatos(store, timeout = 30000) {
    const start = Date.now();
    while (
      Object.keys(store.contacts).length === 0 &&
      Date.now() - start < timeout
    ) {
      console.log("[BG Sync] ⏳ Aguardando contatos...");
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    return Object.keys(store.contacts).length > 0;
  }

  try {
    if (await aguardarContatos(store)) {
      await exportarContatos(store, usuario_id);
      await exportarGruposESuasPessoas(sock, store, usuario_id);
      console.log("[BG Sync] ✅ Exportações concluídas.");
    } else {
      console.warn("[BG Sync] ⚠️ Timeout: contatos não sincronizados.");
    }
  } catch (err) {
    console.error("[BG Sync] ❌ Erro na sincronização:", err);
  }
}

export async function criarSocket(usuario_id, onQr, io) {
  const { data: sessao } = await supabase
    .from("sessao")
    .select("logado, conectado")
    .eq("usuario_id", usuario_id)
    .single();

  if (!sessao?.logado) {
    console.warn(`[LeadTalk] ❌ Sessão não logada para ${usuario_id}.`);
    return null;
  }

  if (sessao?.conectado) {
    console.warn(`[LeadTalk] ⚠️ Sessão já conectada para ${usuario_id}.`);
    return null;
  }

  const pastaUsuario = path.join("./auth", usuario_id);
  if (!fs.existsSync(pastaUsuario)) {
    fs.mkdirSync(pastaUsuario, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(pastaUsuario);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: pino({ level: "silent" }), // Usar 'silent' em produção
    syncFullHistory: false,
  });

  store.bind(sock.ev);
  sock.ev.on("creds.update", saveCreds);

  sock.ev.on(
    "connection.update",
    async ({ connection, qr, lastDisconnect }) => {
      if (qr && usuario_id) {
        console.log("[Baileys] 📸 QR gerado.");
        await salvarQrNoSupabase(qr, usuario_id);
        onQr?.(qr);
      }

      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;

        // Sempre marca como desconectado no banco quando a conexão fecha
        await supabase
          .from("sessao")
          .update({ conectado: false })
          .eq("usuario_id", usuario_id);
        console.log(
          `[Baileys] 🔌 Conexão fechada. Status: ${statusCode}. Sessão marcada como desconectada.`
        );

        switch (statusCode) {
          // CORRETO: A conexão foi estabelecida via QR, precisa reiniciar o socket.
          case DisconnectReason.restartRequired:
            console.log(
              "[Baileys] 🔄 Reiniciando conexão após scan do QR (restartRequired)."
            );
            criarSocket(usuario_id, onQr, io);
            break;

          // CORRETO: Logout explícito, não reconectar.
          case DisconnectReason.loggedOut:
            console.log(
              "[Baileys] 🛑 Usuário deslogado (loggedOut). Limpando credenciais."
            );
            const pastaAuth = path.join("./auth", usuario_id);
            if (fs.existsSync(pastaAuth)) {
              fs.rmSync(pastaAuth, { recursive: true, force: true });
            }
            break;

          // Para todos os outros casos (timeout, erro de rede, etc.), tenta reconectar.
          default:
            console.log(`[Baileys] ⚠️ Tentando reconectar em 15 segundos...`);
            setTimeout(() => criarSocket(usuario_id, onQr, io), 15000);
        }
      }

      // CORRIGIDO: Lógica de 'open' simplificada e direta.
      if (connection === "open") {
        console.log("[Baileys] ✅ Conexão estável estabelecida.");

        // Ações de sucesso
        await supabase.from("qr").delete().eq("usuario_id", usuario_id);
        await supabase
          .from("sessao")
          .update({ conectado: true, atualizado_em: new Date().toISOString() })
          .eq("usuario_id", usuario_id);

        console.log("[Supabase] ✅ Sessão marcada como conectada.");

        io?.to(usuario_id).emit("connection_open", { usuario_id });
        console.log(
          `[Socket] 🔔 Evento 'connection_open' emitido para ${usuario_id}`
        );

        // Inicia tarefas pesadas em segundo plano, sem bloquear
        sincronizarContatosEmBackground(sock, store, usuario_id);
        console.log("[Baileys] ✅ Conexão validada e estável.");
      }
    }
  );

  return sock;
}
