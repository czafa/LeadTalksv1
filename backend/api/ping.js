export default function handler(req, res) {
  console.log("🟢 Ping recebido em /api/ping");
  return res.status(200).json({ status: "ok", message: "Backend ativo" });
}
