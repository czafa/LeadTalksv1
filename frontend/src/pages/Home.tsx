// frontend/src/pages/Home.tsx

import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { useEffect, useState, useCallback, useRef } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import io from "socket.io-client";
import type { Socket } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_API_URL;

// Definição de tipos para clareza
type Contato = {
  id?: string; // Opcional, pois pode não vir da API de pessoas
  nome: string;
  numero: string;
};
type Grupo = { grupo_jid: string; nome: string; tamanho: number };
type Membro = { nome: string; numero: string };
type MembrosPorGrupo = Record<string, Membro[]>;
type ProgressoSync = { atual: number; total: number };

export default function Home() {
  const supabase = useSupabaseClient();
  const user = useUser();
  const socketRef = useRef<Socket | null>(null);

  // Estados do componente
  const [loading, setLoading] = useState(true);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [membrosPorGrupo, setMembrosPorGrupo] = useState<MembrosPorGrupo>({});
  const [progressoSync, setProgressoSync] = useState<ProgressoSync | null>(
    null
  );
  const [gruposExpandido, setGruposExpandido] = useState<
    Record<string, boolean>
  >({});
  const [mensagem, setMensagem] = useState("");
  const [intervalo, setIntervalo] = useState(10);
  const [logEnvio, setLogEnvio] = useState<string[]>([]);
  const [contatosSelecionados, setContatosSelecionados] = useState<string[]>(
    []
  );
  const [filtroNome, setFiltroNome] = useState("");

  // Função reutilizável para buscar a lista principal de contatos
  const fetchContatos = useCallback(async () => {
    if (!user) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const pessoasRes = await fetch(
        `${BACKEND_URL}/api/pessoas?usuario_id=${user.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      ).then((res) => res.json());
      setContatos(Array.isArray(pessoasRes) ? pessoasRes : []);
    } catch (e) {
      console.error("Falha ao buscar contatos", e);
    }
  }, [user, supabase]);

  // Efeito principal que gere a lógica da página
  useEffect(() => {
    if (!user) return;

    // Busca os dados existentes ao carregar (pode vir vazio, e está tudo bem)
    fetchContatos();

    const setupSocket = async () => {
      if (socketRef.current) return;

      const res = await fetch(`${BACKEND_URL}/socketUrl`);
      const { socketUrl } = await res.json();
      const socket = io(socketUrl, {
        transports: ["websocket"],
        path: "/socket.io",
      });
      socketRef.current = socket;

      socket.on("connect", () => socket.emit("join", user.id));

      // Ouve o evento que diz que a lista de CONTATOS está pronta
      socket.on("contacts_sync_complete", () => {
        console.log(
          "[Home] ✅ Sincronização de contatos concluída! A buscar lista de contatos..."
        );
        fetchContatos();
      });

      // Ouve as atualizações de CADA GRUPO à medida que são sincronizados
      socket.on(
        "group_sync_update",
        (data: {
          grupo: Grupo;
          membros: Membro[];
          progresso: ProgressoSync;
        }) => {
          console.log(
            `[Home] 🔄 Recebida atualização para o grupo: ${data.grupo.nome}`
          );
          setGrupos((prevGrupos) => {
            const index = prevGrupos.findIndex(
              (g) => g.grupo_jid === data.grupo.grupo_jid
            );
            if (index > -1) {
              const novosGrupos = [...prevGrupos];
              novosGrupos[index] = data.grupo;
              return novosGrupos;
            }
            return [...prevGrupos, data.grupo];
          });
          setMembrosPorGrupo((prevMembros) => ({
            ...prevMembros,
            [data.grupo.grupo_jid]: data.membros,
          }));
          setProgressoSync(data.progresso);
        }
      );

      socket.on("full_sync_complete", () => {
        console.log("[Home] ✅ Sincronização COMPLETA finalizada.");
        setProgressoSync(null); // Esconde a mensagem de progresso
      });
    };

    setupSocket();
    setLoading(false);

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [user, fetchContatos]);

  // Funções de manipulação da UI
  const toggleGrupo = (jid: string) =>
    setGruposExpandido((prev) => ({ ...prev, [jid]: !prev[jid] }));

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
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;

    for (let i = 0; i < contatosSelecionados.length; i++) {
      const numero = contatosSelecionados[i];
      const nomeContato =
        contatos.find((c) => c.numero === numero)?.nome || numero;
      const msgPersonalizada = mensagem.replace(/{{nome}}/g, nomeContato);

      try {
        const res = await fetch(`${BACKEND_URL}/api/enviar`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ numero, mensagem: msgPersonalizada }),
        });
        if (!res.ok)
          throw new Error((await res.json()).error || "Erro desconhecido");
        setLogEnvio((prev) => [...prev, `✅ ${numero}`]);
      } catch (err) {
        setLogEnvio((prev) => [
          ...prev,
          `❌ ${numero}: ${(err as Error).message}`,
        ]);
      }
      if (i < contatosSelecionados.length - 1) {
        await new Promise((r) => setTimeout(r, intervalo * 1000));
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
        <Loader2 className="h-12 w-12 animate-spin text-green-500" />
        <p className="mt-4 text-lg">A carregar dados...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Barra de Filtros e Ações */}
      <div className="p-4 border-b border-gray-700 bg-gray-800">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <input
            type="text"
            placeholder="🔍 Pesquise por nome ou número"
            value={filtroNome}
            onChange={(e) => setFiltroNome(e.target.value)}
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
            placeholder="Intervalo (s)"
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

      {/* Barra de Logs e Progresso */}
      <div className="px-4 py-2 bg-gray-800 border-b border-gray-700">
        <pre className="bg-gray-950 text-green-300 p-3 rounded max-h-40 overflow-y-auto whitespace-pre-wrap">
          {logEnvio.join("\n") || "Nenhuma mensagem enviada ainda..."}
        </pre>
        <div className="flex justify-between items-center mt-2">
          <button
            onClick={() => setLogEnvio([])}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-4 rounded"
          >
            🧹 Limpar Log
          </button>
          {progressoSync && (
            <div className="flex items-center gap-2 text-yellow-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>
                Sincronizando grupos: {progressoSync.atual} de{" "}
                {progressoSync.total}...
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Painéis Principais */}
      <div className="flex flex-1 overflow-hidden">
        {/* Contatos e Membros */}
        <div className="w-full md:w-1/2 border-r border-gray-700 overflow-y-auto p-4">
          <h2 className="text-lg font-semibold mb-4">Contatos e Membros</h2>
          <ul className="space-y-2">
            {contatos
              .filter((contato) => {
                const filtro = filtroNome.toLowerCase();
                if (!filtro) return true;
                return (
                  contato.nome.toLowerCase().includes(filtro) ||
                  contato.numero.includes(filtro)
                );
              })
              .map((contato, index) => (
                <li
                  key={`${contato.numero}-${index}`}
                  className="flex items-center justify-between border border-gray-700 p-2 rounded hover:bg-gray-800"
                >
                  <label className="flex items-center gap-2 cursor-pointer w-full">
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
                    <span className="truncate">
                      {contato.nome} ({contato.numero})
                    </span>
                  </label>
                </li>
              ))}
          </ul>
        </div>

        {/* Grupos */}
        <div className="w-full md:w-1/2 overflow-y-auto p-4">
          <h2 className="text-lg font-semibold mb-4">Grupos</h2>
          <ul className="space-y-4">
            {grupos.map((grupo) => {
              const membros = membrosPorGrupo[grupo.grupo_jid];
              const expandido = gruposExpandido[grupo.grupo_jid] || false;
              const todosSelecionados =
                membros?.every((m) =>
                  contatosSelecionados.includes(m.numero)
                ) ?? false;

              return (
                <li
                  key={grupo.grupo_jid}
                  className="border border-gray-700 rounded p-2"
                >
                  <div className="flex justify-between items-center">
                    <input
                      type="checkbox"
                      checked={todosSelecionados}
                      disabled={!membros || membros.length === 0}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => selecionarGrupo(membros || [])}
                    />
                    <span
                      className="flex-1 text-center font-bold cursor-pointer"
                      onClick={() => toggleGrupo(grupo.grupo_jid)}
                    >
                      {grupo.nome} ({grupo.tamanho} membros)
                    </span>
                    <button
                      className="text-gray-400 px-2"
                      onClick={() => toggleGrupo(grupo.grupo_jid)}
                    >
                      {expandido ? (
                        <ChevronDown size={20} />
                      ) : (
                        <ChevronRight size={20} />
                      )}
                    </button>
                  </div>

                  {expandido && (
                    <div className="ml-4 mt-2 space-y-1 text-sm border-t border-gray-700 pt-2">
                      {membros && membros.length > 0 && (
                        <ul>
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
                      {membros && membros.length === 0 && (
                        <p className="text-gray-500 italic">
                          Este grupo não tem outros membros.
                        </p>
                      )}
                      {membros === undefined && (
                        <div className="flex items-center gap-2 text-yellow-400">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>A sincronizar membros...</span>
                        </div>
                      )}
                    </div>
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
