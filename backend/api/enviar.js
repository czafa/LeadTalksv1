// backend/api/enviar.js
import { applyCors } from "../lib/cors.js";
import { supabase } from "../lib/supabase.js";

export default async function handler(req, res) {
  if (applyCors(res, req)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "Token ausente" });
  }

  const { data: userData, error: authError } = await supabase.auth.getUser(
    token
  );

  if (authError || !userData?.user?.id) {
    return res.status(401).json({ error: "Usuário inválido" });
  }

  const { numero, mensagem } = req.body;

  if (!numero || !mensagem) {
    return res.status(400).json({ error: "Parâmetros obrigatórios ausentes" });
  }

  // Buscar URL do whatsapp-core (ngrok ou fixo)
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

  const apiUrl = `${data.valor}/api/enviar`;

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numero, mensagem }),
    });

    const resultado = await response.json();
    return res.status(response.status).json(resultado);
  } catch (err) {
    console.error("Erro ao enviar mensagem:", err);
    return res
      .status(500)
      .json({ error: "Erro ao se comunicar com whatsapp-core" });
  }
}
