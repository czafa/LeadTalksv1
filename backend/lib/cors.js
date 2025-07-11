// GitHub/LeadTalksv1/backend/lib/cors.js

export function applyCors(res, req) {
  const isDev = process.env.NODE_ENV !== "production";

  const allowedOrigins = isDev
    ? ["http://localhost:5173", "http://localhost:4173"]
    : [
        "https://lead-talksv1.vercel.app", // ✅ seu frontend
        "https://www.lead-talksv1.vercel.app", // (caso use com www)
      ];

  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    console.warn("[CORS] Origem não permitida:", origin);
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Authorization, Content-Type"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return true;
  }

  return false;
}
