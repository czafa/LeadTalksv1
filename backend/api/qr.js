// GitHub/LeadTalksv1/backend/api/qr.js

// 1. A importação foi trocada para a nova função
import { configurarCors } from "./_lib/cors.js";
import { supabase } from "./_lib/supabase.js";

/**
 * Esta API tem a responsabilidade ÚNICA de ler o QR code mais recente
 * para um usuário do banco de dados.
 */
export default async function handler(req, res) {
  // 2. Bloco de CORS antigo foi substituído por esta única linha
  if (configurarCors(req, res)) {
    return;
  }

  console.log("📦 [API /qr] Requisição recebida");

  // Extrai o ID do usuário da query string
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
    // 1. Consulta o banco de dados para o QR mais recente do usuário
    const { data: qrData, error } = await supabase
      .from("qr")
      .select("qr") // Seleciona apenas o campo 'qr', que é o que o frontend precisa
      .eq("usuario_id", usuario_id)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle(); // Retorna um único objeto ou null, evitando erros se não encontrar

    // 2. Trata erros na consulta ao banco de dados
    if (error) {
      console.error(
        "[API /qr] ❌ Erro ao buscar QR code no Supabase:",
        error.message
      );
      return res.status(500).json({ error: "Erro interno ao buscar QR code." });
    }

    // 3. Retorna o QR code encontrado ou null se não houver nenhum
    console.log(
      `[API /qr] ✅ QR encontrado para ${usuario_id}: ${qrData ? "Sim" : "Não"}`
    );
    return res.status(200).json({ qr: qrData?.qr || null });
  } catch (e) {
    console.error("❌ [API /qr] Erro inesperado no handler:", e);
    return res
      .status(500)
      .json({ error: "Erro ao processar a requisição de QR." });
  }
}
