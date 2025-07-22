// whatsapp-core/core/syncManager.js

import {
  exportarContatosUnicos,
  exportarRelacoesDeGrupos,
} from "./exportadores.js";

let isSyncing = false;

async function processarTodosOsGrupos(sock, store, usuario_id, io) {
  const chats = store.chats.all().filter((chat) => chat.id.endsWith("@g.us"));
  console.log(
    `[SyncManager] Encontrados ${chats.length} grupos para processar as relações.`
  );

  for (const [index, chat] of chats.entries()) {
    try {
      console.log(
        `[SyncManager] 🔄 A processar grupo ${index + 1} de ${chats.length}: ${
          chat.id
        }`
      );
      // A função 'exportarRelacoesDeGrupos' agora retorna os dados que salvou
      const { grupoSalvo, membrosSalvos } = await exportarRelacoesDeGrupos(
        sock,
        store,
        usuario_id,
        chat.id
      );

      // Emite uma atualização em tempo real para o frontend com os novos dados
      io?.to(usuario_id).emit("group_sync_update", {
        grupo: grupoSalvo,
        membros: membrosSalvos,
        progresso: { atual: index + 1, total: chats.length },
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.warn(
        `[SyncManager] ⚠️ Falha ao processar o grupo ${chat.id}. Erro: ${error.message}. A continuar...`
      );
    }
  }
  console.log("[SyncManager] ✅ Sincronização de todos os grupos concluída.");
}

export async function iniciarSincronizacaoCompleta(
  sock,
  store,
  usuario_id,
  io
) {
  if (isSyncing) {
    console.log("[SyncManager] Sincronização já em andamento.");
    return;
  }
  isSyncing = true;
  console.log("[SyncManager] Iniciando processo de sincronização completa...");

  try {
    console.log("[SyncManager] Passo 1: Sincronizando contatos únicos...");
    await exportarContatosUnicos(store, sock, usuario_id);
    // Notifica o frontend que os contatos estão prontos para serem buscados
    io?.to(usuario_id).emit("contacts_sync_complete");
    console.log("[SyncManager] Passo 1 (Contatos) concluído e evento emitido.");

    console.log("[SyncManager] Passo 2: Sincronizando grupos e membros...");
    await processarTodosOsGrupos(sock, store, usuario_id, io);
    console.log("[SyncManager] Passo 2 (Grupos) concluído.");
  } catch (e) {
    console.error("[SyncManager] ❌ Erro fatal durante a sincronização:", e);
  } finally {
    isSyncing = false;
    io?.to(usuario_id).emit("full_sync_complete");
    console.log(
      "[SyncManager] Processo de sincronização finalizado e evento emitido."
    );
  }
}
