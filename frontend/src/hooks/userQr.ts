// GitHub/LeadTalksv1/frontend/src/hooks/useQr.ts

// ✅ 1. Importe o hook do auth-helpers
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { useCallback, useState, useRef } from "react";
import QRCode from "qrcode";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Socket } from "socket.io-client";

export function useQr() {
  // ✅ 3. Obtenha a instância correta do Supabase via hook
  const supabase = useSupabaseClient();
  const [statusMsg, setStatusMsg] = useState("Aguardando QR...");
  const qrCodeRef = useRef<string | null>(null);

  const esperarQrCode = useCallback(
    (usuario_id: string, canvas?: HTMLCanvasElement): RealtimeChannel => {
      setStatusMsg("Conectando ao Realtime do Supabase...");

      const canal = supabase // Agora usa a instância correta
        .channel(`qr-channel-${usuario_id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "qr",
            filter: `usuario_id=eq.${usuario_id}`,
          },
          async (payload) => {
            console.log("[useQr] Payload recebido:", payload); // Ótimo para depuração!
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
          console.log("[Supabase Realtime][useQr] Canal de QR:", status);
        });

      return canal;
    },
    [supabase] // ✅ 4. Adicione 'supabase' como dependência do useCallback
  );

  const setupSocketListeners = useCallback(
    (socket: Socket | null, canvas?: HTMLCanvasElement) => {
      if (!socket) return;

      socket.on("qr_code_updated", async (payload: { qr: string }) => {
        const novoQr = payload.qr;
        console.log(
          "[useQr][Socket] ⚡️ QR Code recebido via Socket.IO!",
          novoQr
        );

        if (novoQr && novoQr !== qrCodeRef.current && canvas) {
          qrCodeRef.current = novoQr;
          await QRCode.toCanvas(canvas, novoQr);
          setStatusMsg("QR Code pronto. Escaneie com seu celular.");
        }
      });
    },
    [] // Sem dependências, pois as refs e setStatusMsg são estáveis
  );

  return {
    esperarQrCode,
    setupSocketListeners, // Exporta a nova função
    statusMsg,
  };
}
