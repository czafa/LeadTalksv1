// ngrok-sync.js
import { createClient } from "@supabase/supabase-js";
import { exec } from "child_process";
import dotenv from "dotenv";
import fetch from "node-fetch";
import util from "util";

dotenv.config();
const execAsync = util.promisify(exec);

// 🔐 Cria cliente Supabase
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(process.env.SUPABASE_URL, SUPABASE_KEY);

async function iniciarNgrokEAtualizarSupabase() {
  console.log("🚀 Iniciando ngrok...");

  // Roda ngrok em segundo plano, sem log poluindo o terminal
  exec("ngrok http 3001 --log=stdout > /dev/null 2>&1 &");

  // Aguarda ngrok estar pronto e tentar pegar a URL (tentativas por até 5 segundos)
  let publicUrl;
  for (let i = 0; i < 10; i++) {
    try {
      const response = await fetch("http://127.0.0.1:4040/api/tunnels");
      const json = await response.json();
      publicUrl = json.tunnels[0]?.public_url;
      if (publicUrl) break;
    } catch (err) {
      // aguarda meio segundo antes de tentar de novo
      await new Promise((res) => setTimeout(res, 500));
    }
  }

  if (!publicUrl) {
    console.error("❌ Falha ao capturar URL do ngrok.");
    process.exit(1);
  }

  console.log("🌍 Ngrok ativo em:", publicUrl);

  // Salva no Supabase
  const { error } = await supabase
    .from("configuracoes")
    .upsert(
      { chave: "ngrok_url", valor: publicUrl },
      { onConflict: ["chave"] }
    );

  if (error) {
    console.error("❌ Erro ao atualizar Supabase:", error.message);
    process.exit(1);
  }

  console.log("✅ URL salva no Supabase com sucesso.");
}

iniciarNgrokEAtualizarSupabase();
