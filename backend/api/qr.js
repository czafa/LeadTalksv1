// GitHub/LeadTalksv1/backend/api/qr.js

import { applyCors } from "../lib/cors.js";
import fetch from "node-fetch";
import { supabase } from "../lib/supabase.js";
import { getNgrokUrl } from "../lib/getNgrokUrl.js";

export default async function handler(req, res) {
  console.log("📦 [API /qr] Requisição recebida");

  if (req.method === "OPTIONS") {
    applyCors(res, req);
    return;
  }
  applyCors(res, req);

  const usuario_id = req.query.usuario_id || req.body?.usuario_id;

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
    // 🔍 Verifica QR recente
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

    // 🔁 Se não houver QR válido, requisita geração no backend
    if (!qrAindaValido) {
      const apiUrl = await getNgrokUrl();
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

    // 📥 Busca QR do Supabase (após tentar iniciar nova sessão)
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
