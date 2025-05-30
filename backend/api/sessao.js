import { applyCors } from "../lib/cors.js";
import { supabase } from "../lib/supabase.js";

export default async function handler(req, res) {
  console.log("Origin recebida:", req.headers.origin);
  console.log("Ambiente:", process.env.NODE_ENV);

  if (applyCors(res, req)) return;

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

    const usuario_id = userData.user.id;

    // ✅ Se for POST com body → atualizar sessão
    if (req.method === "POST") {
      const body = req.body;

      if (body && "ativo" in body) {
        const { ativo } = body;

        const { error: upsertError } = await supabase.from("sessao").upsert(
          {
            usuario_id,
            ativo,
            atualizado_em: new Date(),
          },
          { onConflict: ["usuario_id"] }
        );

        if (upsertError) {
          console.error("Erro ao atualizar sessão:", upsertError);
          return res.status(500).json({ erro: "Erro ao atualizar sessão" });
        }

        return res.status(200).json({ atualizado: true });
      }

      // 🔍 Caso contrário, só retorna a situação atual
      const { data: sessao } = await supabase
        .from("sessao")
        .select("ativo")
        .eq("usuario_id", usuario_id)
        .single();

      return res.status(200).json({ ativo: !!sessao?.ativo });
    }

    return res.status(405).json({ erro: "Método não permitido" });
  } catch (err) {
    console.error("Erro em /api/sessao:", err);
    return res.status(500).json({ erro: "Erro interno no servidor" });
  }
}
