// backend/api/socketUrl.js

import { configurarCors } from "./_lib/cors.js";
import { supabase } from "./_lib/supabase.js";

export default async function handler(req, res) {
  if (configurarCors(req, res)) {
    return;
  }

  // Sugestão 2: Adicionar Log de Início
  console.log("📦 [API /socketUrl] Requisição recebida");

  // Sugestão 1: Envolver em try...catch
  try {
    const { data, error } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "ngrok_url")
      .single();

    if (error || !data?.valor) {
      // Sugestão 2: Adicionar Log de Erro
      console.error(
        "❌ [API /socketUrl] Erro ao buscar socket URL do Supabase:",
        error
      );
      return res.status(500).json({ error: "Erro ao buscar socket URL" });
    }

    // Sugestão 2: Adicionar Log de Sucesso
    console.log("✅ [API /socketUrl] URL do socket encontrada e retornada.");
    return res.status(200).json({ socketUrl: data.valor });
  } catch (err) {
    console.error("❌ [API /socketUrl] Erro inesperado no handler:", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
}
