// useQr.ts
import { useState } from "react";
import { supabase } from "../lib/supabase";
import QRCode from "qrcode";

export function useQr() {
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function carregarQr(usuarioId: string, canvas?: HTMLCanvasElement) {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("qr")
        .select("qr")
        .eq("usuario_id", usuarioId)
        .order("criado_em", { ascending: false })
        .limit(1);

      const qr = data?.[0]?.qr ?? null;

      if (error || !qr) {
        setStatusMsg("❌ QR code não encontrado.");
        return;
      }

      if (canvas) {
        await QRCode.toCanvas(canvas, qr, { width: 256 });
      }

      setStatusMsg("✅ Escaneie o QR code acima.");
    } catch (err) {
      console.error("Erro ao carregar QR:", err);
      setStatusMsg("❌ Erro ao carregar QR code.");
    } finally {
      setLoading(false);
    }
  }

  return {
    carregarQr,
    loading,
    statusMsg,
  };
}
