import fs from "fs";
import { upsertContatos, upsertGrupos, upsertMembros } from "./supabaseSync.js";

/**
 * Exporta contatos para arquivo local e Supabase.
 */
export async function exportarContatos(store, usuario_id) {
  const contatos = Object.entries(store.contacts).map(([jid, contato]) => ({
    nome:
      contato.name || contato.notify || contato.pushname || jid.split("@")[0],
    numero: jid.split("@")[0],
    tipo: jid.includes("@g.us") ? "grupo" : "contato",
    usuario_id,
  }));

  const arquivo = `./data/contatos_${usuario_id}.json`;
  let contatosExistentes = [];

  if (fs.existsSync(arquivo)) {
    try {
      const raw = fs.readFileSync(arquivo, "utf-8");
      contatosExistentes = JSON.parse(raw);
    } catch (err) {
      console.warn(`[LeadTalk] ⚠️ Erro ao ler ${arquivo}: ${err.message}`);
    }
  }

  const novos = contatos.filter(
    (novo) => !contatosExistentes.some((c) => c.numero === novo.numero)
  );

  const todos = [...contatosExistentes, ...novos];
  fs.writeFileSync(arquivo, JSON.stringify(todos, null, 2));
  console.log(
    `[LeadTalk] 📱 ${todos.length} contatos salvos para ${usuario_id}`
  );
  await upsertContatos(todos);

  return todos; // <== ADICIONAR ESTA LINHA
}

/**
 * Exporta grupos e membros, cruzando informações para obter nomes.
 */
export async function exportarGruposESuasPessoas(sock, store, usuario_id) {
  const grupos = store.chats.all().filter((chat) => chat.id.endsWith("@g.us"));
  const gruposFormatados = [];
  const membrosPorGrupo = {};

  for (const grupo of grupos) {
    try {
      const metadata = await sock.groupMetadata(grupo.id);

      gruposFormatados.push({
        nome: metadata.subject,
        jid: metadata.id,
        grupo_jid: metadata.id,
        tamanho: metadata.participants.length,
        usuario_id,
      });

      // LÓGICA DE MEMBROS
      membrosPorGrupo[metadata.id] = metadata.participants.map((p) => {
        const numero = p.id.split("@")[0];

        // O 'baileys' não fornece pushname diretamente na lista de participantes.
        // A abordagem correta continua sendo cruzar com o 'store.contacts'.
        const contatoInfo = store.contacts[p.id];

        // Ordem de prioridade: 1. Nome salvo, 2. Pushname, 3. Número
        const nomeFinal =
          contatoInfo?.name ||
          contatoInfo?.notify ||
          contatoInfo?.pushname ||
          numero;

        return {
          numero: numero,
          jid: p.id,
          grupo_jid: metadata.id,
          grupo_nome: metadata.subject,
          membro_nome: nomeFinal, // Usa o nome encontrado na ordem de prioridade
          membro_numero: numero,
          admin: p.admin === "admin" || p.admin === "superadmin",
          usuario_id,
        };
      });

      await new Promise((resolve) => setTimeout(resolve, 300)); // Delay para evitar bloqueio
    } catch (err) {
      console.warn(
        `[LeadTalk] ⚠️ Falha ao buscar metadata de ${grupo.id}: ${err.message}. O grupo será salvo sem membros.`
      );
      // ✅ GARANTE QUE O GRUPO SEJA SALVO MESMO SEM MEMBROS
      gruposFormatados.push({
        nome: grupo.name || grupo.id,
        jid: grupo.id,
        grupo_jid: grupo.id,
        tamanho: 0, // Define o tamanho como 0 se não conseguir obter os membros
        usuario_id,
      });
      membrosPorGrupo[grupo.id] = []; // Adiciona uma entrada vazia para evitar erros
    }
  }

  // A sua lógica de salvar em arquivos pode permanecer aqui...

  await upsertGrupos(gruposFormatados);
  await upsertMembros(membrosPorGrupo);
}

/**
 * Orquestra a sincronização completa de contatos e grupos em segundo plano.
 */
export async function sincronizarContatosEmBackground(sock, store, usuario_id) {
  console.log(
    `[Sync] Iniciando sincronização em background para ${usuario_id}`
  );
  try {
    // Exporta contatos e grupos com seus membros
    await exportarContatos(store, usuario_id);
    await exportarGruposESuasPessoas(sock, store, usuario_id);

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
