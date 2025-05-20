import { applyCors } from "../lib/cors.js";
import fetch from "node-fetch";
import { supabase } from "../lib/supabase.js";

export default async function handler(req, res) {
  console.log("📦 Requisição recebida em /api/qr");
  if (applyCors(res, req)) return;

  const usuario_id = req.query.usuario_id || req.body?.usuario_id;

  if (!usuario_id) {
    return res.status(400).json({ error: "usuario_id é obrigatório" });
  }

  try {
    // 1️⃣ Verifica se já há QR code recente
    const { data: qrAtivo } = await supabase
      .from("qr")
      .select("qr, criado_em")
      .eq("usuario_id", usuario_id)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    const qrAindaValido =
      qrAtivo && new Date(qrAtivo.criado_em).getTime() > Date.now() - 30000; // 30 segundos

    if (!qrAindaValido) {
      // 2️⃣ Inicia nova sessão apenas se necessário
      const { data, error } = await supabase
        .from("configuracoes")
        .select("valor")
        .eq("chave", "ngrok_url")
        .single();

      if (error || !data?.valor) {
        return res
          .status(500)
          .json({ error: "URL do whatsapp-core não encontrada" });
      }

      const apiUrl = data.valor;

      await fetch(`${apiUrl}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario_id }),
      });
    }

    // 3️⃣ Busca QR atualizado após aguardar um pouco (opcional)
    const { data: qrFinal } = await supabase
      .from("qr")
      .select("qr")
      .eq("usuario_id", usuario_id)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    return res.status(200).json(qrFinal || { qr: null });
  } catch (e) {
    console.error("❌ Erro no handler /api/qr:", e);
    return res.status(500).json({ error: "Erro ao buscar QR code" });
  }
}
