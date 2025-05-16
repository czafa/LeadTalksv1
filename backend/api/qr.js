export default async function handler(req, res) {
  console.log("📦 Requisição recebida em /api/qr");
  if (applyCors(res, req)) return;

  try {
    const { data, error } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "ngrok_url")
      .single();

    if (error || !data?.valor) {
      return res
        .status(500)
        .json({ error: "URL do whatsapp-core não encontrada" });
    }

    const apiUrl = data.valor;

    // ✅ INICIAR A SESSÃO para gerar o QR Code
    await fetch(`${apiUrl}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario_id: req.query.usuario_id }),
    });

    // ✅ BUSCAR QR Code
    const resposta = await fetch(`${apiUrl}/api/qr`);
    const qrData = await resposta.json();

    return res.status(200).json(qrData);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro ao buscar QR code" });
  }
}
