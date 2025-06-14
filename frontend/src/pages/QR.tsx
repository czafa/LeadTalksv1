import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { useQr } from "../hooks/userQr";
import type { RealtimeChannel } from "@supabase/supabase-js";

// 🔐 Inicia sessão no backend
async function iniciarSessaoBackend(usuario_id: string, token: string) {
  try {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/iniciar-leadtalk`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ usuario_id }),
      }
    );

    if (res.ok) {
      console.log("[LeadTalk] 🚀 Sessão iniciada no backend.");
    } else {
      console.error("[LeadTalk] ❌ Falha ao iniciar sessão no backend.");
    }
  } catch (err) {
    console.error("[LeadTalk] ❌ Erro de rede ao iniciar sessão:", err);
  }
}

// 🔄 Polling como fallback
async function verificarAtivoViaPolling(
  token: string,
  jaRedirecionouRef: React.MutableRefObject<boolean>,
  qrRenderizadoRef: React.MutableRefObject<boolean>,
  navigate: ReturnType<typeof useNavigate>,
  intervalRef: React.MutableRefObject<NodeJS.Timeout | null>
) {
  let tentativa = 0;

  intervalRef.current = setInterval(async () => {
    tentativa++;
    console.log(`⏱ Verificando sessão via polling (${tentativa}/5)...`);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/sessao`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const { ativo } = await res.json();

      if (ativo && qrRenderizadoRef.current && !jaRedirecionouRef.current) {
        console.log(
          "✅ Sessão ativa e QR renderizado. Redirecionando via polling..."
        );
        jaRedirecionouRef.current = true;
        clearInterval(intervalRef.current!);
        navigate("/home");
      }

      if (tentativa >= 5) {
        console.warn("❌ Polling encerrado. Sessão não detectada.");
        clearInterval(intervalRef.current!);
      }
    } catch (err) {
      console.error("❌ Erro ao consultar sessão via polling:", err);
      clearInterval(intervalRef.current!);
    }
  }, 5000);
}

// 📡 Realtime Supabase listener
function monitorarSessaoRealtime(
  usuario_id: string,
  jaRedirecionouRef: React.MutableRefObject<boolean>,
  qrRenderizadoRef: React.MutableRefObject<boolean>,
  intervalRef: React.MutableRefObject<NodeJS.Timeout | null>,
  navigate: ReturnType<typeof useNavigate>
): RealtimeChannel {
  console.log("📡 Escutando atualizações da tabela 'sessao'...");

  return supabase
    .channel("sessao-status")
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "sessao",
        filter: `usuario_id=eq.${usuario_id}`,
      },
      (payload) => {
        const ativo = payload?.new?.ativo === true;
        if (ativo && qrRenderizadoRef.current && !jaRedirecionouRef.current) {
          console.log(
            "✅ Sessão ativa e QR renderizado. Redirecionando via Realtime..."
          );
          jaRedirecionouRef.current = true;
          if (intervalRef.current) clearInterval(intervalRef.current);
          navigate("/home");
        }
      }
    )
    .subscribe();
}

// 📱 Componente QR
export default function QR() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const subscriptionRef = useRef<RealtimeChannel | null>(null);
  const jaRedirecionouRef = useRef(false);
  const qrRenderizadoRef = useRef(false);
  const navigate = useNavigate();

  const { carregarQr, statusMsg } = useQr();
  const [esperandoQr, setEsperandoQr] = useState(true);

  useEffect(() => {
    async function iniciarProcesso() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return navigate("/login");

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) return navigate("/login");

      // 1. Verifica se já está ativo
      try {
        const status = await fetch(`${import.meta.env.VITE_API_URL}/sessao`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await status.json();

        if (json?.ativo === true) {
          console.warn("[LeadTalk] ⚠️ Sessão já está ativa no Supabase.");
        }
      } catch (err) {
        console.error("❌ Erro ao consultar status da sessão:", err);
      }

      // 2. Inicia sessão
      await iniciarSessaoBackend(user.id, token);
      setEsperandoQr(true);

      // 3. Espera geração do QR no Supabase
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // 4. Renderiza o QR
      console.log("🖼️ Canvas recebido:", canvasRef.current);
      await carregarQr(user.id, canvasRef.current || undefined);
      console.log("✅ QR renderizado no canvas com sucesso.");
      qrRenderizadoRef.current = true;
      setEsperandoQr(false);

      // 5. Escuta realtime
      subscriptionRef.current = monitorarSessaoRealtime(
        user.id,
        jaRedirecionouRef,
        qrRenderizadoRef,
        intervalRef,
        navigate
      );

      // 6. Polling como fallback
      await verificarAtivoViaPolling(
        token,
        jaRedirecionouRef,
        qrRenderizadoRef,
        navigate,
        intervalRef
      );
    }

    iniciarProcesso();

    return () => {
      const intervalId = intervalRef.current;
      const subscription = subscriptionRef.current;

      if (intervalId) clearInterval(intervalId);
      if (subscription) supabase.removeChannel(subscription);
    };
  }, [navigate, carregarQr]);

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
