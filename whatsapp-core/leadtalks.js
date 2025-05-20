// Importa variáveis de ambiente de um arquivo .env
import dotenv from "dotenv";
// Importa o módulo de sistema de arquivos
import fs from "fs";
// Importa módulo para manipulação de caminhos
import path from "path";
// Para obter __dirname em ES Modules
import { fileURLToPath } from "url";
// Logger pino para logs silenciosos
import pino from "pino";
// Importa o módulo crypto (criptografia)
import crypto from "crypto";
// Importa a biblioteca Boom para tratar erros
import { Boom } from "@hapi/boom";
// Importa funções principais do Baileys
import {
  makeWASocket,
  useMultiFileAuthState,
  makeInMemoryStore,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
// Cliente Supabase
import { createClient } from "@supabase/supabase-js";
// Função customizada para autenticação com Supabase
import { supabaseAuthState } from "./lib/supabaseAuth.js";
// Função para setar o QR gerado
import { setQrCode } from "./qrStore.js";

// Mapa de controle de status por usuário (evita múltiplas execuções simultâneas)
const leadTalkStatusMap = new Map();

// Corrige __dirname em ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega variáveis de ambiente
dotenv.config();
// Corrige "crypto" no escopo global se não estiver definido
if (!globalThis.crypto) globalThis.crypto = crypto.webcrypto;

// Inicializa cliente Supabase com chave de serviço (permite escrita)
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(process.env.SUPABASE_URL, SUPABASE_KEY);

// Verifica se estamos em ambiente de produção
const isProd = process.env.ENV_MODE === "production";
console.log(`Modo: ${process.env.ENV_MODE}`);

// Cria diretório local para armazenar dados temporários (cache/debug)
const DATA_DIR = path.resolve(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Cria store em memória para os eventos do WhatsApp
const store = makeInMemoryStore({
  logger: pino({ level: "silent" }).child({ stream: "store" }),
});
// Lê dados anteriores salvos em disco
store.readFromFile(path.join(DATA_DIR, "store.json"));
// Salva em disco o store a cada 10 segundos
setInterval(() => store.writeToFile(path.join(DATA_DIR, "store.json")), 10000);

// Função auxiliar para salvar arquivos de debug (contatos, grupos e membros)
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

// Função para aguardar o carregamento de contatos
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

// Função principal que inicia a conexão com o WhatsApp via Baileys
export async function startLeadTalk({ usuario_id, onQr }) {
  console.log(`[LeadTalk] Iniciando conexão para usuario_id: ${usuario_id}`);

  // Verifica se já existe uma conexão em andamento para o usuário
  if (leadTalkStatusMap.get(usuario_id) === "running") {
    console.log(`⛔ Conexão já em andamento para ${usuario_id}. Abortando.`);
    return;
  }
  leadTalkStatusMap.set(usuario_id, "running");

  //Verificar se já existe sessão ativa no início de startLeadTalk
  const { data: sessaoAtiva, error } = await supabase
    .from("sessao")
    .select("ativo")
    .eq("usuario_id", usuario_id);

  if (sessaoAtiva[0]?.ativo) {
    console.log("⚠️ Sessão já ativa no Supabase. Abortando nova instância.");
    leadTalkStatusMap.delete(usuario_id);
    return;
  }

  // Busca a versão mais recente do WhatsApp compatível com Baileys
  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await supabaseAuthState(usuario_id);
  const { creds } = state;

  // Se não houver sessão salva, gera QR para login
  if (!creds?.me) {
    console.warn(
      "[LeadTalk] ⚠️ Nenhuma sessão encontrada. Gerando QR temporário..."
    );

    const tempSock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true,
      logger: pino({ level: "silent" }),
    });

    tempSock.ev.on("creds.update", saveCreds);

    tempSock.ev.on("connection.update", async ({ connection, qr }) => {
      if (qr && usuario_id) {
        console.log("[LeadTalk] 📸 QR gerado (sessão nova):", qr.slice(0, 30));

        const { error } = await supabase
          .from("qr")
          .upsert(
            { usuario_id, qr, criado_em: new Date().toISOString() },
            { onConflict: ["usuario_id"] }
          );

        if (error) {
          console.error("❌ Falha ao salvar QR no Supabase:", error.message);
        }

        onQr?.(qr);
      }

      if (connection === "open" && tempSock.user?.id) {
        console.log("✅ Sessão criada com sucesso. Encerrando tempSock.");
        await supabase.from("qr").delete().eq("usuario_id", usuario_id);
        await tempSock.logout();
        tempSock.ev.removeAllListeners();

        // Atualiza o estado da sessão no Supabase
        leadTalkStatusMap.set(usuario_id, "done");

        // Somente agora prossegue para conexão real
        return startLeadTalk({ usuario_id, onQr });
      }

      if (connection === "close") {
        console.log("🔒 tempSock desconectado (sem retry automático).");
        leadTalkStatusMap.set(usuario_id, "done");
      }
    });

    return; // interrompe a função até o login acontecer
  }

  // Cria socket Baileys com sessão ativa
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    logger: pino({ level: "silent" }),
    syncFullHistory: true,
    generateHighQualityLinkPreview: true,
    markOnlineOnConnect: true,
  });

  // Trata eventos de conexão com WhatsApp
  sock.ev.on(
    "connection.update",
    async ({ connection, qr, lastDisconnect }) => {
      if (qr && usuario_id) {
        console.log("[LeadTalk] 📸 QR GERADO:", qr.slice(0, 30));
        await supabase
          .from("qr")
          .upsert(
            { usuario_id, qr, criado_em: new Date().toISOString() },
            { onConflict: ["usuario_id"] }
          );

        onQr?.(qr);
      }

      if (connection === "close") {
        const shouldReconnect =
          lastDisconnect?.error instanceof Boom &&
          lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;

        console.log("🔁 Conexão encerrada. Reconectar:", shouldReconnect);

        if (shouldReconnect) {
          setTimeout(() => startLeadTalk({ usuario_id, onQr }), 15000);
        } else {
          await supabase
            .from("sessao")
            .upsert(
              { usuario_id, ativo: false },
              { onConflict: ["usuario_id"] }
            );
          console.log("🔒 Sessão encerrada, marcada como inativa.");
        }
      }

      if (connection === "open") {
        console.log("✅ Conectado ao WhatsApp");
        await supabase.from("qr").delete().eq("usuario_id", usuario_id);
        await supabase
          .from("sessao")
          .upsert({ usuario_id, ativo: true }, { onConflict: ["usuario_id"] });

        if (await aguardarContatos()) {
          await exportarContatos(usuario_id);
        }

        await new Promise((r) => setTimeout(r, 5000));
        await exportarGruposESuasPessoas(sock, usuario_id);
      }
    }
  );

  // Atualiza credenciais quando mudam
  sock.ev.on("creds.update", saveCreds);
  // Liga o store ao socket
  store.bind(sock.ev);

  // Trata atualizações de contatos
  sock.ev.on("contacts.update", async (updates) => {
    const contatos = updates
      .filter((c) => c.id.endsWith("@s.whatsapp.net"))
      .map((c) => ({
        nome: c.notify || c.name || c.pushname || c.id,
        numero: c.id.split("@")[0],
        tipo: "contato",
        usuario_id,
      }));

    if (contatos.length) {
      debugSalvarArquivosLocais({ contatos });
      const { error } = await supabase
        .from("contatos")
        .upsert(contatos, { onConflict: ["numero", "usuario_id"] });
      if (error) console.error("❌ Erro ao upsert contatos:", error.message);
      else console.log(`☑️ ${contatos.length} contatos upseridos.`);
    }
  });

  leadTalkStatusMap.set(usuario_id, "done");
  return sock;
}

// Exporta contatos presentes no store para o Supabase
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

// Exporta grupos e participantes usando metadata
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
