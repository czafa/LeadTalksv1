import { useEffect, useState } from "react";

interface Contato {
  id?: string;
  nome: string;
  numero: string;
}

interface Grupo {
  grupo_jid: string;
  nome: string;
  tamanho: number;
}

interface MembroGrupo {
  nome: string;
  numero: string;
}

export function useLeadTalks(usuario_id: string) {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [membrosPorGrupo, setMembrosPorGrupo] = useState<
    Record<string, MembroGrupo[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!usuario_id) return;

    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/contatos?usuario_id=${usuario_id}`).then((r) => {
        if (!r.ok) throw new Error("Erro ao buscar contatos");
        return r.json();
      }),
      fetch(`/api/grupos?usuario_id=${usuario_id}`).then((r) => {
        if (!r.ok) throw new Error("Erro ao buscar grupos");
        return r.json();
      }),
      fetch(`/api/membros-grupos?usuario_id=${usuario_id}`).then((r) => {
        if (!r.ok) throw new Error("Erro ao buscar membros dos grupos");
        return r.json();
      }),
    ])
      .then(([contatos, grupos, membrosData]) => {
        console.log("📦 membrosData:", membrosData);
        setContatos(contatos);
        setGrupos(grupos);
        if (membrosData && typeof membrosData.grupos === "object") {
          setMembrosPorGrupo(membrosData.grupos);
        } else {
          console.warn("⚠️ Estrutura inválida em membrosData:", membrosData);
          setMembrosPorGrupo({});
        }
      })
      .catch((err) => {
        console.error("Erro em useLeadTalks:", err);
        setError(err.message || "Erro desconhecido");
      })
      .finally(() => setLoading(false));
  }, [usuario_id]);

  return { contatos, grupos, membrosPorGrupo, loading, error };
}
