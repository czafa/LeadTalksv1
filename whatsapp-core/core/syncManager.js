// whatsapp-core/core/syncManager.js

import {
  exportarContatosUnicos,
  exportarRelacoesDeGrupos,
} from "./exportadores.js";

let isSyncing = false;
const GRUPOS_A_SINCRONIZAR = new Set();
const GRUPOS_SINCRONIZADOS = new Set();

async function processarFilaDeSincronizacao(sock, store, usuario_id) {
  if (GRUPOS_A_SINCRONIZAR.size === 0) {
    console.log("[SyncManager] ✅ Sincronização de todos os grupos concluída.");
    isSyncing = false;
    return;
  }

  // Pega o próximo grupo da fila
  const proximoGrupoJid = GRUPOS_A_SINCRONIZAR.values().next().value;

  try {
    console.log(
      `[SyncManager] 🔄 A sincronizar grupo: ${proximoGrupoJid} (${GRUPOS_A_SINCRONIZAR.size} restantes)`
    );
    await exportarRelacoesDeGrupos(sock, store, usuario_id, proximoGrupoJid);

    // Marca como concluído e remove da fila
    GRUPOS_SINCRONIZADOS.add(proximoGrupoJid);
    GRUPOS_A_SINCRONIZAR.delete(proximoGrupoJid);

    // Agenda o próximo após um atraso para evitar rate-limit
    setTimeout(
      () => processarFilaDeSincronizacao(sock, store, usuario_id),
      2000
    ); // 2 segundos de atraso
  } catch (error) {
    if (error.message.includes("rate-overlimit")) {
      console.warn(
        `[SyncManager] ⚠️ Rate limit atingido. A pausar por 5 minutos...`
      );
      // Se houver rate-limit, espera mais tempo e tenta o mesmo grupo novamente
      setTimeout(
        () => processarFilaDeSincronizacao(sock, store, usuario_id),
        5 * 60 * 1000
      ); // 5 minutos
    } else {
      console.error(
        `[SyncManager] ❌ Erro ao sincronizar grupo ${proximoGrupoJid}. A tentar o próximo.`,
        error
      );
      GRUPOS_A_SINCRONIZAR.delete(proximoGrupoJid); // Remove para não ficar preso
      setTimeout(
        () => processarFilaDeSincronizacao(sock, store, usuario_id),
        2000
      );
    }
  }
}

export async function iniciarSincronizacaoCompleta(sock, store, usuario_id) {
  if (isSyncing) {
    console.log("[SyncManager] Sincronização já em andamento.");
    return;
  }
  isSyncing = true;
  console.log("[SyncManager] Iniciando processo de sincronização completa...");

  // Limpa o estado de sincronizações anteriores
  GRUPOS_A_SINCRONIZAR.clear();
  GRUPOS_SINCRONIZADOS.clear();

  // PASSO 1: Sincroniza todos os contatos únicos de uma vez.
  await exportarContatosUnicos(store, sock, usuario_id);

  // PASSO 2: Prepara a lista de TODOS os grupos para sincronizar os membros.
  const chats = store.chats.all().filter((chat) => chat.id.endsWith("@g.us"));
  chats.forEach((chat) => GRUPOS_A_SINCRONIZAR.add(chat.id));

  console.log(
    `[SyncManager] ${GRUPOS_A_SINCRONIZAR.size} grupos na fila para sincronizar membros.`
  );

  // Inicia o processamento da fila
  processarFilaDeSincronizacao(sock, store, usuario_id);
}
