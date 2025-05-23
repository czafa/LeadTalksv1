//frontend/src/pages/Home.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const BACKEND_URL = import.meta.env.VITE_API_URL;

type Contato = {
  id: string;
  nome: string;
  numero: string;
};

type Grupo = {
  grupo_jid: string;
  nome: string;
  tamanho: number;
};

type Membro = { nome: string; numero: string };
type MembrosPorGrupo = Record<string, Membro[]>;

export default function Home() {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [membrosPorGrupo, setMembrosPorGrupo] = useState<MembrosPorGrupo>({});
  const [gruposExpandido, setGruposExpandido] = useState<
    Record<string, boolean>
  >({});
  const [mensagem, setMensagem] = useState("");
  const [intervalo, setIntervalo] = useState(10);
  const [logEnvio, setLogEnvio] = useState<string[]>([]);
  const [contatosSelecionados, setContatosSelecionados] = useState<string[]>(
    []
  );

  useEffect(() => {
    const fetchDados = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const userId = userData.user?.id;

      if (!userId || !token) return;

      const sessaoRes = await fetch(`${BACKEND_URL}/sessao`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ usuario_id: userId }),
      });

      const sessao = await sessaoRes.json();
      if (!sessao.ativo) {
        console.warn("Sessão WhatsApp não está ativa");
        return;
      }

      const [contatoRes, grupoRes, membrosRes] = await Promise.all([
        fetch(`${BACKEND_URL}/contatos?usuario_id=${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((res) => res.json()),
        fetch(`${BACKEND_URL}/grupos?usuario_id=${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((res) => res.json()),
        fetch(`${BACKEND_URL}/membros-grupos?usuario_id=${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((res) => res.json()),
      ]);

      if (Array.isArray(contatoRes)) {
        setContatos(contatoRes);
      } else {
        console.error("Erro ao carregar contatos:", contatoRes?.error);
        setContatos([]);
      }

      setGrupos(grupoRes);
      setMembrosPorGrupo(membrosRes.grupos || {});
    };

    fetchDados();
  }, []);

  const obterNome = (numero: string) => {
    const contato = contatos.find((c) => c.numero === numero);
    return contato?.nome || "contato";
  };

  const toggleGrupo = (jid: string) => {
    setGruposExpandido((prev) => ({ ...prev, [jid]: !prev[jid] }));
  };

  const selecionarGrupo = (jid: string, membros: Membro[]) => {
    const numeros = membros.map((m) => m.numero);
    const todosSelecionados = numeros.every((n) =>
      contatosSelecionados.includes(n)
    );

    setContatosSelecionados((prev) => {
      if (todosSelecionados) {
        return prev.filter((n) => !numeros.includes(n));
      } else {
        return [...new Set([...prev, ...numeros])];
      }
    });
  };

  const handleEnviarMensagens = async () => {
    if (contatosSelecionados.length === 0 || mensagem.trim() === "") {
      alert("Selecione ao menos 1 contato e escreva uma mensagem.");
      return;
    }

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    for (let i = 0; i < contatosSelecionados.length; i++) {
      const numero = contatosSelecionados[i];
      const nome = obterNome(numero);
      const msgPersonalizada = mensagem.replace("{{nome}}", nome);

      try {
        const res = await fetch(`${BACKEND_URL}/enviar`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ numero, mensagem: msgPersonalizada }),
        });

        if (!res.ok) {
          const erro = await res.json();
          throw new Error(erro.error || "Erro ao enviar");
        }

        setLogEnvio((prev) => [...prev, `✅ ${numero}`]);
      } catch (err) {
        setLogEnvio((prev) => [...prev, `❌ ${numero}: ${err}`]);
      }

      await new Promise((r) => setTimeout(r, intervalo * 1000));
    }
  };

  const [filtroNome, setFiltroNome] = useState("");

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end mb-4">
        <input
          type="text"
          placeholder="🔍 Pesquise um contato"
          value={filtroNome}
          onChange={(e) => setFiltroNome(e.target.value.toLowerCase())}
          className="border border-gray-300 rounded p-2 w-full"
        />
        <textarea
          placeholder="Mensagem personalizada (use {{nome}})"
          rows={1}
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          className="border border-gray-300 rounded p-2 w-full resize-none"
        />
        <input
          type="number"
          placeholder="Intervalo (segundos)"
          value={intervalo}
          min={1}
          onChange={(e) => setIntervalo(Number(e.target.value))}
          className="border border-gray-300 rounded p-2 w-full"
        />
        <button
          onClick={handleEnviarMensagens}
          className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded"
        >
          📨 Enviar
        </button>
      </div>

      <pre className="bg-white text-gray-800 p-4 rounded shadow max-h-64 overflow-y-auto whitespace-pre-wrap">
        {logEnvio.join("\n")}
      </pre>
      <button
        onClick={() => setLogEnvio([])}
        className="ml-4 bg-red-100 hover:bg-red-200 text-red-800 font-bold py-2 px-4 rounded"
      >
        🧹 Limpar Log
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div className="bg-white shadow rounded p-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Contatos</h2>
          <ul className="space-y-2">
            {contatos
              .filter((contato) =>
                contato.nome.toLowerCase().includes(filtroNome)
              )
              .map((contato) => (
                <li
                  key={contato.id}
                  className="flex items-center justify-between border p-2 rounded"
                >
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      value={contato.numero}
                      checked={contatosSelecionados.includes(contato.numero)}
                      onChange={(e) => {
                        const numero = e.target.value;
                        setContatosSelecionados((prev) =>
                          e.target.checked
                            ? [...prev, numero]
                            : prev.filter((n) => n !== numero)
                        );
                      }}
                    />
                    {contato.nome} ({contato.numero})
                  </label>
                </li>
              ))}
          </ul>
        </div>

        <div className="bg-white shadow rounded p-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Grupos</h2>
          <ul className="space-y-4">
            {grupos.map((grupo) => {
              const membros = membrosPorGrupo[grupo.grupo_jid] || [];
              const expandido = gruposExpandido[grupo.grupo_jid] || false;
              const todosSelecionados = membros.every((m) =>
                contatosSelecionados.includes(m.numero)
              );
              return (
                <li key={grupo.grupo_jid} className="border rounded p-2">
                  <div className="flex justify-between items-center">
                    <div className="font-bold">
                      {grupo.nome} ({grupo.tamanho} membros)
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="text-blue-600 underline"
                        onClick={() => toggleGrupo(grupo.grupo_jid)}
                      >
                        {expandido ? "Fechar" : "Ver membros"}
                      </button>
                      <input
                        type="checkbox"
                        checked={todosSelecionados}
                        onChange={() =>
                          selecionarGrupo(grupo.grupo_jid, membros)
                        }
                      />
                    </div>
                  </div>
                  {expandido && (
                    <ul className="ml-4 mt-2 list-disc text-sm">
                      {membros.map((membro, i) => (
                        <li key={i}>
                          {membro.nome} ({membro.numero})
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
