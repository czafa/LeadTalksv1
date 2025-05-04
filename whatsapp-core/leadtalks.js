// leadtalks.js
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

let sock = null;

const store = makeInMemoryStore({
  logger: pino({ level: "silent" }).child({ stream: "store" }),
});
store.readFromFile(`${DATA_DIR}/store.json`);
setInterval(() => store.writeToFile(`${DATA_DIR}/store.json`), 10_000);
// 🔑 Usuário fixo (Solução B)
const usuario_id = process.env.USUARIO_ID;

export async function startLeadTalk() {
  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    logger: pino({ level: "silent" }),
    syncFullHistory: false,
    generateHighQualityLinkPreview: true,
    markOnlineOnConnect: true,
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
      }

      if (connection === "close") {
        const shouldReconnect =
          lastDisconnect?.error instanceof Boom &&
          lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;
        console.log("🔁 Conexão encerrada. Reconectar:", shouldReconnect);
        if (shouldReconnect) startLeadTalk(); // reutiliza mesmo usuario_id
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

          await exportarContatos();
          await exportarGruposESuasPessoas(sock);
          await processarFilaMensagens(sock);
        } catch (err) {
          console.error("❌ Erro pós-conexão:", err.message);
        }
      }
    }
  );

  sock.ev.on("creds.update", saveCreds);

  return sock;
}

async function exportarContatos() {
  const contatos = Object.entries(store.contacts).map(([jid, contato]) => ({
    nome: contato.name || contato.notify || contato.pushname || jid,
    numero: jid.split("@")[0],
    tipo: jid.includes("@g.us") ? "grupo" : "contato",
  }));

  if (!isProd) {
    fs.writeFileSync(
      `${DATA_DIR}/contatos.json`,
      JSON.stringify(contatos, null, 2)
    );
    console.log(`[LeadTalk] ${contatos.length} contatos salvos localmente.`);
  }

  const { data } = await supabase.auth.getUser();
  const usuario_id = data?.user?.id;
  const contatosComUsuario = contatos.map((c) => ({ ...c, usuario_id }));

  await supabase.from("contatos").upsert(contatosComUsuario);
  console.log(`[LeadTalk] ${contatos.length} contatos enviados ao Supabase.`);
}

async function exportarGruposESuasPessoas(sock) {
  const grupos = store.chats.all().filter((chat) => chat.id.endsWith("@g.us"));
  const gruposFormatados = [];
  const membrosPorGrupo = [];

  const { data } = await supabase.auth.getUser();
  const usuario_id = data?.user?.id;

  for (const grupo of grupos) {
    try {
      const metadata = await sock.groupMetadata(grupo.id);
      gruposFormatados.push({
        nome: metadata.subject,
        jid: metadata.id,
        tamanho: metadata.participants.length,
        usuario_id,
      });

      metadata.participants.forEach((p) => {
        membrosPorGrupo.push({
          grupo_nome: metadata.subject,
          membro_nome: p.id.split("@")[0],
          membro_numero: p.id.split("@")[0],
          usuario_id,
        });
      });
    } catch (err) {
      console.warn(`[LeadTalk] ⚠️ Falha ao buscar metadata de ${grupo.id}`);
    }
  }

  if (!isProd) {
    fs.writeFileSync(
      `${DATA_DIR}/grupos.json`,
      JSON.stringify(gruposFormatados, null, 2)
    );
    fs.writeFileSync(
      `${DATA_DIR}/membros-grupos.json`,
      JSON.stringify(membrosPorGrupo, null, 2)
    );
  }

  await supabase.from("grupos").upsert(gruposFormatados);
  await supabase.from("membros_grupos").upsert(membrosPorGrupo);

  console.log(
    `[LeadTalk] ${grupos.length} grupos e membros enviados ao Supabase.`
  );
}

function personalizarMensagem(template, nome) {
  return template.replace(/{{\s*nome\s*}}/gi, nome);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processarFilaMensagens(sock) {
  console.log("[LeadTalk] 🔄 Buscando mensagens na fila...");
  const { data: mensagens, error } = await supabase
    .from("queue")
    .select("*")
    .eq("enviado", false);

  if (error) {
    console.error("Erro ao buscar fila:", error);
    return;
  }

  if (!mensagens.length) {
    console.log("[LeadTalk] 🚫 Nenhuma mensagem pendente.");
    return;
  }

  for (const msg of mensagens) {
    const jid = `${msg.numero_destino.replace(/[^\d]/g, "")}@s.whatsapp.net`;
    const texto = personalizarMensagem(
      msg.mensagem,
      msg.nome || msg.numero_destino
    );

    try {
      await sock.sendMessage(jid, { text: texto });
      console.log(`✅ Mensagem enviada para ${msg.numero_destino}`);

      await supabase
        .from("queue")
        .update({ enviado: true, data_envio: new Date().toISOString() })
        .eq("id", msg.id);
    } catch (err) {
      console.error(
        `❌ Erro ao enviar para ${msg.numero_destino}:`,
        err.message
      );
    }

    const espera = 10000 + Math.floor(Math.random() * 5000);
    await delay(espera);
  }

  console.log("[LeadTalk] 🏁 Fim da fila de mensagens.");
}
