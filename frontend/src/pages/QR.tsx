import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import * as QRCode from "qrcode";
import { useNavigate } from "react-router-dom";

export default function QR() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [statusMsg, setStatusMsg] = useState("Aguardando conexão...");
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null); // ✅ controle do intervalo
  const navigate = useNavigate();

  useEffect(() => {
    verificarSessao();

    async function verificarSessao() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        navigate("/login");
        return;
      }

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      console.log("🔐 Sessão atual:", session.data.session);

      if (!token) {
        navigate("/login");
        return;
      }

      const response = await fetch("/api/sessao", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();

      if (result?.ativo) {
        navigate("/home");
        return;
      }

      await carregarQRCode();

      // ✅ Agora sim: usamos o useRef corretamente
      intervalRef.current = setInterval(carregarQRCode, 5000);

      monitorarSessao(user.id);
    }

    async function carregarQRCode() {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;

        if (!user) {
          setStatusMsg("⚠️ Usuário não autenticado.");
          return;
        }

        const { data, error } = await supabase
          .from("qr")
          .select("qr")
          .eq("usuario_id", user.id)
          .order("created_at", { ascending: false }) // garante o mais recente
          .limit(1)
          .single();

        if (error || !data?.qr) {
          setLoading(false);
          setStatusMsg("❌ QR code não encontrado.");
          return;
        }

        if (canvasRef.current) {
          await QRCode.toCanvas(canvasRef.current, data.qr, { width: 256 });
          setLoading(false);
          setStatusMsg("✅ QR carregado do Supabase.");
        }
      } catch (err) {
        console.error("Erro ao carregar QR do Supabase:", err);
        setLoading(false);
        setStatusMsg("❌ Erro ao carregar QR Code.");
      }
    }

    function monitorarSessao(usuarioId: string) {
      supabase
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
              navigate("/home");
            }
          }
        )
        .subscribe();
    }

    // ✅ Cancelar intervalo ao desmontar
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [navigate]);

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
