import { supabase } from "./supabase.js";

export async function validarRequisicaoSessao(req) {
  const origin = req.headers.origin;

  // 🔒 Verifica origem da requisição
  const allowedOrigins = [
    "https://lead-talksv1.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
  ];
  if (!allowedOrigins.includes(origin)) {
    return { autorizado: false, erro: "Origem não autorizada", status: 403 };
  }

  // ✅ Bloqueia preflight e métodos que não devem validar
  if (req.method === "OPTIONS") {
    return { autorizado: true }; // Permitir preflight sem travar
  }

  // === A partir daqui, é seguro acessar o body e headers ===

  const token = req.headers.authorization?.replace("Bearer ", "");
  const body = req.body;

  // ✅ Caso com token (login completo)
  if (token) {
    const { data: userData, error: authError } = await supabase.auth.getUser(
      token
    );
    if (authError || !userData?.user?.id) {
      return { autorizado: false, erro: "Token inválido", status: 401 };
    }

    return {
      autorizado: true,
      usuario_id: userData.user.id,
      viaToken: true,
    };
  }

  // ✅ Caso sem token, mas body válido e seguro (encerramento)
  if (body?.usuario_id && body?.ativo === false && body?.sem_token === true) {
    return {
      autorizado: true,
      usuario_id: body.usuario_id,
      viaToken: false,
    };
  }

  return {
    autorizado: false,
    erro: "Requisição não autorizada",
    status: 401,
  };
}
