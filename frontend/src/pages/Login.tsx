import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSupabaseClient } from "@supabase/auth-helpers-react";

export default function Login() {
  const supabase = useSupabaseClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erroMsg, setErroMsg] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroMsg("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErroMsg("Email ou senha inválidos");
      return;
    }

    const usuario_id = data.user?.id;
    if (!usuario_id) {
      setErroMsg("Erro ao recuperar o usuário");
      return;
    }

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) {
      setErroMsg("Token de sessão não encontrado");
      return;
    }

    const BACKEND_URL = import.meta.env.VITE_API_URL;

    await fetch(`${BACKEND_URL}/api/sessao`, {
      // envia para o /backend o json com o usuario_id, logado e conectado.
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        usuario_id,
        logado: true,
        conectado: false,
      }),
    });

    navigate("/qr");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-sm"
      >
        <h2 className="text-3xl font-bold mb-6 text-center">LeadTalks</h2>

        <input
          type="email"
          placeholder="Email"
          className="w-full px-4 py-2 mb-3 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:ring focus:ring-green-400"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Senha"
          className="w-full px-4 py-2 mb-3 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:ring focus:ring-green-400"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {erroMsg && (
          <p className="text-red-500 text-sm mt-2 text-center">❌ {erroMsg}</p>
        )}
        <button
          type="submit"
          className="w-full bg-green-600 hover:bg-green-700 text-white py-2 mt-2 rounded"
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
