// src/pages/QR.tsx
import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { useQr } from "../hooks/userQr";
import type { RealtimeChannel } from "@supabase/supabase-js";

export default function QR() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const navigate = useNavigate();

  const { carregarQr, statusMsg, loading } = useQr();

  useEffect(() => {
    // 1️⃣ Check session / active flag and start QR polling
    const verificarSessao = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return navigate("/login");

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return navigate("/login");

      const res = await fetch(`${import.meta.env.VITE_API_URL}/sessao`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const { ativo } = await res.json();
      if (ativo) {
        clearInterval(intervalRef.current!);
        return navigate("/home");
      }

      // 2️⃣ Only draw when <canvas> is actually in the DOM
      const canvas = canvasRef.current;
      if (!canvas) {
        console.warn("[QR] ⚠️ Canvas not yet available, retrying next tick");
        return;
      }

      // initial load
      await carregarQr(user.id, canvas);

      // polling every 5s
      intervalRef.current = setInterval(() => {
        const c = canvasRef.current;
        if (c) carregarQr(user.id, c);
      }, 5000);

      // start realtime listener
      monitorarSessao(user.id);
    };

    // 3️⃣ Listen for session activation to stop polling + redirect
    const monitorarSessao = (usuarioId: string) => {
      const channel = supabase
        .channel("sessao-status")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "sessao",
            filter: `usuario_id=eq.${usuarioId}`,
          },
          (payload) => {
            if (payload.new.ativo) {
              clearInterval(intervalRef.current!);
              navigate("/home");
            }
          }
        )
        .subscribe();

      channelRef.current = channel;
    };

    verificarSessao();

    return () => {
      // cleanup interval + realtime channel
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [navigate, carregarQr]);

  return (
    <div className="bg-white p-6 rounded shadow-md text-center max-w-md mx-auto mt-10">
      <h1 className="text-2xl font-bold mb-4">📱 Escaneie o QR Code</h1>
      <p className="mb-4 text-gray-700">Conecte seu WhatsApp para iniciar.</p>

      {loading ? (
        <div className="flex justify-center mb-4">
          <div className="loader rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 animate-spin" />
        </div>
      ) : (
        <canvas ref={canvasRef} className="mx-auto mb-4" />
      )}

      <p className="text-sm text-gray-600 mt-4">{statusMsg}</p>
    </div>
  );
}
