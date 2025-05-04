// Exemplo: src/hooks/useLeadTalk.ts
import { supabase } from "../lib/supabase";
export const iniciarLeadTalk = async () => {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  const res = await fetch("/api/iniciar-leadtalk", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  console.log("Resposta do backend:", data);
};
