//GitHub/LeadTalksv1/frontend/src/hooks/userQr.ts

import { useState, useRef, useCallback } from "react";
import QRCode from "qrcode";

export function useQr() {
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const qrCodeRef = useRef<string | null>(null); // Último QR processado

  // 👇 Nova função: faz polling do QR até ele estar disponível
  const esperarQrCode = async (
    usuario_id: string,
    canvas?: HTMLCanvasElement,
    tentativas = 5,
    intervalo = 20000
  ) => {
    for (let i = 0; i < tentativas; i++) {
      console.log(
        `[useQr] 🔄 Tentativa ${i + 1}/${tentativas} de buscar QR...`
      );
      const ok = await carregarQr(usuario_id, canvas, true);
      if (ok) return true;
      await new Promise((r) => setTimeout(r, intervalo));
    }
    console.warn("[useQr] ❌ QR não encontrado após polling.");
    return false;
  };

  // ⚙️ Modificado: recebe `silent` para não alterar statusMsg em tentativas do polling
  const carregarQr = useCallback(
    async (
      usuario_id: string,
      canvas?: HTMLCanvasElement,
      silent: boolean = false
    ): Promise<boolean> => {
      if (!silent) {
        console.log(
          `[useQr] 🎯 Iniciando busca do QR para usuário: ${usuario_id}`
        );
        setLoading(true);
        setStatusMsg("Buscando QR Code...");
      }

      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/qr?usuario_id=${usuario_id}`
        );

        if (!res.ok) throw new Error(`Erro HTTP: ${res.status}`);
        const data = await res.json();

        if (!data?.qr) {
          if (!silent) setStatusMsg("QR não encontrado");
          return false;
        }

        if (data.qr === qrCodeRef.current) {
          console.log(
            "[useQr] ⏭️ QR já processado anteriormente. Ignorando..."
          );
          return true;
        }

        qrCodeRef.current = data.qr;
        setQrCode(data.qr);
        if (!silent) setStatusMsg("QR pronto!");

        console.log("[useQr] 📦 QR recebido do backend:", data.qr);
        if (canvas) {
          await QRCode.toCanvas(canvas, data.qr);
          console.log("[useQr] ✅ QR renderizado com sucesso.");
        }

        return true;
      } catch (err) {
        console.error("[useQr] ❌ Erro ao carregar QR:", err);
        if (!silent) setStatusMsg("Erro ao buscar QR");
        return false;
      } finally {
        if (!silent) setLoading(false);
      }
    },
    []
  );

  return {
    qrCode,
    carregarQr,
    esperarQrCode,
    loading,
    statusMsg,
  };
}
