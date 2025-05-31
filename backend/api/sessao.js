import { applyCors } from "../lib/cors.js";
import { supabase } from "../lib/supabase.js";
import { validarRequisicaoSessao } from "../lib/secureRequest.js";

export default async function handler(req, res) {
  console.log("Origin recebida:", req.headers.origin);
  console.log("Ambiente:", process.env.NODE_ENV);

  if (applyCors(res, req)) return;

  try {
    // === POST: Atualiza a sessão no Supabase ===
    if (req.method === "POST") {
      const validacao = await validarRequisicaoSessao(req);

      if (!validacao.autorizado) {
        return res.status(validacao.status).json({ erro: validacao.erro });
      }

      const { usuario_id } = validacao;
      const ativo = req.body?.ativo ?? true;

      const { error } = await supabase.from("sessao").upsert(
        {
          usuario_id,
          ativo,
          atualizado_em: new Date(),
        },
        { onConflict: ["usuario_id"] }
      );

      if (error) {
        console.error("Erro ao atualizar sessão:", error);
        return res.status(500).json({ erro: "Erro ao atualizar sessão" });
      }

      return res.status(200).json({ atualizado: true });
    }

    // === GET: Verifica se a sessão está ativa ===
    if (req.method === "GET") {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) {
        return res.status(401).json({ erro: "Token ausente" });
      }

      const { data: userData, error: authError } = await supabase.auth.getUser(
        token
      );
      if (authError || !userData?.user?.id) {
        return res.status(401).json({ erro: "Usuário inválido" });
      }

      const { data: sessao } = await supabase
        .from("sessao")
        .select("ativo")
        .eq("usuario_id", userData.user.id)
        .single();

      return res.status(200).json({ ativo: !!sessao?.ativo });
    }

    return res.status(405).json({ erro: "Método não permitido" });
  } catch (err) {
    console.error("Erro em /api/sessao:", err);
    return res.status(500).json({ erro: "Erro interno no servidor" });
  }
}
