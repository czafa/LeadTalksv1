// whatsapp-core/core/supabaseSync.js

import { supabase } from "../supabase.js";

export async function upsertContatos(contatos) {
  if (!contatos || contatos.length === 0) return;
  const { error } = await supabase.from("contatos").upsert(contatos, {
    onConflict: "usuario_id, numero", // onConflict espera uma string com os nomes das colunas
  });
  if (error)
    console.error("[LeadTalk] ❌ Erro ao salvar contatos:", error.message);
}

export async function upsertGrupos(grupos) {
  if (!grupos || grupos.length === 0) return;

  const { error } = await supabase.from("grupos").upsert(grupos, {
    onConflict: "usuario_id, grupo_jid",
  });
  if (error)
    console.error("[LeadTalk] ❌ Erro ao salvar grupos:", error.message);
}

// ✅ FUNÇÃO CORRIGIDA E SIMPLIFICADA
export async function upsertMembros(membrosParaSalvar) {
  // A função agora recebe um array simples e o insere diretamente.
  if (!membrosParaSalvar || membrosParaSalvar.length === 0) return;

  const { error } = await supabase
    .from("membros_grupos")
    .upsert(membrosParaSalvar, {
      onConflict: "usuario_id, grupo_jid, membro_numero",
    });

  if (error) {
    console.error("[LeadTalk] ❌ Erro ao salvar membros:", error.message);
  }
}
