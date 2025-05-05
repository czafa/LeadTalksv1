import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import QRCode from "qrcode";

export function useQr(usuario_id: string) {
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const fetchQr = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("qr")
        .select("qr")
        .eq("usuario_id", usuario_id)
        .order("criado_em", { ascending: false })
        .limit(1);

      const qr = data?.[0]?.qr || null;

      if (error || !qr) {
        setLoading(false);
        setStatusMsg("❌ QR code não encontrado.");
        return;
      }

      if (canvasRef.current) {
        await QRCode.toCanvas(canvasRef.current, qr, { width: 256 });
      }

      setLoading(false);
    };

    if (usuario_id) {
      fetchQr();
    }
  }, [usuario_id]);

  return { canvasRef, statusMsg, loading };
}
