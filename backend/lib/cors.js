// backend/lib/cors.js

// Lista de domínios (origens) que têm permissão para acessar sua API.
const allowedOrigins = [
  "https://lead-talksv1.vercel.app",
  "https://lead-backsv1.vercel.app",
  "https://lead-backend-tan.vercel.app",
  "http://localhost:5173", // Dev Vite
  "http://localhost:4173", // Dev Vite preview
];

// Esta é a ÚNICA função que o arquivo precisa exportar.
export function configurarCors(req, res) {
  const origin = req.headers.origin ?? "";

  console.log("🛡️ CORS Origin recebido:", origin);

  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
    res.setHeader("Access-Control-Max-Age", "86400");

    if (req.method === "OPTIONS") {
      res.status(204).end(); // No Content
      return true;
    }
  } else {
    console.warn("🚫 Origem não permitida pelo CORS:", origin);
  }

  return false; // Continua para a lógica da rota
}
