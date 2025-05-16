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

      setQrCode(data.qr);
      setStatusMsg("QR pronto!");

      if (canvas) {
        await QRCode.toCanvas(canvas, data.qr);
      }
    } catch (e) {
      setStatusMsg("Erro ao buscar QR");
      console.error(e);
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
