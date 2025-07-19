// backend/lib/cors.js

// Lista de domínios (origens) que têm permissão para acessar sua API.
// Usamos a URL do erro de CORS que vimos anteriormente.
const allowedOrigins = [
  "https://lead-talksv1.vercel.app",
  "http://localhost:5173", // Ambiente de dev
  "http://localhost:4173", // Ambiente de dev
];

// Esta é a ÚNICA função que o arquivo precisa exportar.
export function configurarCors(req, res) {
  const origin = req.headers.origin;

  // Permite a origem se ela estiver na lista de permissões
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  // Cabeçalhos que o navegador do cliente tem permissão para usar na requisição
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Cacheia a resposta do preflight por 24 horas
  res.setHeader("Access-Control-Max-Age", "86400");

  // Para requisições OPTIONS (preflight), respondemos imediatamente com sucesso.
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true; // Indica que a requisição foi tratada e deve parar aqui.
  }

  return false; // Indica que a requisição deve continuar para a lógica do endpoint.
}
