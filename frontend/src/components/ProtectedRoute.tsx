import { Navigate } from "react-router-dom";
import { useEffect, useState, ReactNode } from "react"; // <-- ReactNode aqui
import { supabase } from "../lib/supabase";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const [autenticado, setAutenticado] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setAutenticado(!!user);
    });
  }, []);

  if (autenticado === null) return null; // pode adicionar um <Spinner/> aqui

  return autenticado ? <>{children}</> : <Navigate to="/login" />;
}
