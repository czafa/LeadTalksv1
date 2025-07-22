// whatsapp-core/core/exportadores.js

import { upsertContatos, upsertGrupos, upsertMembros } from "./supabaseSync.js";

/**
 * PASSO 1: Coleta todos os "humanos" (contatos e participantes de grupos),
 * cria uma lista única e a salva na tabela 'contatos'.
 */
export async function exportarContatosUnicos(store, sock, usuario_id) {
  const contatosDaAgenda = Object.values(store.contacts).map((c) => ({
    numero: c.id.split("@")[0],
    nome: c.name || c.notify || c.pushname || c.id.split("@")[0],
    usuario_id: usuario_id,
  }));

  const chats = store.chats.all().filter((chat) => chat.id.endsWith("@g.us"));
  let participantesDeGrupos = [];
  for (const chat of chats) {
    try {
      const metadata = await sock.groupMetadata(chat.id);
      const participantes = metadata.participants.map((p) => ({
        numero: p.id.split("@")[0],
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

  const todosOsContatos = [...contatosDaAgenda, ...participantesDeGrupos];
  const contatosUnicos = Object.values(
    todosOsContatos.reduce((acc, contato) => {
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
 * PASSO 2: Processa UM ÚNICO grupo e salva as suas relações
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

  await upsertGrupos([grupoParaSalvar]);
  await upsertMembros(membrosParaSalvar);

  // ✅ RETORNA OS DADOS PROCESSADOS
  return { grupoSalvo: grupoParaSalvar, membrosSalvos: membrosParaSalvar };
}
