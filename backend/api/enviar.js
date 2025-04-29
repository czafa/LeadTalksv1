module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { numero, mensagem } = req.body;

  // aqui você pode repassar para o whatsapp-core
  try {
    const resposta = await fetch("http://ip-da-vm:3000/api/enviar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numero, mensagem }),
    });

    const resultado = await resposta.json();
    return res.status(200).json({ status: "enviado", retorno: resultado });
  } catch (e) {
    console.error("Erro no envio:", e);
    return res.status(500).json({ error: "Falha ao enviar mensagem" });
  }
};
