import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Login() {
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

    if (error || !data.user) {
      setErroMsg("❌ Email ou senha inválidos.");
      return;
    }

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    if (!token) {
      setErroMsg("❌ Sessão inválida.");
      return;
    }

    const response = await fetch("/api/sessao", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const result = await response.json();

    if (result?.ativo) {
      navigate("/home");
    } else {
      navigate("/qr");
    }
  };

  return (
    <div className="bg-white p-8 rounded shadow-md w-full max-w-sm mx-auto mt-10">
      <h1 className="text-2xl font-bold text-center mb-6">
        🔐 Login no LeadTalks
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

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Senha
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 p-2 w-full border rounded focus:outline-none focus:ring"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded font-semibold"
        >
          Entrar
        </button>
      </form>

      <div className="text-sm text-center mt-4">
        <a href="/register" className="text-blue-600 hover:underline">
          Criar conta
        </a>{" "}
        ·{" "}
        <a href="/recover" className="text-blue-600 hover:underline">
          Esqueci a senha
        </a>
      </div>

      {erroMsg && (
        <p className="text-red-500 text-sm mt-4 text-center">{erroMsg}</p>
      )}
    </div>
  );
}
