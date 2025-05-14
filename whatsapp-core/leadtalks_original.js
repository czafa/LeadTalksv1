// leadtalks.js - ORIGINAL
import dotenv from "dotenv";
import fs from "fs";
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
import { setQrCode } from "./qrStore.js";

dotenv.config();
if (!globalThis.crypto) globalThis.crypto = crypto.webcrypto;

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(process.env.SUPABASE_URL, SUPABASE_KEY);

const isProd = process.env.ENV_MODE === "production";
console.log(process.env.ENV_MODE);

const DATA_DIR = "./data";
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const store = makeInMemoryStore({
  logger: pino({ level: "silent" }).child({ stream: "store" }),
});
store.readFromFile(`${DATA_DIR}/store.json`);
setInterval(() => store.writeToFile(`${DATA_DIR}/store.json`), 10_000);

function debugSalvarArquivosLocais({
  contatos = [],
  grupos = [],
  membros = [],
}) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

    if (contatos.length > 0) {
      fs.writeFileSync(
        `${DATA_DIR}/debug_contatos.json`,
        JSON.stringify(contatos, null, 2)
      );
      console.log(
        `✅ ${contatos.length} contatos salvos em debug_contatos.json`
      );
    }

    if (grupos.length > 0) {
      fs.writeFileSync(
        `${DATA_DIR}/debug_grupos.json`,
        JSON.stringify(grupos, null, 2)
      );
      console.log(`✅ ${grupos.length} grupos salvos em debug_grupos.json`);
    }

    if (membros.length > 0) {
      fs.writeFileSync(
        `${DATA_DIR}/debug_membros.json`,
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
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return Object.keys(store.contacts).length > 0;
}

export async function startLeadTalk({ usuario_id, onQr }) {
  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    logger: pino({ level: "silent" }),
    syncFullHistory: true,
    generateHighQualityLinkPreview: true,
    markOnlineOnConnect: true,
  });

  store.bind(sock.ev);

  // Evento corrigido e melhorado para salvar contatos corretamente
  sock.ev.on("contacts.update", async (updates) => {
    console.log("✅ Contatos atualizados:", updates);

    const contatosAtualizados = updates
      .filter((contato) => contato.id.endsWith("@s.whatsapp.net"))
      .map((contato) => ({
        nome: contato.notify || contato.name || contato.pushname || contato.id,
        numero: contato.id.split("@")[0],
        tipo: "contato",
        usuario_id,
      }));

    if (contatosAtualizados.length === 0) {
      console.warn("⚠️ Nenhum contato válido para salvar após atualização.");
      return;
    }

    debugSalvarArquivosLocais({ contatos: contatosAtualizados });

    const { error } = await supabase
      .from("contatos")
      .upsert(contatosAtualizados, { onConflict: ["numero", "usuario_id"] });

    if (error) {
      console.error(
        "❌ Erro ao atualizar contatos no Supabase:",
        error.message
      );
    } else {
      console.log(
        `✅ ${contatosAtualizados.length} contatos atualizados no Supabase.`
      );
    }
  });

  sock.ev.on(
    "connection.update",
    async ({ connection, qr, lastDisconnect }) => {
      if (qr && usuario_id) {
        try {
          await supabase.from("qr").insert([{ usuario_id, qr }]);
          console.log("✅ QR salvo no Supabase com sucesso!");
        } catch (err) {
          console.error("❌ Erro ao salvar QR code:", err.message);
        }

        if (onQr) {
          onQr(qr);
        }
      }

      if (connection === "close") {
        const shouldReconnect =
          lastDisconnect?.error instanceof Boom &&
          lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;
        console.log("🔁 Conexão encerrada. Reconectar:", shouldReconnect);
        if (shouldReconnect) startLeadTalk({ usuario_id, onQr });
      }

      if (connection === "open") {
        console.log("✅ Conectado ao WhatsApp");

        try {
          if (usuario_id) {
            await supabase.from("qr").delete().eq("usuario_id", usuario_id);
            await supabase
              .from("sessao")
              .upsert(
                { usuario_id, ativo: true },
                { onConflict: ["usuario_id"] }
              );

            console.log("☑️ Sessão marcada como ativa no Supabase.");
          }

          const contatosCarregados = await aguardarContatos();
          if (contatosCarregados) {
            await exportarContatos(usuario_id);
          } else {
            console.warn(
              "[LeadTalk] 🛑 Contatos não carregados. Pulando exportação inicial."
            );
          }

          // Pequeno delay para garantir chats populados corretamente antes da exportação
          await new Promise((resolve) => setTimeout(resolve, 5000));
          await exportarGruposESuasPessoas(sock, usuario_id);
          await processarFilaMensagens(sock, usuario_id);
        } catch (err) {
          console.error("❌ Erro pós-conexão:", err.message);
        }
      }
    }
  );

  sock.ev.on("creds.update", saveCreds);

  return sock;
}

async function exportarContatos(usuario_id) {
  const contatos = Object.entries(store.contacts)
    .filter(([jid]) => jid.endsWith("@s.whatsapp.net"))
    .map(([jid, contato]) => ({
      nome: contato.name || contato.notify || contato.pushname || jid,
      numero: jid.split("@")[0],
      tipo: "contato",
      usuario_id,
    }));

  debugSalvarArquivosLocais({ contatos });

  const { data, error } = await supabase.from("contatos").upsert(contatos);

  if (error) {
    console.error("❌ Erro Supabase:", error.message);
  } else {
    console.log(`☑️ Contatos inseridos: ${data?.length}`);
  }

  console.log(`[LeadTalk] ${contatos.length} contatos enviados ao Supabase.`);
}
