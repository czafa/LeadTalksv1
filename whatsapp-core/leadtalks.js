// leadtalks.js
import { criarSocket } from "./core/socketManager.js";

/**
 * Inicia a conexão com o WhatsApp via Baileys para o usuário fornecido.
 * Compatível com o padrão esperado por server.js
 *
 * @param {Object} params
 * @param {string} params.usuario_id - ID do usuário autenticado no Supabase
 * @param {Function} [params.onQr] - Callback para lidar com o QR Code gerado
 * @returns {Promise} Instância do socket
 */
export async function startLeadTalk({ usuario_id, onQr, io }) {
  return criarSocket(usuario_id, onQr, io);
}
