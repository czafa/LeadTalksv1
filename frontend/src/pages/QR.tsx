// GitHub/LeadTalksv1/frontend/src/pages/QR.tsx

import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQr } from "../hooks/userQr";
import io from "socket.io-client";
import type { Socket } from "socket.io-client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Aciona o backend para iniciar uma nova sessão de WhatsApp.
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
        `[Frontend][QR.tsx][iniciarSessaoBackend] ❌ Falha ao iniciar sessão no backend para ${usuario_id}:`,
        erro.erro || "Erro desconhecido"
      );
      // Aqui você poderia usar um toast ou um estado para mostrar o erro ao usuário
    } else {
      console.log(
        `[Frontend][QR.tsx][iniciarSessaoBackend] 🚀 Requisição enviada para /iniciar-leadtalk para o usuário: ${usuario_id}`
      );
    }
  } catch (err) {
    console.error(
      `[Frontend][QR.tsx][iniciarSessaoBackend] ❌ Erro de rede ao chamar /iniciar-leadtalk para ${usuario_id}:`,
      err
    );
  }
}

/**
 * Componente da página de QR Code usando Supabase Realtime.
 */
export default function QR() {
  const supabase = useSupabaseClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const navigate = useNavigate();

  const { esperarQrCode, statusMsg } = useQr();
  const [isRedirecting, setIsRedirecting] = useState(false); //Estado para controlar o processo de redirecionamento e evitar limpezas prematuras.
  useEffect(() => {
    // Referências para o canal do Supabase e o socket, para podermos limpá-los depois
    let qrCanal: RealtimeChannel | null = null;
    let socket: Socket | null = null;

    async function iniciar() {
      if (isRedirecting) return; // Previne a execução dupla em Strict Mode se já estivermos redirecionando
      console.log(
        "[Frontend][QR.tsx][iniciar] ⚠️ Redirecionamento já em andamento, abortando inicialização duplicada."
      );
      try {
        // 1. Validação do usuário e da sessão
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          console.warn(
            "[Frontend][QR.tsx][iniciar] ❌ Usuário não autenticado. Redirecionando para /login..."
          );
          return navigate("/login");
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          console.warn(
            "[Frontend][QR.tsx][iniciar] ❌ Token não encontrado. Redirecionando para /login..."
          );
          return navigate("/login");
        }

        const usuario_id = user.id;

        // 2. Aciona o backend para começar a gerar o QR
        // Não precisamos de 'await' aqui se quisermos que a escuta comece imediatamente
        iniciarSessaoBackend(usuario_id, token);
        console.log(
          `[Frontend][QR.tsx][iniciar] 🚀 Iniciada requisição para /iniciar-leadtalk`
        );

        // 3. Inicia a escuta em tempo real pelo QR Code, sem polling ou setTimeout
        // A função do hook agora nos retorna a instância do canal
        console.log(
          "[Frontend][QR.tsx][iniciar] 📡 Subscribing to Supabase channel para QR..."
        );
        qrCanal = esperarQrCode(usuario_id, canvasRef.current || undefined);

        // 4. Busca a URL do socket e estabelece a conexão
        const res = await fetch(`${import.meta.env.VITE_API_URL}/socketUrl`);
        const { socketUrl } = await res.json();
        console.log(
          `[Frontend][QR.tsx][iniciar] 🌐 Obtida URL do socket: ${socketUrl}`
        );

        socket = io(socketUrl, {
          transports: ["websocket"],
          path: "/socket.io",
        });
        socketRef.current = socket; // Guarda a referência para a limpeza

        socket.on("connect", () => {
          console.log("[Frontend][QR.tsx][Socket] 🔌 Conectado ao servidor.");
          socket?.emit("join", usuario_id);
          console.log(
            `[Frontend][QR.tsx][Socket] 🎯 Emitido 'join' para sala: ${usuario_id}`
          );
        });

        socket.on("connection_open", (payload: { usuario_id: string }) => {
          if (payload.usuario_id === usuario_id && !isRedirecting) {
            console.log(
              `[Frontend][QR.tsx][Socket] ✅ WhatsApp conectado para ${usuario_id}. Redirecionando para /home...`
            );
            setIsRedirecting(true); // sinaliza que estamos saindo da página
            navigate("/home");
          }
        });

        socket.on("disconnect", () => {
          console.warn(
            "[Frontend][QR.tsx][Socket] 🔌 Desconectado do servidor."
          );
        });

        socket.on("connect_error", (err) => {
          console.error(
            "[Frontend][QR.tsx][Socket] ❌ Erro de conexão:",
            err.message
          );
        });
      } catch (err) {
        console.error(
          "[Frontend][QR.tsx][iniciar] ❌ Erro fatal na inicialização:",
          err
        );
      }
    }

    iniciar();

    // 5. Função de Limpeza (Cleanup) - ESSENCIAL
    return () => {
      // A limpeza agora só acontece se não estivermos no meio de um redirecionamento.
      // Isso impede que o React Strict Mode desmonte os sockets antes da navegação.
      if (isRedirecting) {
        console.log("[Cleanup] Redirecionamento em progresso, limpeza adiada.");
        return;
      }

      console.log("[Cleanup] Limpando recursos do componente QR...");
      // Remove a inscrição do canal do Supabase se ele existir
      if (qrCanal) {
        supabase.removeChannel(qrCanal);
      }
      if (socket) {
        socket.disconnect();
      }
    };
  }, [supabase, esperarQrCode, navigate, isRedirecting]);

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
