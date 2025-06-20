//GitHub/LeadTalksv1/whatsapp-core/core/socketManager.js

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
console.log(
  "[DEBUG] Supabase client pronto:",
  typeof supabase.from === "function"
);

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
export async function criarSocket(usuario_id, onQr, io) {
  // 🚫 Bloqueia se a sessão estiver inativa
  const { data: sessao } = await supabase
    .from("sessao")
    .select("logado, conectado")
    .eq("usuario_id", usuario_id)
    .single();

  console.log(`[DEBUG - Supabase] Sessão obtida para ${usuario_id}:`, sessao);

  if (!sessao?.logado) {
    console.warn(
      `[LeadTalk] ❌ Sessão não está logada para ${usuario_id}. Abortando criação do socket.`
    );
    return null;
  }

  if (sessao?.conectado) {
    console.warn(`[LeadTalk] ⚠️ Sessão já conectada para ${usuario_id}.`);
    return null;
  }

  const pastaUsuario = path.join("./auth", usuario_id);

  if (!fs.existsSync(pastaUsuario)) {
    fs.mkdirSync(pastaUsuario, { recursive: true });
    console.log(`[FS] 📁 Criada pasta de autenticação: ${pastaUsuario}`);
  }

  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState(pastaUsuario);

  console.log(
    `[Baileys] 🧩 Iniciando socket na versão ${version} para ${usuario_id}`
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
    console.log(
      `[Baileys] 🔄 Recebida atualização de ${updates.length} contatos`
    );
    const contatosAtualizados = updates
      .filter((contato) => contato.id.endsWith("@s.whatsapp.net"))
      .map((contato) => ({
        nome: contato.notify || contato.name || contato.pushname || contato.id,
        numero: contato.id.split("@")[0],
        tipo: "contato",
        usuario_id,
      }));

    if (contatosAtualizados.length === 0) {
      console.log(
        "[Baileys] ⚠️ Nenhum contato com ID válido encontrado. Ignorando atualização."
      );
      return;
    }

    const arquivo = `./data/contatos_${usuario_id}.json`;
    let contatosExistentes = [];

    if (fs.existsSync(arquivo)) {
      try {
        const raw = fs.readFileSync(arquivo, "utf-8");
        contatosExistentes = JSON.parse(raw);
        console.log(
          `[Arquivo] 📁 Contatos existentes carregados de ${arquivo}`
        );
      } catch (err) {
        console.warn(`[Arquivo] ⚠️ Erro ao ler ${arquivo}: ${err.message}`);
      }
    }

    const novosContatos = contatosAtualizados.filter(
      (novo) => !contatosExistentes.some((c) => c.numero === novo.numero)
    );

    if (novosContatos.length === 0) {
      console.log("[LeadTalk] ℹ️ Nenhum novo contato foi adicionado.");
      return;
    }

    const todos = [...contatosExistentes, ...novosContatos];
    try {
      fs.writeFileSync(arquivo, JSON.stringify(todos, null, 2));
      console.log(
        `[Arquivo] ✅ ${novosContatos.length} novos contatos salvos em ${arquivo}`
      );
    } catch (err) {
      console.error(
        `[Arquivo] ❌ Erro ao salvar contatos em ${arquivo}: ${err.message}`
      );
    }
  });

  // Gerencia eventos de conexão
  sock.ev.on(
    "connection.update",
    async ({ connection, qr, lastDisconnect }) => {
      if (qr && usuario_id) {
        await salvarQrNoSupabase(qr, usuario_id);
        onQr?.(qr);
        console.log("[Baileys] 📸 QR gerado:", qr.slice(0, 30));
      }

      if (connection === "open") {
        console.log(
          "[Baileys] ✅ Conexão aberta. Aguardando carregamento completo..."
        );

        try {
          // Apaga QR antigo
          await supabase.from("qr").delete().eq("usuario_id", usuario_id);
          console.log("[Supabase] 🧹 QR antigo apagado da tabela `qr`.");

          // Atualiza sessão no Supabase
          console.log("[DEBUG - Supabase] Atualizando `conectado = true");
          const { error } = await supabase
            .from("sessao")
            .update({
              conectado: true,
              atualizado_em: new Date().toISOString(),
            })
            .eq("usuario_id", usuario_id);

          if (error) {
            console.error(
              "[Supabase] ❌ ERRO ao atualizar conectado no Supabase:",
              error
            );
          } else {
            console.log(
              "[Supabase] ✅ Sessão marcada como conectada no Supabase."
            );
          }

          // Aguarda contatos serem carregados
          const contatosCarregados = await aguardarContatos(store);
          if (contatosCarregados) {
            console.log("[LeadTalk] 🚀 Exportando contatos e grupos...");
            await exportarContatos(store, usuario_id);
            await exportarGruposESuasPessoas(sock, store, usuario_id);
            console.log("[LeadTalk] ✅ Exportações concluídas.");
          }

          // ✅ Emitir evento esperado pelo frontend
          if (io) {
            io.to(usuario_id).emit("connection_open", { usuario_id });
            console.log(
              `[Socket] 🔔 Evento connection_open emitido para ${usuario_id}`
            );
          }
        } catch (err) {
          console.error("[LeadTalk] ❌ Erro durante processo de conexão:", err);
        }
      }

      if (connection === "close") {
        const status = lastDisconnect?.error?.output?.statusCode;
        const deveReconectar = !status || status !== 401;

        if (deveReconectar) {
          console.log("[Baileys] 🔄 Conexão perdida. Tentando reconectar...");

          const { data: sessaoReconectar } = await supabase
            .from("sessao")
            .select("logado")
            .eq("usuario_id", usuario_id)
            .single();

          if (sessaoReconectar?.logado) {
            setTimeout(() => criarSocket(usuario_id, onQr, io), 5000);
          } else {
            console.warn(
              "[Supabase] 🛑 Sessão marcada como deslogada. Não reconectar."
            );
          }
        } else {
          await supabase
            .from("sessao")
            .update({ conectado: false })
            .eq("usuario_id", usuario_id);

          console.log(
            "[Supabase] 🔒 Sessão encerrada e marcada como desconectada."
          );
        }
      }
    }
  );

  // Função separada para aguardar carregamento de contatos
  async function aguardarContatos(store, timeout = 20000) {
    const start = Date.now();

    while (
      Object.keys(store.contacts).length === 0 &&
      Date.now() - start < timeout
    ) {
      console.log("[Baileys] ⏳ Aguardando sincronização dos contatos...");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const sucesso = Object.keys(store.contacts).length > 0;
    if (sucesso) {
      console.log("[Baileys] ✅ Contatos sincronizados com sucesso.");
    } else {
      console.warn(
        "[Baileys] ⚠️ Timeout: contatos não sincronizados após 20s."
      );
    }

    return sucesso;
  }

  return sock;
}
