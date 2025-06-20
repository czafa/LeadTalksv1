// GitHub/LeadTalksv1/frontend/src/hooks/useQr.ts

import { useCallback, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import QRCode from "qrcode";
import type { RealtimeChannel } from "@supabase/supabase-js";

export function useQr() {
  const [statusMsg, setStatusMsg] = useState("Aguardando QR...");
  const qrCodeRef = useRef<string | null>(null);

  const esperarQrCode = useCallback(
    // A função agora retorna o canal para que possa ser limpo depois
    (usuario_id: string, canvas?: HTMLCanvasElement): RealtimeChannel => {
      setStatusMsg("Conectando ao Realtime do Supabase...");

      const canal = supabase
        .channel(`qr-channel-${usuario_id}`)
        .on(
          "postgres_changes",
          {
            event: "*", // <-- AJUSTE 1: Escuta INSERT e UPDATE
            schema: "public",
            table: "qr",
            filter: `usuario_id=eq.${usuario_id}`,
          },
          async (payload) => {
            // A lógica para extrair o QR pode ser um pouco diferente para UPDATE
            const novoQr = (payload.new as { qr: string })?.qr;

            if (!novoQr || novoQr === qrCodeRef.current) return;

            qrCodeRef.current = novoQr;

            if (canvas) {
              await QRCode.toCanvas(canvas, novoQr);
              setStatusMsg("QR Code pronto. Escaneie com seu celular.");
            }
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            setStatusMsg("Conectado. Aguardando a geração do QR Code...");
          }
          console.log("[Supabase Realtime] Canal de QR:", status);
        });

      return canal; // <-- AJUSTE 2: Retorna a instância do canal
    },
    []
  );

  return {
    esperarQrCode,
    statusMsg,
  };
}
