import express from "express";
import { startLeadTalk } from "../leadtalks.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.get("/api/start-session", async (req, res) => {
  try {
    await startLeadTalk();
    res.status(200).json({ status: "Sessão iniciada com sucesso." });
  } catch (error) {
    console.error("[LeadTalk] Erro ao iniciar sessão:", error);
    res.status(500).json({ error: "Erro ao iniciar sessão." });
  }
});

app.listen(PORT, () => {
  console.log(`[LeadTalk] API de sessão ativa na porta ${PORT}`);
});
