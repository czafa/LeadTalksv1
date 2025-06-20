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
