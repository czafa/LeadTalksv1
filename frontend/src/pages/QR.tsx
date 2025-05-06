import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { useQr } from "../hooks/userQr";
import type { RealtimeChannel } from "@supabase/supabase-js";

export default function QR() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<number | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const navigate = useNavigate();
  const { carregarQr, loading, statusMsg } = useQr();

  useEffect(() => {
    let isMounted = true;

    const verificarSessao = async () => {
      console.log("[QR] ▶️ Verificando sessão...");

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user || !isMounted) return navigate("/login");

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token || !isMounted) return navigate("/login");

      const resp = await fetch(`${import.meta.env.VITE_API_URL}/sessao`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!isMounted) return;

      if (resp.ok) {
        const { ativo } = await resp.json();
        if (ativo) {
          console.log("[QR] 🔄 Sessão já ativa – indo para /home");
          return navigate("/home");
        }
      }

      // Renderiza QR
      const canvas = canvasRef.current;
      if (canvas) {
        await carregarQr(user.id, canvas);
      } else {
        console.warn("[QR] ⚠️ Canvas ainda não está disponível.");
      }

      // Polling
      intervalRef.current = window.setInterval(() => {
        const c = canvasRef.current;
        if (c) {
          console.log("[QR] 🔁 Polling: recarregando QR");
          carregarQr(user.id, c);
        }
      }, 5000);

      // WebSocket listener
      const channel = supabase
        .channel("sessao-status")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "sessao",
            filter: `usuario_id=eq.${user.id}`,
          },
          (payload) => {
            console.log("[QR] 📣 Realtime payload:", payload.new);
            if (payload.new.ativo) {
              console.log("[QR] ✅ Sessão ativada – indo para /home");
              if (intervalRef.current) clearInterval(intervalRef.current);
              navigate("/home");
            }
          }
        )
        .subscribe((status) => {
          if (status !== "SUBSCRIBED") {
            console.warn("[QR] ⚠️ WebSocket falhou:", status);
          }
        });

      channelRef.current = channel;
    };

    verificarSessao();

    return () => {
      isMounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [navigate, carregarQr]);

  return (
    <div className="bg-white p-6 rounded shadow-md text-center max-w-md mx-auto mt-10">
      <h1 className="text-2xl font-bold mb-4">📱 Escaneie o QR Code</h1>
      <p className="mb-4 text-gray-700">Conecte seu WhatsApp para iniciar.</p>

      {loading ? (
        <div className="flex justify-center mb-4">
          <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 animate-spin" />
        </div>
      ) : (
        <canvas ref={canvasRef} className="mx-auto mb-4" />
      )}

      <p className="text-sm text-gray-600 mt-4">{statusMsg}</p>
    </div>
  );
}
