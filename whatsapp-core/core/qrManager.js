// core/qrManager.js
import { supabase } from "../supabase.js";

/**
 * Salva o QR Code no Supabase, permitindo que o frontend o acesse.
 *
 * @param {string} qr - QR code gerado pela sessão
 * @param {string} usuario_id - ID do usuário autenticado
 */
export async function salvarQrNoSupabase(qr, usuario_id) {
  await supabase.from("qr").upsert(
    {
      usuario_id,
      qr,
      criado_em: new Date().toISOString(),
    },
    { onConflict: ["usuario_id"] }
  );

  console.log(`[LeadTalk] 📤 QR salvo no Supabase para ${usuario_id}`);
}

/**
 * Marca a sessão do usuário como ativa na tabela "sessao".
 *
 * @param {string} usuario_id - ID do usuário autenticado
 */
export async function marcarSessaoAtiva(usuario_id) {
  await supabase.from("sessao").upsert(
    {
      usuario_id,
      ativo: true,
    },
    { onConflict: ["usuario_id"] }
  );

  console.log(`[LeadTalk] 🟢 Sessão marcada como ativa para ${usuario_id}`);
}

/**
 * Marca a sessão do usuário como inativa na tabela "sessao".
 *
 * @param {string} usuario_id - ID do usuário autenticado
 */
export async function marcarSessaoInativa(usuario_id) {
  await supabase.from("sessao").upsert(
    {
      usuario_id,
      ativo: false,
    },
    { onConflict: ["usuario_id"] }
  );

  console.log(`[LeadTalk] 🔴 Sessão marcada como inativa para ${usuario_id}`);
}
