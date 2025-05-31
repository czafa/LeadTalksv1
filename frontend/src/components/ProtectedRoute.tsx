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

      if (!user || !token) return setAutorizado(false);

      // ✅ Se rota for /qr, só exige login
      if (location.pathname === "/qr") {
        return setAutorizado(true);
      }

      // ✅ Se for /home, exige login + sessao ativa
      const res = await fetch(`${import.meta.env.VITE_API_URL}/sessao`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ usuario_id: user.id }),
      });

      const result = await res.json();
      setAutorizado(result.ativo === true);
    };

    verificar();
  }, [location.pathname]);

  if (autorizado === null) return null;

  return autorizado ? <>{children}</> : <Navigate to="/qr" />;
}
