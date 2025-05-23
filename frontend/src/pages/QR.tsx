import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { useQr } from "../hooks/userQr";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ✅ Função auxiliar para iniciar a sessão no backend
async function iniciarSessao(usuario_id: string, token: string) {
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ usuario_id }),
    });

    if (!res.ok) {
      console.error("[LeadTalk] ❌ Falha ao iniciar sessão no backend.");
    } else {
      console.log("[LeadTalk] 🚀 Sessão iniciada no backend.");
    }
  } catch (err) {
    console.error("[LeadTalk] ❌ Erro ao requisitar backend:", err);
  }
}

export default function QR() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const subscriptionRef = useRef<RealtimeChannel | null>(null);
  const navigate = useNavigate();

  const { carregarQr, statusMsg } = useQr();
  const [esperandoQr, setEsperandoQr] = useState(true);

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
            const ativo =
              payload?.new?.ativo === true || payload?.new?.ativo === "true";
            if (ativo) {
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
    let tentativa = 0;

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
      if (result?.ativo === true) return navigate("/home");

      // ✅ 1. Inicia sessão no backend imediatamente
      await iniciarSessao(user.id, token);
      setEsperandoQr(true); // inicia loading visual

      // ✅ 2. Aguarda backend salvar QR no Supabase
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // ✅ 3. Carrega QR do Supabase
      await carregarQr(user.id, canvasRef.current || undefined);
      setEsperandoQr(false);

      // ✅ 4. Escuta sessão ativada
      subscriptionRef.current = monitorarSessao(user.id);

      // ✅ 5. Polling adicional para garantir QR em atraso
      intervalRef.current = setInterval(async () => {
        tentativa++;
        console.log(`⏱ Tentativa ${tentativa}/5`);

        const qrCheck = await fetch(
          `${import.meta.env.VITE_API_URL}/qr?usuario_id=${user.id}`
        );
        const qrRes = await qrCheck.json();

        if (qrRes?.qr) {
          console.log("✅ QR encontrado no backend. Parando polling.");
          await carregarQr(user.id, canvasRef.current || undefined);
          setEsperandoQr(false);
          clearInterval(intervalRef.current!);
        }

        if (tentativa >= 5) {
          console.warn("❌ Tentativas esgotadas. Parando polling.");
          clearInterval(intervalRef.current!);
        }
      }, 10000); // tenta a cada 10 segundos
    }

    verificarSessao();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (subscriptionRef.current)
        supabase.removeChannel(subscriptionRef.current);
    };
  }, [navigate, carregarQr, monitorarSessao]);

  return (
    <div className="bg-white p-6 rounded shadow-md text-center max-w-md mx-auto mt-10">
      <h1 className="text-2xl font-bold mb-4">📱 Escaneie o QR Code</h1>
      <p className="mb-4 text-gray-700">Conecte seu WhatsApp para iniciar.</p>

      <canvas ref={canvasRef} className="mx-auto mb-4" />

      {esperandoQr && (
        <div className="flex flex-col items-center justify-center mt-6 animate-pulse">
          <div className="w-12 h-12 border-4 border-blue-500 border-dashed rounded-full animate-spin mb-3"></div>
          <p className="text-blue-700 text-sm font-medium">Preparando QR...</p>
        </div>
      )}

      <p className="text-sm text-gray-600 mt-4">{statusMsg}</p>
    </div>
  );
}
