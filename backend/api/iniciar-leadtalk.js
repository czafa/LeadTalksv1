// backend/api/iniciar-leadtalk.js (em Express ou Vercel API)
import { createClient } from "@supabase/supabase-js";
import { startLeadTalk } from "../../whatsapp-core/leadtalks.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) return res.status(401).json({ error: "Token não fornecido" });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "Token inválido" });

  // ✅ Agora temos o usuario_id autenticado
  const usuario_id = user.id;

  try {
    await startLeadTalk({ usuario_id });
    res.status(200).json({ message: "Processo iniciado com sucesso" });
  } catch (e) {
    res.status(500).json({ error: "Erro ao iniciar LeadTalk" });
  }
}
