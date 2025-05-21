import { useState, useRef, useCallback } from "react";
import QRCode from "qrcode";

export function useQr() {
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const qrCodeRef = useRef<string | null>(null); // ← armazena o último QR renderizado

  const carregarQr = useCallback(
    async (usuario_id: string, canvas?: HTMLCanvasElement) => {
      setLoading(true);
      setStatusMsg("Buscando QR Code...");

      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/qr?usuario_id=${usuario_id}`
        );
        const data = await res.json();

        if (!data?.qr) {
          setStatusMsg("QR não encontrado");
          return;
        }

        // 🛑 Evita reprocessar o mesmo QR
        if (data.qr === qrCodeRef.current) {
          setLoading(false);
          return;
        }

        qrCodeRef.current = data.qr;
        setQrCode(data.qr);
        setStatusMsg("QR pronto!");

        console.log("🎨 canvas recebido:", canvas);
        console.log("📦 QR recebido do backend:", data.qr);

        if (canvas) {
          await QRCode.toCanvas(canvas, data.qr);
          console.log("✅ QR renderizado no canvas com sucesso.");
        }
      } catch (err) {
        console.error("❌ Erro ao renderizar o QR no canvas:", err);
        setStatusMsg("Erro ao buscar QR");
      } finally {
        setLoading(false);
      }
    },
    [] // agora o useCallback não depende mais do estado
  );

  return {
    qrCode,
    carregarQr,
    loading,
    statusMsg,
  };
}
