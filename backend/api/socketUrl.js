// backend/api/socket-url.js

// 1. A importação foi trocada para a nova função
import { configurarCors } from "./_lib/cors.js";
import { supabase } from "./_lib/supabase.js";

export default async function handler(req, res) {
  // 2. A chamada de CORS foi atualizada para o novo padrão
  if (configurarCors(req, res)) {
    return;
  }

  const { data, error } = await supabase
    .from("configuracoes")
    .select("valor")
    .eq("chave", "ngrok_url")
    .single();

  if (error || !data?.valor) {
    return res.status(500).json({ error: "Erro ao buscar socket URL" });
  }

  return res.status(200).json({ socketUrl: data.valor });
}
