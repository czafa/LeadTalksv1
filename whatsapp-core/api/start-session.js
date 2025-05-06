import express from "express";
import { startLeadTalk } from "../leadtalks.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.get("/api/start-session", async (req, res) => {
  const usuario_id = req.headers["x-usuario-id"]; // ou da query/body, como preferir

  if (!usuario_id) {
    return res.status(400).json({ error: "usuario_id ausente" });
  }

  try {
    await startLeadTalk({ usuario_id });
    res.status(200).json({ status: "Sessão iniciada com sucesso." });
  } catch (error) {
    console.error("[LeadTalk] Erro ao iniciar sessão:", error);
    res.status(500).json({ error: "Erro ao iniciar sessão." });
  }
});
