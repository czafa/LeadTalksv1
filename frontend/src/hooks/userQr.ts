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

      console.log("📡 Resposta da API /qr:", data);
      console.log("🎨 canvas recebido:", canvas);

      if (!data?.qr) {
        console.warn("⚠️ Nenhum QR encontrado no backend.");
        setStatusMsg("QR não encontrado");
        return;
      }

      setQrCode(data.qr);
      setStatusMsg("QR pronto!");

      console.log("✅ QR recebido do backend:", data.qr);

      if (canvas) {
        await QRCode.toCanvas(canvas, data.qr);
        console.log("🖨️ QR renderizado no canvas com sucesso.");
      } else {
        console.warn("⚠️ Canvas não está disponível. QR não foi desenhado.");
      }
    } catch (err) {
      console.error("❌ Erro ao buscar ou renderizar QR:", err);
      setStatusMsg("Erro ao buscar QR");
    } finally {
      setLoading(false);
    }
  };

  return {
    qrCode,
    carregarQr,
    loading,
    statusMsg,
  };
}
