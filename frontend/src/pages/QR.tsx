import { useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { useQr } from "../hooks/userQr";
import type { RealtimeChannel } from "@supabase/supabase-js";

export default function QR() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const subscriptionRef = useRef<RealtimeChannel | null>(null);
  const navigate = useNavigate();

  const { carregarQr, loading, statusMsg, qrCode } = useQr();

  const monitorarSessao = useCallback(
    (usuarioId: string) => {
      return supabase
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
              console.log("✅ Sessão ativada. Redirecionando...");
              if (intervalRef.current) clearInterval(intervalRef.current);
              navigate("/home");
            }
          }
        )
        .subscribe();
    },
    [navigate]
  );

  useEffect(() => {
    async function verificarSessao() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return navigate("/login");

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) return navigate("/login");

      const response = await fetch(import.meta.env.VITE_API_URL + "/sessao", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await response.json();
      if (result?.ativo) return navigate("/home");

      // Exibe o QR Code inicialmente
      await carregarQr(user.id, canvasRef.current || undefined);

      // Faz polling do QR apenas se ainda não tiver um visível
      intervalRef.current = setInterval(() => {
        if (!qrCode) {
          carregarQr(user.id, canvasRef.current || undefined);
        }
      }, 30000);

      // Assina atualizações de sessão
      subscriptionRef.current = monitorarSessao(user.id);
    }

    verificarSessao();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (subscriptionRef.current)
        supabase.removeChannel(subscriptionRef.current);
    };
  }, [navigate, carregarQr, qrCode, monitorarSessao]);

  return (
    <div className="bg-white p-6 rounded shadow-md text-center max-w-md mx-auto mt-10">
      <h1 className="text-2xl font-bold mb-4">📱 Escaneie o QR Code</h1>
      <p className="mb-4 text-gray-700">Conecte seu WhatsApp para iniciar.</p>

      {loading ? (
        <div className="flex justify-center mb-4">
          <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 animate-spin"></div>
        </div>
      ) : (
        <canvas ref={canvasRef} className="mx-auto mb-4" />
      )}

      <p className="text-sm text-gray-600 mt-4">{statusMsg}</p>
    </div>
  );
}
