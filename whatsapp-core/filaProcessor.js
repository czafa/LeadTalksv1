// whatsapp-core/filaProcessor.js
import dotenv from "dotenv";
import { supabase } from "./supabase.js";
import { sender } from "./sender.js";

dotenv.config();

async function processarFila() {
  console.log("[Fila] ⏳ Verificando mensagens pendentes...");

  const { data, error } = await supabase
    .from("queue")
    .select("*")
    .eq("enviado", false)
    .order("data_envio", { ascending: true }) // envia em ordem
    .limit(5);

  if (error) {
    console.error("[Fila] ❌ Erro ao buscar mensagens:", error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log("[Fila] ✅ Nenhuma mensagem pendente.");
    return;
  }

  for (const item of data) {
    try {
      await sender.enviarMensagem(item.numero_destino, item.mensagem);

      await supabase
        .from("queue")
        .update({ enviado: true, data_envio: new Date() })
        .eq("id", item.id);

      console.log(`[Fila] ✅ Mensagem enviada para ${item.numero_destino}`);
    } catch (err) {
      console.error(
        `[Fila] ❌ Erro ao enviar para ${item.numero_destino}:`,
        err.message
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 8000)); // ⏱️ Delay seguro
  }
}

// ♻️ Executa a cada 30 segundos
setInterval(processarFila, 30000);
