import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pino from "pino";
import crypto from "crypto";
import { Boom } from "@hapi/boom";
import {
  makeWASocket,
  useMultiFileAuthState,
  makeInMemoryStore,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import { createClient } from "@supabase/supabase-js";
import { supabaseAuthState } from "./lib/supabaseAuth.js"; // ajuste o caminho se necessário

import { setQrCode } from "./qrStore.js";

// Corrige __dirname em ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
if (!globalThis.crypto) globalThis.crypto = crypto.webcrypto;

// Supabase client usando Service Role Key para escrita
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(process.env.SUPABASE_URL, SUPABASE_KEY);

const isProd = process.env.ENV_MODE === "production";
console.log(`Modo: ${process.env.ENV_MODE}`);

// Diretório de dados (cache e debug)
const DATA_DIR = path.resolve(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Store em memória do Baileys
const store = makeInMemoryStore({
  logger: pino({ level: "silent" }).child({ stream: "store" }),
});
store.readFromFile(path.join(DATA_DIR, "store.json"));
setInterval(() => store.writeToFile(path.join(DATA_DIR, "store.json")), 10000);

// Grava em disco para debug
function debugSalvarArquivosLocais({
  contatos = [],
  grupos = [],
  membros = [],
}) {
  try {
    if (contatos.length) {
      fs.writeFileSync(
        path.join(DATA_DIR, "debug_contatos.json"),
        JSON.stringify(contatos, null, 2)
      );
      console.log(
        `✅ ${contatos.length} contatos salvos em debug_contatos.json`
      );
    }
    if (grupos.length) {
      fs.writeFileSync(
        path.join(DATA_DIR, "debug_grupos.json"),
        JSON.stringify(grupos, null, 2)
      );
      console.log(`✅ ${grupos.length} grupos salvos em debug_grupos.json`);
    }
    if (membros.length) {
      fs.writeFileSync(
        path.join(DATA_DIR, "debug_membros.json"),
        JSON.stringify(membros, null, 2)
      );
      console.log(`✅ ${membros.length} membros salvos em debug_membros.json`);
    }
  } catch (err) {
    console.error("❌ Falha ao salvar arquivos locais:", err.message);
  }
}

async function aguardarContatos(timeout = 20000) {
  const start = Date.now();
  while (
    Object.keys(store.contacts).length === 0 &&
    Date.now() - start < timeout
  ) {
    console.log("[LeadTalk] ⏳ Aguardando contatos do WhatsApp...");
    await new Promise((r) => setTimeout(r, 1000));
  }
  return Object.keys(store.contacts).length > 0;
}

export async function startLeadTalk({ usuario_id, onQr }) {
  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await supabaseAuthState(usuario_id);
  const { creds } = state;

  let sock;

  if (!creds?.me) {
    console.warn("[LeadTalk] ⚠️ Nenhuma sessão encontrada. Gerando QR...");

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true,
      logger: pino({ level: "silent" }),
    });

    sock.ev.on("creds.update", saveCreds);
  } else {
    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true,
      logger: pino({ level: "silent" }),
      syncFullHistory: true,
      generateHighQualityLinkPreview: true,
      markOnlineOnConnect: true,
    });

    sock.ev.on("creds.update", saveCreds);
    store.bind(sock.ev);
  }

  sock.ev.on(
    "connection.update",
    async ({ connection, qr, lastDisconnect }) => {
      if (qr) {
        console.log("[LeadTalk] 📸 QR GERADO:", qr.slice(0, 30));
        await supabase
          .from("qr")
          .upsert({ usuario_id, qr }, { onConflict: "usuario_id" });
        onQr?.(qr);
      }

      if (connection === "open") {
        console.log("✅ Conectado ao WhatsApp");
        await supabase.from("qr").delete().eq("usuario_id", usuario_id);
        await supabase.from("sessao").upsert({ usuario_id, ativo: true });

        if (await aguardarContatos()) {
          await exportarContatos(usuario_id);
        }
        await new Promise((r) => setTimeout(r, 5000));
        await exportarGruposESuasPessoas(sock, usuario_id);
      }

      if (connection === "close") {
        const shouldReconnect =
          lastDisconnect?.error instanceof Boom &&
          lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;
        console.log("🔁 Conexão encerrada. Reconectar:", shouldReconnect);
        if (shouldReconnect) {
          startLeadTalk({ usuario_id, onQr });
        } else {
          await supabase
            .from("sessao")
            .update({ ativo: false })
            .eq("usuario_id", usuario_id);
        }
      }
    }
  );

  return sock;
}

async function exportarContatos(usuario_id) {
  const contatos = Object.entries(store.contacts)
    .filter(([jid]) => jid.endsWith("@s.whatsapp.net"))
    .map(([jid, c]) => ({
      nome: c.name || c.notify || c.pushname || jid,
      numero: jid.split("@")[0],
      tipo: "contato",
      usuario_id,
    }));

  debugSalvarArquivosLocais({ contatos });

  const { data, error } = await supabase
    .from("contatos")
    .upsert(contatos, { onConflict: ["numero", "usuario_id"] });

  if (error) {
    console.error("❌ Erro exportarContatos:", error);
  } else {
    console.log("✅ resposta upsert contatos:", data);
    console.log(`☑️ Exportados ${contatos.length} contatos.`);
  }
}

async function exportarGruposESuasPessoas(sock, usuario_id) {
  const chats = store.chats.all().filter((c) => c.id.endsWith("@g.us"));
  const grupos = [];
  const membros = [];

  for (const chat of chats) {
    try {
      const meta = await sock.groupMetadata(chat.id);
      grupos.push({
        grupo_jid: meta.id,
        nome: meta.subject,
        tamanho: meta.participants.length,
        usuario_id,
      });
      for (const p of meta.participants) {
        membros.push({
          grupo_jid: meta.id,
          membro_numero: p.id.split("@")[0],
          membro_nome: p.id,
          admin: p.admin != null,
          usuario_id,
        });
      }
    } catch (err) {
      console.error("❌ Erro metadata grupo", chat.id, err.message);
    }
  }

  debugSalvarArquivosLocais({ grupos, membros });

  const { data: dataGrupos, error: errorGrupos } = await supabase
    .from("grupos")
    .upsert(grupos, { onConflict: ["grupo_jid", "usuario_id"] });

  if (errorGrupos) {
    console.error("❌ Erro exportarGrupos:", errorGrupos);
  } else {
    console.log("✅ resposta upsert grupos:", dataGrupos);
    console.log(`☑️ Exportados ${grupos.length} grupos.`);
  }

  const { data: dataMembros, error: errorMembros } = await supabase
    .from("membros_grupos")
    .upsert(membros, {
      onConflict: ["grupo_jid", "membro_numero", "usuario_id"],
    });

  if (errorMembros) {
    console.error("❌ Erro exportarMembros:", errorMembros);
  } else {
    console.log("✅ resposta upsert membros:", dataMembros);
    console.log(`☑️ Exportados ${membros.length} membros de grupos.`);
  }
}
