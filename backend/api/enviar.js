// backend/api/enviar.js
import { applyCors } from "../lib/cors.js";
import { supabase } from "../lib/supabase.js";
import { getUserIdFromRequest } from "../lib/auth.js";
import { getNgrokUrl } from "../lib/getNgrokUrl.js";

export default async function handler(req, res) {
  if (applyCors(res, req)) return; // 🌐 Middleware centralizado

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const usuario_id = await getUserIdFromRequest(req);
  if (!usuario_id) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  const { numero, nome, mensagem } = req.body;

  if (!numero || !mensagem) {
    return res
      .status(400)
      .json({ error: "Número e mensagem são obrigatórios" });
  }

  const { error } = await supabase
    .from("queue")
    .insert([
      { numero_destino: numero, nome, mensagem, enviado: false, usuario_id },
    ]);

  if (error) {
    console.error("[LeadTalk] ❌ Erro ao inserir na fila:", error);
    return res.status(500).json({ error: "Erro ao enfileirar mensagem" });
  }

  try {
    const apiUrl = await getNgrokUrl();
    const response = await fetch(`${apiUrl}/api/enviar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario_id, numero, mensagem }),
    });

    const resultado = await response.json();
    return res.status(response.status).json(resultado);
  } catch (err) {
    console.error("Erro ao comunicar com backend local:", err);
    return res.status(500).json({ error: "Erro na comunicação local" });
  }
}
