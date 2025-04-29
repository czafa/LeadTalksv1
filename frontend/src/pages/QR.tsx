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

      const { data: sessao } = await supabase
        .from("sessao")
        .select("ativo")
        .eq("usuario_id", user.id)
        .single();

      if (sessao?.ativo) {
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
        const response = await fetch("/api/qr");
        const data = await response.json();

        if (data.qr && canvasRef.current) {
          await QRCode.toCanvas(canvasRef.current, data.qr, { width: 256 });
          setLoading(false);
        } else {
          setLoading(false);
          setStatusMsg("❌ QR code ainda não disponível.");
        }
      } catch (err) {
        console.error("Erro ao carregar QR:", err);
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
