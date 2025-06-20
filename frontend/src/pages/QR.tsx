// GitHub/LeadTalksv1/frontend/src/pages/QR.tsx

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useQr } from "../hooks/userQr"; // O hook refatorado com Realtime
import io from "socket.io-client";

// Importando tipos para Socket.io e Supabase
import type { Socket } from "socket.io-client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Aciona o backend para iniciar uma nova sessão de WhatsApp.
 * Esta função permanece a mesma.
 * @param usuario_id - ID do usuário.
 * @param token - Token de acesso do Supabase.
 */
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
      // Idealmente, poderíamos pegar a mensagem de erro do backend aqui
      const erro = await res.json();
      console.error(
        "[LeadTalk] ❌ Falha ao iniciar sessão no backend:",
        erro.erro || "Erro desconhecido"
      );
      // Aqui você poderia usar um toast ou um estado para mostrar o erro ao usuário
    } else {
      console.log("[LeadTalk] 🚀 Requisição para iniciar sessão enviada.");
    }
  } catch (err) {
    console.error("[LeadTalk] ❌ Erro de rede ao iniciar sessão:", err);
  }
}

/**
 * Componente da página de QR Code, agora usando Supabase Realtime.
 */
export default function QR() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const navigate = useNavigate();

  // Usamos nosso hook refatorado que retorna a mensagem de status
  const { esperarQrCode, statusMsg } = useQr();

  useEffect(() => {
    // Referências para o canal do Supabase e o socket, para podermos limpá-los depois
    let qrCanal: RealtimeChannel | null = null;
    let socket: Socket | null = null;

    async function iniciar() {
      try {
        // 1. Validação do usuário e da sessão
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          console.log(
            "[Auth] Usuário não encontrado, redirecionando para login."
          );
          return navigate("/login");
        }

        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (!token) {
          console.log(
            "[Auth] Token não encontrado, redirecionando para login."
          );
          return navigate("/login");
        }

        const usuario_id = user.id;

        // 2. Aciona o backend para começar a gerar o QR
        // Não precisamos de 'await' aqui se quisermos que a escuta comece imediatamente
        iniciarSessaoBackend(usuario_id, token);

        // 3. Inicia a escuta em tempo real pelo QR Code, sem polling ou setTimeout
        // A função do hook agora nos retorna a instância do canal
        qrCanal = esperarQrCode(usuario_id, canvasRef.current || undefined);

        // 4. Busca a URL do socket e estabelece a conexão
        const res = await fetch(`${import.meta.env.VITE_API_URL}/socketUrl`);
        const { socketUrl } = await res.json();

        socket = io(socketUrl, {
          transports: ["websocket"],
          path: "/socket.io",
        });
        socketRef.current = socket; // Guarda a referência para a limpeza

        socket.on("connect", () => {
          console.log("[Socket] 🔌 Conectado ao servidor socket.");
          socket?.emit("join", usuario_id);
          console.log(`[Socket] 🎯 Emitido 'join' para a sala: ${usuario_id}`);
        });

        socket.on("connection_open", (payload: { usuario_id: string }) => {
          if (payload.usuario_id === usuario_id) {
            console.log("[LeadTalk] ✅ WhatsApp conectado. Redirecionando...");
            navigate("/home");
          }
        });

        socket.on("disconnect", () => {
          console.warn("[Socket] 🔌 Desconectado do servidor socket.");
        });

        socket.on("connect_error", (err) => {
          console.error("[Socket] ❌ Erro de conexão:", err.message);
        });
      } catch (err) {
        console.error("[LeadTalk] ❌ Erro fatal no fluxo de QR:", err);
      }
    }

    iniciar();

    // 5. Função de Limpeza (Cleanup) - ESSENCIAL
    return () => {
      console.log("[Cleanup] Limpando recursos do componente QR...");
      // Remove a inscrição do canal do Supabase se ele existir
      if (qrCanal) {
        supabase.removeChannel(qrCanal);
        console.log("[Cleanup] ✅ Inscrição do Supabase Realtime removida.");
      }
      // Desconecta o socket se ele existir
      if (socketRef.current) {
        socketRef.current.disconnect();
        console.log("[Cleanup] ✅ Socket desconectado.");
      }
    };
  }, [esperarQrCode, navigate]); // Dependências do useEffect

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 p-4">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg text-center w-full max-w-md">
        <h1 className="text-2xl font-bold mb-2">📱 Conectar WhatsApp</h1>
        <p className="mb-6 text-gray-600 dark:text-gray-400">
          Abra o WhatsApp no seu celular e escaneie o código abaixo.
        </p>

        {/* O canvas onde o QR Code será renderizado */}
        <canvas ref={canvasRef} className="mx-auto mb-4 rounded-lg" />

        {/* Feedback dinâmico para o usuário */}
        <div className="flex items-center justify-center mt-4 space-x-2 h-6">
          {/* Mostra um spinner enquanto aguarda o QR */}
          {statusMsg.toLowerCase().includes("aguardando") ||
          statusMsg.toLowerCase().includes("conectando") ? (
            <div className="w-5 h-5 border-2 border-blue-500 border-dashed rounded-full animate-spin" />
          ) : null}
          <p className="text-sm text-gray-700 dark:text-gray-300 animate-pulse">
            {statusMsg}
          </p>
        </div>

        <div className="mt-6 text-xs text-gray-400 dark:text-gray-500">
          <p>1. Abra o WhatsApp no seu celular.</p>
          <p>
            2. Toque em Menu ou Configurações e selecione Aparelhos conectados.
          </p>
          <p>3. Toque em Conectar um aparelho.</p>
        </div>
      </div>
    </div>
  );
}
