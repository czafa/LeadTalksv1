// useQr.ts
import { useState } from "react";
import { supabase } from "../lib/supabase";
import * as QRCode from "qrcode";

export function useQr() {
  const [statusMsg, setStatusMsg] = useState("Aguardando conexão...");
  const [loading, setLoading] = useState(true);

  const carregarQr = async (
    usuario_id: string,
    canvasRef?: HTMLCanvasElement
  ) => {
    try {
      const { data, error } = await supabase
        .from("qr")
        .select("qr")
        .eq("usuario_id", usuario_id)
        .order("criado_em", { ascending: false })
        .limit(1)
        .single();

      if (error || !data?.qr) {
        setLoading(false);
        setStatusMsg("❌ QR code não encontrado.");
        return;
      }

      if (canvasRef) {
        await QRCode.toCanvas(canvasRef, data.qr, { width: 256 });
      }

      setLoading(false);
      setStatusMsg("✅ QR carregado do Supabase.");
    } catch (err) {
      console.error("Erro ao carregar QR:", err);
      setLoading(false);
      setStatusMsg("❌ Erro ao carregar QR Code.");
    }
  };

  return { carregarQr, statusMsg, loading };
}
