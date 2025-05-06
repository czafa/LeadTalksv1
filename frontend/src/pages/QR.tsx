// src/pages/QR.tsx
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
    async function verificarSessao() {
      console.log("[QR] ▶️ Verificando sessão...");

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        console.warn("[QR] ⚠️ Não autenticado – redirecionando");
        return navigate("/login");
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        console.warn("[QR] ⚠️ Token ausente – redirecionando");
        return navigate("/login");
      }

      const resp = await fetch(`${import.meta.env.VITE_API_URL}/sessao`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const { ativo } = await resp.json();
        if (ativo) {
          console.log("[QR] 🔄 Sessão já ativa – indo para /home");
          return navigate("/home");
        }
      }

      // 1ª renderização do QR
      const canvas = canvasRef.current;
      if (canvas) {
        console.log("[QR] 🔄 Carregando QR inicial");
        await carregarQr(user.id, canvas);
      } else {
        console.warn("[QR] ⚠️ Canvas indisponível no momento");
      }

      // Polling a cada 5s
      intervalRef.current = window.setInterval(async () => {
        const c = canvasRef.current;
        if (c) {
          console.log("[QR] 🔁 Polling: recarregando QR");
          await carregarQr(user.id, c);
        }
      }, 5000);

      // Realtime listener para 'sessao'
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
          ({ new: novo }) => {
            console.log("[QR] 📣 Realtime payload:", novo);
            if (novo.ativo) {
              console.log(
                "[QR] ✅ Sessão ativada – limpando e indo para /home"
              );
              if (intervalRef.current) clearInterval(intervalRef.current);
              navigate("/home");
            }
          }
        )
        .subscribe();

      channelRef.current = channel;
    }

    verificarSessao();

    return () => {
      console.log("[QR] 🛑 Cleanup");
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (channelRef.current) {
        console.log("[QR] 🗑️ Removendo canal Realtime");
        supabase.removeChannel(channelRef.current);
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
