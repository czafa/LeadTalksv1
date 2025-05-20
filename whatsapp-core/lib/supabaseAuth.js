// whatsapp-core/lib/supabaseAuth.js
import { supabase } from "../supabase.js";
import { useMultiFileAuthState } from "@whiskeysockets/baileys";
import path from "path";
import fs from "fs";

// Diretório local onde o Baileys salva as sessões temporárias
const SESSAO_DIR = "./temp_sessao";
if (!fs.existsSync(SESSAO_DIR)) {
  fs.mkdirSync(SESSAO_DIR, { recursive: true });
}

export async function supabaseAuthState(usuario_id) {
  const sessaoPath = path.join(SESSAO_DIR, usuario_id);

  const { state, saveCreds: originalSaveCreds } = await useMultiFileAuthState(
    sessaoPath
  );

  // Tenta carregar do Supabase
  const { data, error } = await supabase
    .from("sessao_baileys")
    .select("dados")
    .eq("usuario_id", usuario_id)
    .single();

  if (!error && data?.dados) {
    console.log("✅ Sessão carregada do Supabase.");
    Object.assign(state.creds, data.dados); // mantém estrutura e referências
    console.log("🧪 state.creds.me =", state.creds?.me);
  } else {
    console.warn("⚠️ Nenhuma sessão no Supabase. Nova será criada.");
  }

  async function saveCreds() {
    await originalSaveCreds(); // salva localmente
    console.log("🧪 Salvando state.creds.me:", state.creds?.me);
    await supabase.from("sessao_baileys").upsert({
      usuario_id,
      dados: state.creds,
      atualizado_em: new Date().toISOString(),
    });
    console.log("💾 Sessão salva no Supabase.");
  }

  return { state, saveCreds };
}
