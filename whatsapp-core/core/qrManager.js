// core/qrManager.js
import { supabase } from "../supabase.js";

/**
 * Salva o QR Code no Supabase.
 */
export async function salvarQrNoSupabase(qr, usuario_id) {
  const { error } = await supabase.from("qr").upsert(
    {
      usuario_id,
      qr,
      criado_em: new Date().toISOString(),
    },
    { onConflict: ["usuario_id"] }
  );

  if (error) {
    console.error("❌ Erro ao salvar QR no Supabase:", error);
  } else {
    console.log(`[LeadTalk] 📤 QR salvo no Supabase para ${usuario_id}`);
  }
}

/**
 * Marca a sessão como ativa.
 */
export async function marcarSessaoAtiva(usuario_id) {
  const { error } = await supabase
    .from("sessao")
    .update({ ativo: true, atualizado_em: new Date() })
    .eq("usuario_id", usuario_id);

  if (error) {
    console.error("❌ Falha ao marcar sessão como ativa:", error);
  } else {
    console.log(`[LeadTalk] 🟢 Sessão marcada como ativa para ${usuario_id}`);
  }
}

/**
 * Marca a sessão como inativa.
 */
export async function marcarSessaoInativa(usuario_id) {
  const { error } = await supabase
    .from("sessao")
    .update({ ativo: false, atualizado_em: new Date() })
    .eq("usuario_id", usuario_id);

  if (error) {
    console.error("❌ Falha ao marcar sessão como inativa:", error);
  } else {
    console.log(`[LeadTalk] 🔴 Sessão marcada como inativa para ${usuario_id}`);
  }
}
