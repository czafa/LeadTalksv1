import { supabase } from "../lib/supabase.js";

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "Token ausente" });
  }

  try {
    // Valida o token e obtém o usuário autenticado
    const { data: userData, error: authError } = await supabase.auth.getUser(
      token
    );

    if (authError || !userData?.user?.id) {
      console.error("❌ Erro de autenticação:", authError);
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    const usuario_id = userData.user.id;

    // Consulta segura da sessão do usuário autenticado
    const { data, error } = await supabase
      .from("sessao")
      .select("ativo")
      .eq("usuario_id", usuario_id)
      .single();

    if (error) {
      console.error("❌ Erro Supabase (sessao.js):", error);
      return res.status(500).json({ error: "Erro ao verificar sessão" });
    }

    return res.status(200).json({ ativo: data?.ativo || false });
  } catch (err) {
    console.error("❌ Erro inesperado (sessao.js):", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}
