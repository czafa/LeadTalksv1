import { useState } from "react";
import { supabase } from "../lib/supabase";

export function useLeadTalks() {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const iniciarSessao = async () => {
    setErro(null);
    setLoading(true);

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    const token = session?.access_token;

    if (sessionError || !token) {
      setErro("Usuário não autenticado.");
      setLoading(false);
      return { sucesso: false };
    }

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/iniciar-leadtalk`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const json = await res.json();

      if (!res.ok) {
        setErro(json.error || "Erro desconhecido");
        return { sucesso: false };
      }

      return { sucesso: true };
    } catch (err: unknown) {
      console.error("Erro ao iniciar sessão:", err);
      setErro("Erro de rede ou servidor");
      return { sucesso: false };
    } finally {
      setLoading(false);
    }
  };

  return { iniciarSessao, loading, erro };
}
