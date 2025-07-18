// src/components/ProtectedRoute.tsx

// ✅ 1. Importe o hook do auth-helpers
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState, ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function ProtectedRoute({ children }: Props) {
  // ✅ 3. Obtenha a instância correta do Supabase via hook
  const supabase = useSupabaseClient();
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    const verificar = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { data: sessionData } = await supabase.auth.getSession();

      const user = userData.user;
      const token = sessionData.session?.access_token;

      if (!user || !token) {
        setAutorizado(false);
        return;
      }

      // Para a rota /qr: basta estar logado
      if (location.pathname === "/qr") {
        setAutorizado(true);
        return;
      }

      // Para rotas protegidas (/home), exige logado + conectado (sessão ativa)
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/sessao`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          // Se a API retornar um erro (ex: 401, 500), não autoriza
          setAutorizado(false);
          return;
        }

        const result = await res.json();
        // Garante que a propriedade 'conectado' exista e seja true
        setAutorizado(result.conectado === true);
      } catch (err) {
        console.error("Erro ao verificar sessão:", err);
        setAutorizado(false);
      }
    };

    verificar();
    // ✅ 4. Adicione 'supabase' e 'location.pathname' como dependências
  }, [supabase, location.pathname]);

  if (autorizado === null) {
    // Opcional: Mostrar um spinner de carregamento aqui para uma melhor UX
    return <div>Verificando autorização...</div>;
  }

  // Se autorizado, renderiza o componente filho, senão, redireciona para o login.
  return autorizado ? <>{children}</> : <Navigate to="/login" />;
}
