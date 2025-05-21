import { useState } from "react";
import QRCode from "qrcode";

export function useQr() {
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);

  const carregarQr = async (usuario_id: string, canvas?: HTMLCanvasElement) => {
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

      // Evita reprocessar o mesmo QR
      if (data.qr === qrCode) {
        setLoading(false);
        return;
      }

      setQrCode(data.qr);
      setStatusMsg("QR pronto!");

      console.log("🎨 canvasRef.current:", canvas);
      console.log("📦 QR recebido do backend:", data.qr);

      if (canvas) {
        await QRCode.toCanvas(canvas, data.qr);
        console.log("✅ QR renderizado no canvas com sucesso.");
      }
    } catch (err) {
      console.error("❌ Erro ao renderizar o QR no canvas:", err);
      setStatusMsg("Erro ao buscar QR");
    } finally {
      setLoading(false); // 🛠️ Garantido em todos os caminhos
    }
  };

  return {
    qrCode,
    carregarQr,
    loading,
    statusMsg,
  };
}
