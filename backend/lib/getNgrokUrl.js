// backend/lib/getNgrokUrl.js
import { supabase } from "./supabase.js";

export async function getNgrokUrl() {
  const { data, error } = await supabase
    .from("configuracoes")
    .select("valor")
    .eq("chave", "ngrok_url")
    .single();

  if (error || !data?.valor) {
    throw new Error("URL do backend local (ngrok) não encontrada.");
  }

  return data.valor;
}
