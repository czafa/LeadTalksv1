// leadtalks.js
import {
  makeWASocket,
  useMultiFileAuthState,
  makeInMemoryStore,
} from "@whiskeysockets/baileys";
import P from "pino";
import fs from "fs";

const DATA_DIR = "./data";
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const store = makeInMemoryStore({
  logger: P().child({ level: "silent", stream: "store" }),
});
store.readFromFile(`${DATA_DIR}/store.json`);
setInterval(() => {
  store.writeToFile(`${DATA_DIR}/store.json`);
}, 10_000);

/**
 * Inicia a sessão do WhatsApp e retorna a instância do socket.
 * @param {{ usuario_id: string, onQr: (qr: string) => void }} options
 * @returns {Promise<import('@whiskeysockets/baileys').AnyWASocket>}
 */
export async function startLeadTalk({ usuario_id, onQr }) {
  // Ajuste do estado de autenticação, criando pastas separadas por usuário
  const authPath = `./auth/${usuario_id}`;
  if (!fs.existsSync(authPath)) fs.mkdirSync(authPath, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(authPath);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: P({ level: "silent" }),
  });

  // Bind do armazenamento em memória
  store.bind(sock.ev);
  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && typeof onQr === "function") {
      onQr(qr);
    }

    if (connection === "close") {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
      console.log("Conexão perdida, tentando reconectar...");
      if (shouldReconnect) {
        await startLeadTalk({ usuario_id, onQr });
      }
      return;
    }

    if (connection === "open") {
      console.log("[LeadTalk] Conectado com sucesso ao WhatsApp!");
      await exportarContatos();
      await exportarGruposESuasPessoas(sock);
    }
  });

  return sock;
}

function exportarContatos() {
  const contatos = Object.entries(store.contacts).map(([jid, contato]) => ({
    nome: contato.name || contato.notify || contato.pushname || jid,
    numero: jid.split("@")[0],
    tipo: jid.includes("@g.us") ? "grupo" : "contato",
  }));

  fs.writeFileSync(
    `${DATA_DIR}/contatos.json`,
    JSON.stringify(contatos, null, 2)
  );
  console.log(`[LeadTalk] ${contatos.length} contatos salvos em contatos.json`);
}

async function exportarGruposESuasPessoas(sock) {
  const grupos = store.chats.all().filter((chat) => chat.id.endsWith("@g.us"));

  const gruposFormatados = [];
  const membrosPorGrupo = {};

  for (const grupo of grupos) {
    try {
      const metadata = await sock.groupMetadata(grupo.id);

      gruposFormatados.push({
        nome: metadata.subject,
        jid: metadata.id,
        tamanho: metadata.participants.length,
      });

      membrosPorGrupo[metadata.id] = metadata.participants.map((p) => ({
        numero: p.id.split("@")[0],
        jid: p.id,
        admin: p.admin || false,
      }));
    } catch (err) {
      console.warn(`[LeadTalk] Falha ao buscar metadata de ${grupo.id}`);
    }
  }

  fs.writeFileSync(
    `${DATA_DIR}/grupos.json`,
    JSON.stringify(gruposFormatados, null, 2)
  );
  fs.writeFileSync(
    `${DATA_DIR}/membros-grupos.json`,
    JSON.stringify(membrosPorGrupo, null, 2)
  );

  console.log(`[LeadTalk] ${grupos.length} grupos salvos em grupos.json`);
  console.log(`[LeadTalk] Participantes salvos em membros-grupos.json`);
}
