import { supabase } from "../supabase.js";

export async function upsertContatos(contatos) {
  if (contatos.length === 0) return;
  const { error } = await supabase.from("contatos").upsert(contatos, {
    onConflict: ["usuario_id", "numero"],
  });
  if (error)
    console.error("[LeadTalk] ❌ Erro ao salvar contatos:", error.message);
}

export async function upsertGrupos(grupos) {
  if (grupos.length === 0) return;
  // Renomeia jid para grupo_jid
  const ajustados = grupos.map((g) => ({
    ...g,
    grupo_jid: g.jid,
  }));

  const { error } = await supabase.from("grupos").upsert(ajustados, {
    onConflict: ["usuario_id", "grupo_jid"],
  });
  if (error)
    console.error("[LeadTalk] ❌ Erro ao salvar grupos:", error.message);
}

export async function upsertMembros(membrosPorGrupo) {
  const registros = [];

  for (const [grupo_jid, membros] of Object.entries(membrosPorGrupo)) {
    membros.forEach((m) => {
      registros.push({
        usuario_id: m.usuario_id,
        grupo_jid,
        membro_nome: m.membro_nome || m.numero || m.jid,
        membro_numero: m.membro_numero || m.numero || m.jid.split("@")[0],
        admin: String(m.admin).toLowerCase().includes("admin"), // <== Aqui convertemos para booleano
      });
    });
  }

  if (registros.length === 0) return;

  const { error } = await supabase.from("membros_grupos").upsert(registros, {
    onConflict: ["usuario_id", "grupo_jid", "membro_numero"],
  });

  if (error) {
    console.error("[LeadTalk] ❌ Erro ao salvar membros:", error.message);
  }
}
