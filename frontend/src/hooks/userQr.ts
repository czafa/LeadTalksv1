//GitHub/LeadTalksv1/frontend/src/hooks/userQr.ts

import { useState, useRef, useCallback } from "react";
import QRCode from "qrcode";

export function useQr() {
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const qrCodeRef = useRef<string | null>(null); // Último QR processado

  const carregarQr = useCallback(
    async (usuario_id: string, canvas?: HTMLCanvasElement) => {
      console.log(
        `[useQr] 🎯 Iniciando busca do QR para usuário: ${usuario_id}`
      );
      setLoading(true);
      setStatusMsg("Buscando QR Code...");

      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/qr?usuario_id=${usuario_id}`
        );

        if (!res.ok) {
          throw new Error(`Erro HTTP: ${res.status}`);
        }

        const data = await res.json();

        if (!data?.qr) {
          setStatusMsg("QR não encontrado");
          console.warn("[useQr] ⚠️ QR não encontrado no Supabase.");
          return;
        }

        // Evita reprocessar o mesmo QR
        if (data.qr === qrCodeRef.current) {
          console.log(
            "[useQr] ⏭️ QR já processado anteriormente. Ignorando..."
          );
          return;
        }

        qrCodeRef.current = data.qr;
        setQrCode(data.qr);
        setStatusMsg("QR pronto!");

        console.log("[useQr] 📦 QR recebido do backend:", data.qr);
        if (canvas) {
          console.log("[useQr] 🎨 Renderizando QR no canvas...");
          await QRCode.toCanvas(canvas, data.qr);
          console.log("[useQr] ✅ QR renderizado com sucesso.");
        } else {
          console.warn(
            "[useQr] ⚠️ Canvas não fornecido. QR não foi desenhado."
          );
        }
      } catch (err) {
        console.error("[useQr] ❌ Erro ao carregar QR:", err);
        setStatusMsg("Erro ao buscar QR");
      } finally {
        setLoading(false);
      }
    },
    [] // Garantido: função memoizada estaticamente
  );

  return {
    qrCode,
    carregarQr,
    loading,
    statusMsg,
  };
}
