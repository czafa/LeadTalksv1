// backend/api/enviar.js
import { supabase } from "../lib/supabase.js";
import { getUserIdFromRequest } from "../lib/auth.js";

export default async function handler(req, res) {
  const allowedOrigins = ["https://lead-talksv1.vercel.app"];
  const origin = req.headers.origin;

  console.log(`[CORS DEBUG] Request Method: ${req.method}`);
  console.log(`[CORS DEBUG] Request Origin Header: ${origin}`);
  console.log(
    `[CORS DEBUG] allowedOrigins includes origin? : ${allowedOrigins.includes(
      origin
    )}`
  );

  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "");
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Authorization, Content-Type, Accept"
  );
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") return res.status(200).end();

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

  // 📨 1. Insere na fila do Supabase
  const { error } = await supabase
    .from("queue")
    .insert([
      { numero_destino: numero, nome, mensagem, enviado: false, usuario_id },
    ]);

  if (error) {
    console.error("[LeadTalk] ❌ Erro ao inserir na fila:", error);
    return res.status(500).json({ error: "Erro ao enfileirar mensagem" });
  }

  // 🌐 2. Recupera URL do backend local (ngrok ou IP fixo)
  const { data: configData, error: configError } = await supabase
    .from("configuracoes")
    .select("valor")
    .eq("chave", "ngrok_url")
    .single();

  if (configError || !configData?.valor) {
    return res
      .status(500)
      .json({ error: "URL do backend local não encontrada" });
  }

  const apiUrl = `${configData.valor}/api/enviar`;

  // 🔐 3. Repassa requisição ao backend local
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usuario_id,
        numero,
        mensagem,
        token: process.env.INTERNAL_API_KEY,
      }),
    });

    const resultado = await response.json();
    return res.status(response.status).json(resultado);
  } catch (err) {
    console.error("Erro ao enviar mensagem ao backend local:", err);
    return res
      .status(500)
      .json({ error: "Erro ao se comunicar com backend local" });
  }
}
