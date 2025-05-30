import { useEffect } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";

export function useSessaoCleanup() {
  const supabase = useSupabaseClient();

  useEffect(() => {
    const handleUnload = async () => {
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        const user = await supabase.auth.getUser();
        const usuario_id = user.data.user?.id;

        if (!usuario_id || !token) return;

        const body = JSON.stringify({ usuario_id, ativo: false });
        const url = `${import.meta.env.VITE_API_URL}/sessao`;

        if (navigator.sendBeacon) {
          const blob = new Blob([body], { type: "application/json" });
          navigator.sendBeacon(url, blob);
        } else {
          await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body,
          });
        }
      } catch (error) {
        console.warn("Erro ao encerrar sessão:", error);
      }
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [supabase]);
}
