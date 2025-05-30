import { useEffect } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";

export function useSessaoCleanup() {
  const supabase = useSupabaseClient();

  useEffect(() => {
    const enviarFechamentoSessao = async () => {
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        const user = await supabase.auth.getUser();
        const usuario_id = user.data.user?.id;

        if (!usuario_id || !token) {
          console.warn("🚫 Sem token ou usuário para finalizar sessão.");
          return;
        }

        const body = JSON.stringify({ usuario_id, ativo: false });
        const url = `${import.meta.env.VITE_API_URL}/sessao`;

        console.log("💥 Enviando encerramento de sessão...", { usuario_id });

        if (navigator.sendBeacon) {
          const blob = new Blob([body], { type: "application/json" });
          const success = navigator.sendBeacon(url, blob);
          console.log("📡 sendBeacon enviado:", success);
        } else {
          await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body,
          });
          console.log("📬 fetch enviado (fallback)");
        }
      } catch (error) {
        console.error("❌ Erro ao encerrar sessão:", error);
      }
    };

    const handleUnload = () => enviarFechamentoSessao();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        enviarFechamentoSessao();
      }
    };

    window.addEventListener("beforeunload", handleUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [supabase]);
}
