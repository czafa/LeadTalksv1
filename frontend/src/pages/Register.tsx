// GitHub/LeadTalksv1/frontend/src/pages/Register.tsx

import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { useState } from "react";
import { Link } from "react-router-dom";

export default function Register() {
  const supabase = useSupabaseClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [erro, setErro] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSucesso("");
    setErro("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (error) {
      setErro("❌ Erro ao registrar: " + error.message);
    } else {
      setSucesso("✅ Verifique seu email para confirmar o cadastro.");
    }
  };

  return (
    <div className="bg-white p-8 rounded shadow-md w-full max-w-sm mx-auto mt-10">
      <h1 className="text-2xl font-bold text-center mb-6">📝 Criar Conta</h1>

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

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Senha
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 p-2 w-full border rounded focus:outline-none focus:ring"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded font-semibold"
        >
          Criar conta
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
