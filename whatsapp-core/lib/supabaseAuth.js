import { supabase } from "../supabase.js";

export async function supabaseAuthState(usuario_id) {
  let creds;

  // tentar carregar a sessão do Supabase
  const { data, error } = await supabase
    .from("sessao_baileys")
    .select("dados")
    .eq("usuario_id", usuario_id)
    .single();

  if (!error && data?.dados) {
    creds = data.dados;
  }

  return {
    state: {
      creds, // pode ser undefined, e isso é o que queremos
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
