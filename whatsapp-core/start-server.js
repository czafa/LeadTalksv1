// start-server.js
import { createClient } from "@supabase/supabase-js";
import { exec } from "child_process";
import dotenv from "dotenv";
import fetch from "node-fetch";
import util from "util";
import { fileURLToPath } from "url";
import path from "path";

dotenv.config();
const execAsync = util.promisify(exec);

// 🔐 Cria cliente Supabase
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(process.env.SUPABASE_URL, SUPABASE_KEY);

async function iniciarNgrokEAtualizarSupabase() {
  console.log("🚀 Iniciando ngrok...");

  // Inicia o ngrok em segundo plano
  exec("ngrok http 3001 --log=stdout > /dev/null 2>&1 &");

  // Tenta capturar a URL por até 5 segundos
  let publicUrl;
  for (let i = 0; i < 10; i++) {
    try {
      const res = await fetch("http://127.0.0.1:4040/api/tunnels");
      const json = await res.json();
      publicUrl = json.tunnels[0]?.public_url;
      if (publicUrl) break;
    } catch (e) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  if (!publicUrl) {
    console.error("❌ Não foi possível obter a URL do ngrok.");
    process.exit(1);
  }

  console.log("🌍 Ngrok ativo em:", publicUrl);

  const { error } = await supabase
    .from("configuracoes")
    .upsert(
      { chave: "ngrok_url", valor: publicUrl },
      { onConflict: ["chave"] }
    );

  if (error) {
    console.error("❌ Falha ao atualizar Supabase:", error.message);
    process.exit(1);
  }

  console.log("✅ URL salva no Supabase.");
}

async function iniciarServidor() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  console.log("🟢 Iniciando servidor WhatsApp local...");
  exec(`node ${path.join(__dirname, "server.js")}`);
}

// Execução
(async () => {
  await iniciarNgrokEAtualizarSupabase();
  await iniciarServidor();
})();
