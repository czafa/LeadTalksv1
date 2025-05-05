// QR.tsx
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
      try {
        // 🔐 Obtém o usuário atual
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;
        if (!user) {
          console.warn(
            "[QR] ❌ Usuário não autenticado. Redirecionando para login."
          );
          return navigate("/login");
        }

        // 🔐 Obtém o token JWT da sessão
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) {
          console.warn(
            "[QR] ❌ Token de sessão inválido. Redirecionando para login."
          );
          return navigate("/login");
        }

        // 🔎 Verifica se a sessão do WhatsApp já está ativa
        const response = await fetch(`${import.meta.env.VITE_API_URL}/sessao`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await response.json();
        if (result?.ativo) {
          console.log("[QR] ✅ Sessão já ativa. Redirecionando para /home.");
          if (intervalRef.current) clearInterval(intervalRef.current);
          return navigate("/home");
        }

        // 🖼️ Aguarda o canvas estar disponível
        const canvas = canvasRef.current;
        if (!canvas) {
          console.warn("[QR] ⚠️ Canvas ainda não está disponível.");
          return;
        }

        // 📲 Carrega o QR code inicialmente
        await carregarQr(user.id, canvas);

        // 🔁 Atualiza o QR code a cada 5 segundos
        intervalRef.current = setInterval(() => {
          const canvasAtual = canvasRef.current;
          if (canvasAtual) {
            carregarQr(user.id, canvasAtual);
          } else {
            console.warn(
              "[QR] ⚠️ Canvas indisponível durante atualização periódica."
            );
          }
        }, 5000);

        // 👁️ Ativa o listener da sessão via Supabase Realtime
        monitorarSessao(user.id);
      } catch (err) {
        console.error("[QR] ❌ Erro durante verificação da sessão:", err);
      }
    };

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
          <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 animate-spin"></div>
        </div>
      ) : (
        <canvas ref={canvasRef} className="mx-auto mb-4" />
      )}

      <p className="text-sm text-gray-600 mt-4">{statusMsg}</p>
    </div>
  );
}
