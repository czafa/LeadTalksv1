import { applyCors } from "../lib/cors.js";
import { supabase } from "../lib/supabase.js";

export default async function handler(req, res) {
  console.log("Origin recebida:", req.headers.origin);
  console.log("Ambiente:", process.env.NODE_ENV);

  if (applyCors(res, req)) return; // Handle CORS preflight

  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token)
      return res.status(401).json({ ativo: false, erro: "Token ausente" });

    const { data: userData, error: authError } = await supabase.auth.getUser(
      token
    );

    if (authError || !userData?.user?.id) {
      return res.status(401).json({ ativo: false, erro: "Usuário inválido" });
    }

    const { data: sessao } = await supabase
      .from("sessao")
      .select("ativo")
      .eq("usuario_id", userData.user.id)
      .single();

    return res.status(200).json({ ativo: !!sessao?.ativo });
  } catch (err) {
    console.error("Erro em /api/sessao:", err);
    return res.status(500).json({ erro: "Erro interno no servidor" });
  }
}
