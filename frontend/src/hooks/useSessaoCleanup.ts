import { useEffect, useRef } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";

export function useSessaoCleanup() {
  const supabase = useSupabaseClient();
  const usuarioIdRef = useRef<string | null>(null);

  // Captura e armazena o usuario_id apenas uma vez
  useEffect(() => {
    const setup = async () => {
      const { data: userData } = await supabase.auth.getUser();
      usuarioIdRef.current = userData.user?.id ?? null;
    };

    setup();
  }, [supabase]);

  useEffect(() => {
    const enviarFechamentoSessao = () => {
      if (!usuarioIdRef.current) return;

      const body = JSON.stringify({
        usuario_id: usuarioIdRef.current,
        ativo: false,
        sem_token: true, // 👈 se quiser tratar no backend
      });

      const url = `${import.meta.env.VITE_API_URL}/api/sessao`;

      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(url, blob);
    };

    window.addEventListener("beforeunload", enviarFechamentoSessao);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        enviarFechamentoSessao();
      }
    });

    return () => {
      window.removeEventListener("beforeunload", enviarFechamentoSessao);
    };
  }, []);
}
