// src/hooks/useQr.ts
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useQrCode(usuario_id: string | undefined) {
  const [qrCode, setQrCode] = useState<string | null>(null);

  useEffect(() => {
    if (!usuario_id) return;

    const fetchQr = async () => {
      const { data, error } = await supabase
        .from("qr")
        .select("qr")
        .eq("usuario_id", usuario_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!error && data?.qr) {
        setQrCode(data.qr);
      }
    };

    fetchQr();

    const interval = setInterval(fetchQr, 3000); // atualiza a cada 3s
    return () => clearInterval(interval);
  }, [usuario_id]);

  return qrCode;
}
