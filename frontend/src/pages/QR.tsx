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
    const verificarSessao = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return navigate("/login");

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return navigate("/login");

      const res = await fetch(`${import.meta.env.VITE_API_URL}/sessao`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const { ativo } = await res.json();
      if (ativo) {
        // sessão já ativa: cancelar polling e redirecionar
        if (intervalRef.current) clearInterval(intervalRef.current);
        return navigate("/home");
      }

      // ⏳ só inicia quando o <canvas> existe
      const canvas = canvasRef.current;
      if (!canvas) {
        console.warn(
          "[QR] ⚠️ Canvas ainda não disponível. Retentando no próximo efeito."
        );
        return;
      }

      // 1️⃣ Carrega imediatamente
      await carregarQr(user.id, canvas);

      // 2️⃣ Inicia polling
      intervalRef.current = setInterval(() => {
        const c = canvasRef.current;
        if (c) carregarQr(user.id, c);
      }, 5000);

      // 3️⃣ Liga listener realtime
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
            if (payload.new.ativo) {
              // pára tudo e navega
              if (intervalRef.current) clearInterval(intervalRef.current);
              navigate("/home");
            }
          }
        )
        .subscribe();

      channelRef.current = channel;
    };

    verificarSessao();

    return () => {
      // limpeza completa
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
