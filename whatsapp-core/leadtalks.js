import { supabase } from "./supabase.js";
import crypto from "crypto";
globalThis.crypto = crypto.webcrypto;

import {
  makeWASocket,
  useMultiFileAuthState,
  makeInMemoryStore,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import P from "pino";
import fs from "fs";

const isProd = process.env.ENV_MODE === "production";

const DATA_DIR = "./data";
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const store = makeInMemoryStore({
  logger: P().child({ level: "silent", stream: "store" }),
});
store.readFromFile(`${DATA_DIR}/store.json`);
setInterval(() => {
  store.writeToFile(`${DATA_DIR}/store.json`);
}, 10_000);

async function startLeadTalk() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: P({ level: "silent" }),
  });

  store.bind(sock.ev);
  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
      console.log("Conexão perdida, tentando reconectar...");
      if (shouldReconnect) startLeadTalk();
    }

    if (connection === "open") {
      console.log("[LeadTalk] Conectado com sucesso ao WhatsApp!");
      await exportarContatos();
      await exportarGruposESuasPessoas(sock);
    }
  });
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
    console.log(
      `[LeadTalk] ${contatos.length} contatos salvos em contatos.json`
    );
  }

  const { data: userData } = await supabase.auth.getUser();
  const usuario_id = userData?.user?.id;

  const contatosComUsuario = contatos.map((c) => ({
    ...c,
    usuario_id,
  }));

  await supabase.from("contatos").upsert(contatosComUsuario);
  console.log(`[LeadTalk] ${contatos.length} contatos enviados ao Supabase`);
}

async function exportarGruposESuasPessoas(sock) {
  const grupos = store.chats.all().filter((chat) => chat.id.endsWith("@g.us"));
  const gruposFormatados = [];
  const membrosPorGrupo = [];

  const { data: userData } = await supabase.auth.getUser();
  const usuario_id = userData?.user?.id;

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
      console.warn(`[LeadTalk] Falha ao buscar metadata de ${grupo.id}`);
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
    console.log(`[LeadTalk] Grupos e membros salvos como JSON`);
  }

  await supabase.from("grupos").upsert(gruposFormatados);
  await supabase.from("membros_grupos").upsert(membrosPorGrupo);

  console.log(
    `[LeadTalk] ${grupos.length} grupos e participantes enviados ao Supabase`
  );
}

startLeadTalk();
