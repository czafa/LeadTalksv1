// backend/api/iniciar-leadtalk.js
import { applyCors } from "../lib/cors.js"; // <== certifique-se que esse import existe
import { supabase } from "../lib/supabase.js";
import { criarSocket } from "../core/socketManager.js";

export default async function handler(req, res) {
  // ✅ Adiciona CORS antes de qualquer lógica
  if (applyCors(res, req)) return;

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ erro: "Método não permitido" });
    }

    const { usuario_id } = req.body;
    if (!usuario_id) {
      return res.status(400).json({ erro: "Usuário ausente" });
    }

    console.log("[LeadTalk] Iniciando sessão para o usuário:", usuario_id);

    const { data: sessao } = await supabase
      .from("sessao")
      .select("ativo")
      .eq("usuario_id", usuario_id)
      .single();

    if (sessao?.ativo !== true) {
      console.log(
        `[LeadTalk] ❌ Sessão inativa para ${usuario_id}. Abortando criação do socket.`
      );
      return res.status(200).json({ iniciado: false });
    }

    await criarSocket(usuario_id); // <-- já estava correto
    return res.status(200).json({ iniciado: true });
  } catch (err) {
    console.error("[LeadTalk] Erro ao iniciar sessão:", err);
    return res.status(500).json({ erro: "Erro interno ao iniciar sessão" });
  }
}
