import fs from "fs";
import { upsertContatos, upsertGrupos, upsertMembros } from "./supabaseSync.js";

/**
 * Exporta contatos para arquivo local e Supabase.
 */
export async function exportarContatos(store, usuario_id) {
  const contatos = Object.entries(store.contacts).map(([jid, contato]) => ({
    nome: contato.name || contato.notify || contato.pushname || jid,
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
}

/**
 * Exporta grupos e membros para arquivo local e Supabase.
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

      membrosPorGrupo[metadata.id] = metadata.participants.map((p) => ({
        numero: p.id.split("@")[0],
        jid: p.id,
        grupo_jid: metadata.id,
        grupo_nome: metadata.subject,
        membro_nome: p.id.split("@")[0],
        membro_numero: p.id.split("@")[0],
        admin: p.admin || false,
        usuario_id,
      }));

      await new Promise((resolve) => setTimeout(resolve, 300)); // Delay de 300ms
    } catch (err) {
      console.warn(
        `[LeadTalk] ⚠️ Falha ao buscar metadata de ${grupo.id}: ${err.message}`
      );
    }
  }

  const arquivoGrupos = `./data/grupos_${usuario_id}.json`;
  let gruposExistentes = [];

  if (fs.existsSync(arquivoGrupos)) {
    try {
      const raw = fs.readFileSync(arquivoGrupos, "utf-8");
      gruposExistentes = JSON.parse(raw);
    } catch (err) {
      console.warn(
        `[LeadTalk] ⚠️ Erro ao ler ${arquivoGrupos}: ${err.message}`
      );
    }
  }

  const novosGrupos = gruposFormatados.filter(
    (novo) => !gruposExistentes.some((g) => g.jid === novo.jid)
  );

  const todosGrupos = [...gruposExistentes, ...novosGrupos];
  fs.writeFileSync(arquivoGrupos, JSON.stringify(todosGrupos, null, 2));

  const arquivoMembros = `./data/membros-grupos_${usuario_id}.json`;
  let membrosExistentes = {};

  if (fs.existsSync(arquivoMembros)) {
    try {
      const raw = fs.readFileSync(arquivoMembros, "utf-8");
      membrosExistentes = JSON.parse(raw);
    } catch (err) {
      console.warn(
        `[LeadTalk] ⚠️ Erro ao ler ${arquivoMembros}: ${err.message}`
      );
    }
  }

  for (const [jid, novosMembros] of Object.entries(membrosPorGrupo)) {
    const existentes = membrosExistentes[jid] || [];

    const novosUnicos = novosMembros.filter(
      (novo) => !existentes.some((m) => m.jid === novo.jid)
    );

    membrosExistentes[jid] = [...existentes, ...novosUnicos];
  }

  fs.writeFileSync(arquivoMembros, JSON.stringify(membrosExistentes, null, 2));

  console.log(
    `[LeadTalk] 👥 ${todosGrupos.length} grupos e seus membros salvos para ${usuario_id}`
  );

  await upsertGrupos(todosGrupos);
  await upsertMembros(membrosExistentes);
}
