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

  // Inicia o túnel ngrok na porta 3000
  const ngrokProcess = exec("ngrok http 3000");

  // Aguarda o túnel ser criado (tempo seguro: 3s)
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Obtém a URL pública via API local do ngrok
  try {
    const response = await fetch("http://127.0.0.1:4040/api/tunnels");
    const json = await response.json();

    const publicUrl = json.tunnels[0]?.public_url;
    if (!publicUrl) throw new Error("URL pública não encontrada");

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
  } catch (err) {
    console.error("❌ Falha ao capturar URL do ngrok:", err.message);
    process.exit(1);
  }
}

iniciarNgrokEAtualizarSupabase();
