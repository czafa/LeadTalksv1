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

import { salvarQrNoSupabase } from "./qrManager.js";

import {
  exportarContatos,
  exportarGruposESuasPessoas,
} from "./exportadores.js";

// Diretório onde ficam os contatos salvos temporariamente
const DATA_DIR = "./data";
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// Memória local dos contatos e grupos
const store = makeInMemoryStore({ logger: pino({ level: "silent" }) });
store.readFromFile(`${DATA_DIR}/store.json`);
setInterval(() => store.writeToFile(`${DATA_DIR}/store.json`), 10_000);

/**
 * Cria o socket do WhatsApp e gerencia todos os eventos da sessão.
 *
 * @param {string} usuario_id - ID do usuário autenticado no Supabase
 * @param {Function} [onQr] - Callback opcional para lidar com o QR Code
 * @returns {Promise<any>} - Retorna a instância do socket ou null se sessão inativa
 */
export async function criarSocket(usuario_id, onQr) {
  // 🚫 Bloqueia se a sessão estiver inativa
  const { data: sessao } = await supabase
    .from("sessao")
    .select("logado, conectado")
    .eq("usuario_id", usuario_id)
    .single();

  console.log(
    `[DEBUG] Resultado de supabase para sessao do ${usuario_id}:`,
    sessao
  );

  if (!sessao?.logado) {
    console.warn(`[LeadTalk] ❌ Usuário ${usuario_id} não está logado.`);
    return null;
  }

  const pasta = path.join("./auth", usuario_id);
  const arquivos = fs.existsSync(pasta) ? fs.readdirSync(pasta) : [];

  if (sessao?.logado === true && arquivos.length > 0) {
    console.warn(
      `[LeadTalk] ⚠️ Sessão já ativa para ${usuario_id}. Ignorando novo socket. Arquivos:`,
      arquivos
    );
    return null;
  }

  const pastaUsuario = path.join("./auth", usuario_id);

  if (!fs.existsSync(pastaUsuario)) {
    fs.mkdirSync(pastaUsuario, { recursive: true });
  }

  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState(pastaUsuario);

  console.log(
    "[DEBUG] 🧩 Criando socket com versão:",
    version,
    "usuário:",
    usuario_id
  );

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

  // Atualiza contatos locais
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

  // Gerencia eventos de conexão
  sock.ev.on(
    "connection.update",
    async ({ connection, qr, lastDisconnect }) => {
      if (qr && usuario_id) {
        await salvarQrNoSupabase(qr, usuario_id);
        onQr?.(qr);
        console.log("[LeadTalk] 📸 QR gerado:", qr.slice(0, 30));
      }

      if (connection === "open") {
        console.log(
          "[LeadTalk] ✅ Conexão aberta. Aguardando carregamento completo..."
        );

        await supabase.from("qr").delete().eq("usuario_id", usuario_id);

        await supabase
          .from("sessao")
          .update({ conectado: true })
          .eq("usuario_id", usuario_id);

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

        const contatosOk = await aguardarContatos();

        if (contatosOk) {
          await exportarContatos(store, usuario_id);
          await exportarGruposESuasPessoas(sock, store, usuario_id);

          // ✅ Evento esperado pelo frontend
          io?.to(usuario_id).emit("connection_open", { usuario_id });
        }
      }

      if (connection === "close") {
        const status = lastDisconnect?.error?.output?.statusCode;
        const deveReconectar = !status || status !== 401;

        if (deveReconectar) {
          console.log("🔄 Conexão perdida. Tentando reconectar...");

          const { data: sessaoReconectar } = await supabase
            .from("sessao")
            .select("logado")
            .eq("usuario_id", usuario_id)
            .single();

          if (sessaoReconectar?.logado) {
            setTimeout(() => criarSocket(usuario_id, onQr), 5000);
          } else {
            console.warn(
              "🛑 Sessão desativada durante desconexão. Não reconectar."
            );
          }
        } else {
          await supabase
            .from("sessao")
            .update({ conectado: false })
            .eq("usuario_id", usuario_id);

          console.log("🔒 Sessão encerrada e marcada como desconectada.");
        }
      }
    }
  );

  return sock;
}
