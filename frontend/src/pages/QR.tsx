//GitHub/LeadTalksv1/frontend/src/pages/QR.tsx

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useQr } from "../hooks/userQr";
import io from "socket.io-client";
import type { Socket } from "socket.io-client";

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

    if (!res.ok) {
      console.error("[LeadTalk] ❌ Falha ao iniciar sessão no backend.");
    } else {
      console.log("[LeadTalk] 🚀 Sessão iniciada no backend.");
    }
  } catch (err) {
    console.error("[LeadTalk] ❌ Erro de rede ao iniciar sessão:", err);
  }
}

export default function QR() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const navigate = useNavigate();

  const { esperarQrCode, statusMsg } = useQr();
  const [esperandoQr, setEsperandoQr] = useState(true);

  useEffect(() => {
    async function iniciar() {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user;
        if (!user) return navigate("/login");

        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (!token) return navigate("/login");

        const usuario_id = user.id;

        // 🔐 Inicia sessão no backend da Vercel
        await iniciarSessaoBackend(usuario_id, token);
        setEsperandoQr(true);

        // ⏳ Aguarda backend preparar o socket antes do QR
        await new Promise((r) => setTimeout(r, 4000));

        // 🎯 Tenta renderizar QR no canvas
        await esperarQrCode(usuario_id, canvasRef.current || undefined);
        console.log("[LeadTalk] ✅ QR renderizado com sucesso.");
        setEsperandoQr(false);

        // 🌐 Busca URL do servidor socket (via ngrok)
        const res = await fetch(`${import.meta.env.VITE_API_URL}/socketUrl`);
        const { socketUrl } = await res.json();

        // 🔌 Conecta ao socket usando a URL dinâmica
        const socket = io(socketUrl);
        socketRef.current = socket;

        socket.on("connect", () => {
          console.log("[Socket] 🔌 Conectado ao servidor socket.");
        });

        socket.on("connection_open", (payload: { usuario_id: string }) => {
          if (payload.usuario_id === usuario_id) {
            console.log("[LeadTalk] ✅ WhatsApp conectado.");
            navigate("/home");
          }
        });

        socket.on("disconnect", () => {
          console.warn("[Socket] 🔌 Desconectado do servidor socket.");
        });
      } catch (err) {
        console.error("[LeadTalk] ❌ Erro no fluxo de QR:", err);
      }
    }

    iniciar();

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [esperarQrCode, navigate]);

  return (
    <div className="bg-white p-6 rounded shadow-md text-center max-w-md mx-auto mt-10">
      <h1 className="text-2xl font-bold mb-4">📱 Escaneie o QR Code</h1>
      <p className="mb-4 text-gray-700">Conecte seu WhatsApp para iniciar.</p>

      <canvas ref={canvasRef} className="mx-auto mb-4" />

      {esperandoQr && (
        <div className="flex flex-col items-center justify-center mt-6 animate-pulse">
          <div className="w-12 h-12 border-4 border-blue-500 border-dashed rounded-full animate-spin mb-3" />
          <p className="text-blue-700 text-sm font-medium">Preparando QR...</p>
        </div>
      )}

      <p className="text-sm text-gray-600 mt-4">{statusMsg}</p>
    </div>
  );
}
