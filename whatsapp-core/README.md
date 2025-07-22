// frontend/src/pages/Home.tsx

import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import io from "socket.io-client";
import type { Socket } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_API_URL;

type Contato = { nome: string; numero: string; };
type Grupo = { grupo_jid: string; nome: string; tamanho: number; };
type Membro = { nome: string; numero: string };
type MembrosPorGrupo = Record<string, Membro[]>;
type ProgressoSync = { atual: number; total: number };

export default function Home() {
const supabase = useSupabaseClient();
const user = useUser();
const navigate = useNavigate();
const socketRef = useRef<Socket | null>(null);

const [loading, setLoading] = useState(true);
const [contatos, setContatos] = useState<Contato[]>([]);
const [grupos, setGrupos] = useState<Grupo[]>([]);
const [membrosPorGrupo, setMembrosPorGrupo] = useState<MembrosPorGrupo>({});
const [progressoSync, setProgressoSync] = useState<ProgressoSync | null>(null);
// ... (outros estados como filtroNome, mensagem, etc.)

const fetchContatos = useCallback(async () => {
if (!user) return;
try {
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
if (!token) return;
const pessoasRes = await fetch(`${BACKEND_URL}/api/pessoas?usuario_id=${user.id}`, { headers: { Authorization: `Bearer ${token}` } }).then((res) => res.json());
setContatos(Array.isArray(pessoasRes) ? pessoasRes : []);
} catch (e) { console.error("Falha ao buscar contatos", e); }
}, [user, supabase]);

useEffect(() => {
if (!user) return;

    // Busca inicial (pode vir vazia, e está tudo bem)
    fetchContatos();

    const setupSocket = async () => {
      if (socketRef.current) return;

      const res = await fetch(`${BACKEND_URL}/socketUrl`);
      const { socketUrl } = await res.json();
      const socket = io(socketUrl, { transports: ["websocket"], path: "/socket.io" });
      socketRef.current = socket;

      socket.on('connect', () => socket.emit('join', user.id));

      // Ouve o evento que diz que a lista de CONTATOS está pronta
      socket.on('contacts_sync_complete', () => {
        console.log('[Home] ✅ Sincronização de contatos concluída! A buscar lista de contatos...');
        fetchContatos();
      });

      // Ouve as atualizações de CADA GRUPO à medida que são sincronizados
      socket.on('group_sync_update', (data: { grupo: Grupo, membros: Membro[], progresso: ProgressoSync }) => {
        console.log(`[Home] 🔄 Recebida atualização para o grupo: ${data.grupo.nome}`);
        // Adiciona/atualiza o grupo na lista
        setGrupos(prevGrupos => {
            const index = prevGrupos.findIndex(g => g.grupo_jid === data.grupo.grupo_jid);
            if (index > -1) {
                const novosGrupos = [...prevGrupos];
                novosGrupos[index] = data.grupo;
                return novosGrupos;
            }
            return [...prevGrupos, data.grupo];
        });
        // Adiciona/atualiza os membros do grupo
        setMembrosPorGrupo(prevMembros => ({
            ...prevMembros,
            [data.grupo.grupo_jid]: data.membros
        }));
        setProgressoSync(data.progresso);
      });

      socket.on('full_sync_complete', () => {
        console.log('[Home] ✅ Sincronização COMPLETA finalizada.');
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

// ... (o resto do seu componente JSX)
// Adicione uma UI para mostrar o progresso da sincronização:
// {progressoSync && (
// <p>Sincronizando grupos: {progressoSync.atual} de {progressoSync.total}...</p>
// )}
}
