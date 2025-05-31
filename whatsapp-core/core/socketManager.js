// core/socketManager.js
import { fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import {
  makeWASocket,
  useMultiFileAuthState,
  makeInMemoryStore,
} from "@whiskeysockets/baileys";

import pino from "pino";
import fs from "fs";
import path from "path";
import { supabase } from "../supabase.js";

import {
  salvarQrNoSupabase,
  marcarSessaoAtiva,
  marcarSessaoInativa,
} from "./qrManager.js";

import {
  exportarContatos,
  exportarGruposESuasPessoas,
} from "./exportadores.js";

// === Diretório onde ficam os contatos salvos temporariamente ===
const DATA_DIR = "./data";
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// === Memória local dos contatos e grupos ===
const store = makeInMemoryStore({ logger: pino({ level: "silent" }) });
store.readFromFile(`${DATA_DIR}/store.json`);
setInterval(() => store.writeToFile(`${DATA_DIR}/store.json`), 10_000);

/**
 * Cria o socket do WhatsApp e gerencia todos os eventos da sessão.
 *
 * @param {string} usuario_id - ID do usuário autenticado no Supabase
 * @param {Function} [onQr] - Callback opcional para lidar com o QR Code
 * @returns {Promise<any>} - Retorna a instância do socket
 */
export async function criarSocket(usuario_id, onQr) {
  const pastaUsuario = path.join("./auth", usuario_id);

  // 🛡️ Verifica se a sessão está inativa no Supabase
  const { data: sessao, error: erroSessao } = await supabase
    .from("sessao")
    .select("ativo")
    .eq("usuario_id", usuario_id)
    .single();

  if (erroSessao) {
    console.warn(
      `[LeadTalk] ⚠️ Erro ao verificar sessão no Supabase: ${erroSessao.message}`
    );
  }

  if (sessao?.ativo === false) {
    console.log(
      `[LeadTalk] 🚫 Sessão inativa no Supabase para ${usuario_id}. Forçando novo QR...`
    );

    if (fs.existsSync(pastaUsuario)) {
      fs.rmSync(pastaUsuario, { recursive: true, force: true });
      console.log(`[LeadTalk] 🧹 Pasta de sessão removida: ${pastaUsuario}`);
    }
  }

  // Garante que a pasta existe após possível remoção
  if (!fs.existsSync(pastaUsuario)) {
    fs.mkdirSync(pastaUsuario, { recursive: true });
  }

  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState(pastaUsuario);

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    logger: pino({ level: "silent" }),
    syncFullHistory: true,
    generateHighQualityLinkPreview: true,
    markOnlineOnConnect: true,
    emitOwnEvents: true,
  });

  store.bind(sock.ev);
  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("contacts.update", async (updates) => {
    const contatosAtualizados = updates
      .filter((contato) => contato.id.endsWith("@s.whatsapp.net"))
      .map((contato) => ({
        nome: contato.notify || contato.name || contato.pushname || contato.id,
        numero: contato.id.split("@")[0],
        tipo: "contato",
        usuario_id,
      }));

    if (contatosAtualizados.length === 0) return;

    const arquivo = `./data/contatos_${usuario_id}.json`;
    let contatosExistentes = [];

    if (fs.existsSync(arquivo)) {
      try {
        const raw = fs.readFileSync(arquivo, "utf-8");
        contatosExistentes = JSON.parse(raw);
      } catch (err) {
        console.warn(`[LeadTalk] ⚠️ Erro ao ler ${arquivo}: ${err.message}`);
      }
    }

    const novosContatos = contatosAtualizados.filter(
      (novo) => !contatosExistentes.some((c) => c.numero === novo.numero)
    );

    const todos = [...contatosExistentes, ...novosContatos];
    fs.writeFileSync(arquivo, JSON.stringify(todos, null, 2));

    console.log(
      `[LeadTalk] ✅ ${novosContatos.length} novos contatos adicionados a ${arquivo}`
    );
  });

  sock.ev.on(
    "connection.update",
    async ({ connection, qr, lastDisconnect }) => {
      if (qr && usuario_id) {
        await salvarQrNoSupabase(qr, usuario_id);
        onQr?.(qr);
        console.log("[LeadTalk] 📸 QR gerado:", qr.slice(0, 30));
      }

      if (connection === "open") {
        console.log("[LeadTalk] ✅ Conectado com sucesso!");

        await supabase.from("qr").delete().eq("usuario_id", usuario_id);
        await marcarSessaoAtiva(usuario_id);

        const aguardarContatos = async (timeout = 20000) => {
          const start = Date.now();

          while (
            Object.keys(store.contacts).length === 0 &&
            Date.now() - start < timeout
          ) {
            console.log("[LeadTalk] ⏳ Aguardando contatos do WhatsApp...");
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }

          const sucesso = Object.keys(store.contacts).length > 0;

          if (sucesso) {
            console.log("[LeadTalk] ✅ Contatos carregados com sucesso.");
          } else {
            console.warn("[LeadTalk] ⚠️ Timeout: contatos não carregados.");
          }

          return sucesso;
        };

        await aguardarContatos();
        await exportarContatos(store, usuario_id);
        await exportarGruposESuasPessoas(sock, store, usuario_id);
      }

      if (connection === "close") {
        const status = lastDisconnect?.error?.output?.statusCode;
        const deveReconectar = !status || status !== 401;

        if (deveReconectar) {
          console.log("🔄 Conexão perdida. Tentando reconectar...");
          setTimeout(() => criarSocket(usuario_id, onQr), 5000);
        } else {
          await marcarSessaoInativa(usuario_id);
          console.log("🔒 Sessão encerrada e marcada como inativa.");
        }
      }
    }
  );

  return sock;
}
