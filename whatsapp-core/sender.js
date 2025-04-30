import { supabase } from "./supabase.js";
import { makeWASocket, useMultiFileAuthState } from "@whiskeysockets/baileys";
import P from "pino";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const authPath = path.resolve("auth");
const isProd = process.env.ENV_MODE === "production";

function log(msg) {
  const timestamp = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
  console.log(`[${timestamp}] ${msg}`);
}

function personalizarMensagem(template, nome) {
  return template.replace(/{{\s*nome\s*}}/gi, nome);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function enviarMensagens() {
  log("🔄 Buscando mensagens na fila...");
  const { data: mensagens, error } = await supabase
    .from("queue")
    .select("*")
    .eq("enviado", false);

  if (error) {
    console.error("Erro ao buscar fila:", error);
    return;
  }

  if (!mensagens.length) {
    log("🚫 Nenhuma mensagem pendente.");
    return;
  }

  const { state, saveCreds } = await useMultiFileAuthState(authPath);
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: P({ level: "silent" }),
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection }) => {
    if (connection === "open") {
      log("✅ Conectado ao WhatsApp");

      for (const msg of mensagens) {
        const jid = `${msg.numero_destino.replace(
          /[^\d]/g,
          ""
        )}@s.whatsapp.net`;
        const texto = personalizarMensagem(
          msg.mensagem,
          msg.nome || msg.numero_destino
        );

        try {
          await sock.sendMessage(jid, { text: texto });
          log(`✅ Mensagem enviada para ${msg.numero_destino}`);

          await supabase
            .from("queue")
            .update({
              enviado: true,
              data_envio: new Date().toISOString(),
            })
            .eq("id", msg.id);
        } catch (err) {
          console.error(
            `❌ Erro ao enviar para ${msg.numero_destino}:`,
            err.message
          );
        }

        const espera = 10000 + Math.floor(Math.random() * 5000); // intervalo variável
        await delay(espera);
      }

      log("🏁 Fim da fila.");
      process.exit(0);
    }

    if (connection === "close") {
      log("❌ Conexão com WhatsApp encerrada.");
      process.exit(1);
    }
  });
}

enviarMensagens();
