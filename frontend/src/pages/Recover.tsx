// GitHub/LeadTalksv1/frontend/src/pages/Recover.tsx

import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { useState } from "react";
import { Link } from "react-router-dom";

export default function Recover() {
  const supabase = useSupabaseClient();
  const [email, setEmail] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [erro, setErro] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSucesso("");
    setErro("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });

    if (error) {
      setErro("❌ Erro ao enviar email: " + error.message);
    } else {
      setSucesso("✅ Verifique seu email para redefinir a senha.");
    }
  };

  return (
    <div className="bg-white p-8 rounded shadow-md w-full max-w-sm mx-auto mt-10">
      <h1 className="text-2xl font-bold text-center mb-6">
        🔑 Recuperar Senha
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 p-2 w-full border rounded focus:outline-none focus:ring"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded font-semibold"
        >
          Enviar link de recuperação
        </button>
      </form>

      <div className="text-sm text-center mt-4">
        <Link to="/login">Voltar para login</Link>
      </div>

      {sucesso && (
        <p className="text-green-600 text-sm mt-4 text-center">{sucesso}</p>
      )}
      {erro && <p className="text-red-500 text-sm mt-2 text-center">{erro}</p>}
    </div>
  );
}
