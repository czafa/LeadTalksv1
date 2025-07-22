// whatsapp-core/core/exportadores.js

import { upsertContatos, upsertGrupos, upsertMembros } from "./supabaseSync.js";

/**
 * PASSO 1: Coleta todos os "humanos" (contatos e participantes de grupos),
 * cria uma lista única e a salva na tabela 'contatos'.
 * Esta função cria a nossa fonte única da verdade para pessoas.
 */
async function exportarContatosUnicos(store, sock, usuario_id) {
  // Pega os contatos salvos na agenda
  const contatosDaAgenda = Object.values(store.contacts).map((c) => ({
    numero: c.id.split("@")[0],
    nome: c.name || c.notify || c.pushname || c.id.split("@")[0],
    usuario_id: usuario_id,
  }));

  // Pega todos os participantes de todos os grupos
  const chats = store.chats.all().filter((chat) => chat.id.endsWith("@g.us"));
  let participantesDeGrupos = [];
  for (const chat of chats) {
    try {
      const metadata = await sock.groupMetadata(chat.id);
      const participantes = metadata.participants.map((p) => ({
        numero: p.id.split("@")[0],
        // O nome aqui é o 'pushname', que servirá de fallback se o contato não estiver na agenda
        nome: store.contacts[p.id]?.pushname || p.id.split("@")[0],
        usuario_id: usuario_id,
      }));
      participantesDeGrupos.push(...participantes);
    } catch (e) {
      console.warn(
        `[Exportadores] Falha ao buscar metadados do grupo ${chat.id}`
      );
    }
  }

  // Junta as duas listas (agenda + participantes)
  const todosOsContatos = [...contatosDaAgenda, ...participantesDeGrupos];

  // Remove duplicatas, garantindo que cada número apareça apenas uma vez
  const contatosUnicos = Object.values(
    todosOsContatos.reduce((acc, contato) => {
      // A lógica de 'upsert' já lida com a priorização de nomes,
      // mas podemos fazer uma pré-filtragem aqui para garantir qualidade.
      acc[contato.numero] = acc[contato.numero] || contato;
      return acc;
    }, {})
  );

  console.log(
    `[Exportadores] Total de ${contatosUnicos.length} contatos únicos encontrados para sincronizar.`
  );
  await upsertContatos(contatosUnicos);
}

/**
 * PASSO 2: Itera sobre os grupos e salva apenas as RELAÇÕES
 * na tabela 'membros_grupos'.
 */
export async function exportarRelacoesDeGrupos(
  sock,
  store,
  usuario_id,
  grupoJid
) {
  const metadata = await sock.groupMetadata(grupoJid);

  const grupoParaSalvar = {
    nome: metadata.subject,
    jid: metadata.id,
    grupo_jid: metadata.id,
    tamanho: metadata.participants.length,
    usuario_id,
  };

  const membrosParaSalvar = metadata.participants.map((p) => ({
    usuario_id: usuario_id,
    grupo_jid: metadata.id,
    membro_numero: p.id.split("@")[0],
    membro_nome:
      store.contacts[p.id]?.name ||
      store.contacts[p.id]?.pushname ||
      p.id.split("@")[0],
    admin: p.admin === "admin" || p.admin === "superadmin",
  }));

  // O 'upsert' lida com a inserção ou atualização
  await upsertGrupos([grupoParaSalvar]);
  await upsertMembros(membrosParaSalvar);
}

/**
 * PASSO 3: Orquestra a sincronização completa, seguindo a ordem correta.
 */
export async function sincronizarContatosEmBackground(sock, store, usuario_id) {
  console.log(
    `[Sync] Iniciando sincronização em background para ${usuario_id}`
  );
  try {
    // Primeiro, popula a tabela 'contatos' com todas as pessoas únicas
    await exportarContatosUnicos(store, sock, usuario_id);

    // Depois, popula as tabelas 'grupos' e 'membros_grupos' (as relações)
    await exportarRelacoesDeGrupos(sock, store, usuario_id);

    console.log(
      `[Sync] Sincronização em background concluída para ${usuario_id}`
    );
  } catch (error) {
    console.error(
      `[Sync] Erro durante a sincronização para ${usuario_id}:`,
      error
    );
  }
}
