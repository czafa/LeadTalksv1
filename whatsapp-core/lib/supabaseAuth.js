import { supabase } from "..supabase.js"; // ajuste o caminho se necessário

export async function supabaseAuthState(usuario_id) {
  let creds = {};

  // tenta carregar a sessão armazenada no Supabase
  const { data, error } = await supabase
    .from("sessao_baileys")
    .select("dados")
    .eq("usuario_id", usuario_id)
    .single();

  if (!error && data) {
    creds = data.dados;
  }

  return {
    state: {
      creds,
      keys: {},
    },
    async saveCreds() {
      await supabase.from("sessao_baileys").upsert({
        usuario_id,
        dados: creds,
        atualizado_em: new Date().toISOString(),
      });
    },
  };
}
