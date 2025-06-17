// src/components/ProtectedRoute.tsx
import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState, ReactNode } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  children: ReactNode;
};

export default function ProtectedRoute({ children }: Props) {
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    const verificar = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const session = await supabase.auth.getSession();

      const user = userData.user;
      const token = session.data.session?.access_token;

      if (!user || !token) {
        setAutorizado(false);
        return;
      }

      // ✅ Para a rota /qr: basta estar logado
      if (location.pathname === "/qr") {
        setAutorizado(true);
        return;
      }

      // ✅ Para rotas protegidas (/home), exige logado + conectado (sessão ativa)
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/sessao`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const result = await res.json();
        setAutorizado(result.ativo === true);
      } catch (err) {
        console.error("Erro ao verificar sessão:", err);
        setAutorizado(false);
      }
    };

    verificar();
  }, [location.pathname]);

  if (autorizado === null) return null; // ou coloque um spinner se quiser

  return autorizado ? <>{children}</> : <Navigate to="/qr" />;
}
