import { useState } from "react";
import { supabase } from "../lib/supabase";
import QRCode from "qrcode";

export function useQr() {
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function carregarQr(usuarioId: string, canvas?: HTMLCanvasElement) {
    if (!usuarioId) {
      console.warn("[QR] 🚫 Usuário ID inválido. Abortando QR.");
      setStatusMsg("❌ Usuário inválido.");
      return;
    }

    console.log(
      `[QR] 🔄 Iniciando carregamento do QR para usuario_id: ${usuarioId}`
    );
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("qr")
        .select("qr")
        .eq("usuario_id", usuarioId)
        .order("criado_em", { ascending: false })
        .limit(1);

      console.log("[QR] 📦 Dados retornados do Supabase:", data);
      const qr = data?.[0]?.qr ?? null;

      if (error || !qr) {
        console.warn("[QR] ⚠️ QR não encontrado ou erro:", error?.message);
        setStatusMsg("❌ QR code não encontrado.");
        return;
      }

      if (canvas) {
        await QRCode.toCanvas(canvas, qr, { width: 256 });
        console.log("[QR] 🖼️ QR code renderizado no canvas.");
      }

      setStatusMsg("✅ Escaneie o QR code acima.");
    } catch (err: unknown) {
      console.error(
        "[QR] ❌ Erro ao carregar QR:",
        err instanceof Error ? err.message : err
      );
      setStatusMsg("❌ Erro ao carregar QR code.");
    } finally {
      setLoading(false);
    }
  }

  return { carregarQr, loading, statusMsg };
}
