// whatsapp-core/ngrok-sync.js
import { createClient } from "@supabase/supabase-js";
import { exec } from "child_process";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(process.env.SUPABASE_URL, SUPABASE_KEY);

async function iniciarNgrokEAtualizarSupabase() {
  console.log("🛑 Encerrando instâncias antigas do ngrok...");

  // ✅ PASSO 1: Garante que qualquer processo ngrok anterior seja encerrado.
  // O '|| true' previne um erro caso não haja nenhum processo a ser encerrado.
  try {
    await new Promise((resolve, reject) => {
      exec("pkill ngrok || true", (error, stdout, stderr) => {
        if (error && !error.message.includes("No process found")) {
          console.warn("Aviso ao tentar encerrar ngrok:", stderr);
        }
        resolve();
      });
    });
    // Pequena pausa para garantir que a porta foi liberada
    await new Promise((res) => setTimeout(res, 1000));
  } catch (e) {
    console.warn(
      "Não foi possível encerrar processos antigos do ngrok. Pode ser a primeira execução."
    );
  }

  console.log("🚀 Iniciando novo túnel ngrok...");

  // PASSO 2: Roda o ngrok em segundo plano
  exec("ngrok http 3001 --log=stdout > /dev/null 2>&1 &");

  // Aguarda ngrok estar pronto e tenta pegar a URL (tentativas por até 5 segundos)
  let publicUrl;
  for (let i = 0; i < 10; i++) {
    try {
      await new Promise((res) => setTimeout(res, 500)); // Espera antes de tentar
      const response = await fetch("http://127.0.0.1:4040/api/tunnels");
      const json = await response.json();
      publicUrl = json.tunnels[0]?.public_url;
      if (publicUrl && publicUrl.startsWith("https")) break; // Garante que pegamos a URL https
    } catch (err) {
      // Continua tentando...
    }
  }

  if (!publicUrl) {
    console.error(
      "❌ Falha ao capturar URL do ngrok. Verifique se o ngrok está instalado e autenticado."
    );
    process.exit(1);
  }

  console.log("🌍 Ngrok ativo em:", publicUrl);

  // PASSO 3: Salva no Supabase
  const { error } = await supabase.from("configuracoes").upsert(
    { chave: "ngrok_url", valor: publicUrl },
    { onConflict: "chave" } // Sintaxe onConflict um pouco mais limpa
  );

  if (error) {
    console.error("❌ Erro ao atualizar Supabase:", error.message);
    process.exit(1);
  }

  console.log("✅ URL salva no Supabase com sucesso.");
}

iniciarNgrokEAtualizarSupabase();
