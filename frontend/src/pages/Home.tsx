//frontend/src/pages/Home.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { ChevronDown, ChevronRight } from "lucide-react";

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

  const selecionarGrupo = (membros: Membro[]) => {
    const numeros = membros.map((m) => m.numero);
    const todosSelecionados = numeros.every((n) =>
      contatosSelecionados.includes(n)
    );

    setContatosSelecionados((prev) =>
      todosSelecionados
        ? prev.filter((n) => !numeros.includes(n))
        : [...new Set([...prev, ...numeros])]
    );
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
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* 🔍 Filtros e mensagem */}
      <div className="p-4 border-b border-gray-700 bg-gray-800">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <input
            type="text"
            placeholder="🔍 Pesquise um contato"
            value={filtroNome}
            onChange={(e) => setFiltroNome(e.target.value.toLowerCase())}
            className="border border-gray-600 rounded p-2 w-full bg-gray-700 placeholder-gray-400"
          />
          <textarea
            placeholder="Mensagem personalizada (use {{nome}})"
            rows={1}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            className="border border-gray-600 rounded p-2 w-full bg-gray-700 resize-none placeholder-gray-400"
          />
          <input
            type="number"
            placeholder="Intervalo (segundos)"
            value={intervalo}
            min={1}
            onChange={(e) => setIntervalo(Number(e.target.value))}
            className="border border-gray-600 rounded p-2 w-full bg-gray-700 placeholder-gray-400"
          />
          <button
            onClick={handleEnviarMensagens}
            className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded w-full"
          >
            📨 Enviar
          </button>
        </div>
      </div>

      {/* 📜 Logs */}
      <div className="px-4 py-2 bg-gray-800 border-b border-gray-700">
        <pre className="bg-gray-950 text-green-300 p-3 rounded max-h-40 overflow-y-auto whitespace-pre-wrap">
          {logEnvio.join("\n") || "Nenhuma mensagem enviada ainda..."}
        </pre>
        <button
          onClick={() => setLogEnvio([])}
          className="mt-2 bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-4 rounded"
        >
          🧹 Limpar Log
        </button>
      </div>

      {/* 📋 Painéis principais */}
      <div className="flex flex-1 overflow-hidden">
        {/* 🧑 Contatos */}
        <div className="w-full md:w-1/2 border-r border-gray-700 overflow-y-auto p-4">
          <h2 className="text-lg font-semibold mb-4">Contatos</h2>
          <ul className="space-y-2">
            {contatos
              .filter((contato) =>
                contato.nome.toLowerCase().includes(filtroNome)
              )
              .map((contato) => (
                <li
                  key={contato.id}
                  className="flex items-center justify-between border border-gray-700 p-2 rounded hover:bg-gray-800"
                >
                  <label className="flex items-center gap-2 cursor-pointer">
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

        {/* 👥 Grupos */}
        <div className="w-full md:w-1/2 overflow-y-auto p-4">
          <h2 className="text-lg font-semibold mb-4">Grupos</h2>
          <ul className="space-y-4">
            {grupos.map((grupo) => {
              const membros = membrosPorGrupo[grupo.grupo_jid] || [];
              const expandido = gruposExpandido[grupo.grupo_jid] || false;
              const todosSelecionados = membros.every((m) =>
                contatosSelecionados.includes(m.numero)
              );

              return (
                <li
                  key={grupo.grupo_jid}
                  className="border border-gray-700 rounded p-2"
                >
                  <div className="flex justify-between items-center">
                    <input
                      type="checkbox"
                      checked={todosSelecionados}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => selecionarGrupo(membros)}
                    />
                    <span
                      className="flex-1 text-center font-bold cursor-pointer"
                      onClick={() => toggleGrupo(grupo.grupo_jid)}
                    >
                      {grupo.nome} ({grupo.tamanho} membros)
                    </span>
                    <button
                      className="text-gray-400 px-2"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleGrupo(grupo.grupo_jid);
                      }}
                    >
                      {expandido ? (
                        <ChevronDown size={20} />
                      ) : (
                        <ChevronRight size={20} />
                      )}
                    </button>
                  </div>

                  {expandido && membros.length > 0 && (
                    <ul className="ml-4 mt-2 space-y-1 text-sm">
                      {membros.map((membro, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={contatosSelecionados.includes(
                              membro.numero
                            )}
                            onChange={(e) => {
                              const numero = membro.numero;
                              setContatosSelecionados((prev) =>
                                e.target.checked
                                  ? [...prev, numero]
                                  : prev.filter((n) => n !== numero)
                              );
                            }}
                          />
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
