import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useQr() {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    const carregarQr = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const usuario_id = sessionData?.session?.user?.id;

      if (!usuario_id) return;

      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/qr?usuario_id=${usuario_id}`
        );
        const data = await response.json();
        if (data.qr) setQr(data.qr);
      } catch (e) {
        console.error("Erro ao carregar QR:", e);
      }
    };

    carregarQr();
    const intervalo = setInterval(carregarQr, 5000);

    return () => clearInterval(intervalo);
  }, []);

  return qr;
}
