// lib/cors.js
export function applyCors(res, req) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
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
    return true; // Preflight request handled
  }
  return false; // Continue with handler logic
}
