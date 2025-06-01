//GitHub/LeadTalksv1/backend/api/qr.js

import { applyCors } from "../lib/cors.js";
import fetch from "node-fetch";
import { supabase } from "../lib/supabase.js";

export default async function handler(req, res) {
  console.log("📦 [API /qr] Requisição recebida");

  if (applyCors(res, req)) return;

  const usuario_id = req.query.usuario_id || req.body?.usuario_id;

  // 🕵️ Log de rastreamento de origem
  const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  const userAgent = req.headers["user-agent"];
  const now = new Date().toISOString();

  console.log(
    `[QR Monitor] ${now} | usuario_id=${usuario_id} | IP=${ip} | UA=${userAgent}`
  );

  if (!usuario_id) {
    console.warn("[API /qr] ❌ Falta o parâmetro usuario_id");
    return res.status(400).json({ error: "usuario_id é obrigatório" });
  }

  try {
    // 1️⃣ Verifica QR válido nos últimos 30s
    const { data: qrAtivo, error: erroQr } = await supabase
      .from("qr")
      .select("qr, criado_em")
      .eq("usuario_id", usuario_id)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    const criadoEmMs = qrAtivo?.criado_em
      ? new Date(qrAtivo.criado_em).getTime()
      : 0;
    const agoraMs = Date.now();
    const qrAindaValido = criadoEmMs > agoraMs - 30000;

    console.log(
      `[API /qr] 🔍 QR atual: ${
        qrAindaValido ? "válido" : "inválido ou ausente"
      } | criado_em=${qrAtivo?.criado_em || "nenhum"}`
    );

    // 2️⃣ Se não for válido, aciona /start no backend local
    if (!qrAindaValido) {
      const { data: config, error: erroConfig } = await supabase
        .from("configuracoes")
        .select("valor")
        .eq("chave", "ngrok_url")
        .single();

      if (erroConfig || !config?.valor) {
        console.error(
          "[API /qr] ❌ Erro ao obter URL do backend local:",
          erroConfig
        );
        return res
          .status(500)
          .json({ error: "URL do whatsapp-core não encontrada" });
      }

      const apiUrl = config.valor;
      console.log(`[API /qr] 🔄 Requisitando novo QR via ${apiUrl}/start`);

      const resposta = await fetch(`${apiUrl}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario_id }),
      });

      if (!resposta.ok) {
        console.warn(
          `[API /qr] ⚠️ Falha ao chamar /start: HTTP ${resposta.status}`
        );
      }
    }

    // 3️⃣ Rebusca QR do Supabase (mesmo que o anterior)
    const { data: qrFinal, error: erroQrFinal } = await supabase
      .from("qr")
      .select("qr")
      .eq("usuario_id", usuario_id)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (erroQrFinal) {
      console.error("[API /qr] ❌ Erro ao buscar QR final:", erroQrFinal);
      return res.status(500).json({ error: "Erro ao buscar QR code" });
    }

    return res.status(200).json(qrFinal || { qr: null });
  } catch (e) {
    console.error("❌ [API /qr] Erro inesperado:", e);
    return res
      .status(500)
      .json({ error: "Erro ao processar requisição de QR" });
  }
}
