// whatsapp-core/sender.js
export async function enviarMensagens(
  sock,
  contatos,
  mensagem,
  intervaloSegundos = 5
) {
  function personalizarMensagem(template, nome) {
    return template.replace(/{{\s*nome\s*}}/gi, nome);
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  for (const contato of contatos) {
    const jid = `${contato.numero.replace(/[^\d]/g, "")}@s.whatsapp.net`;
    const msg = personalizarMensagem(mensagem, contato.nome);

    try {
      console.log(`📤 Enviando para ${contato.nome} (${contato.numero})...`);
      await sock.sendMessage(jid, { text: msg });
      console.log(`✅ Mensagem enviada para ${contato.nome}`);
    } catch (err) {
      console.error(`❌ Erro ao enviar para ${contato.nome}:`, err.message);
    }

    const espera = intervaloSegundos * 1000;
    const esperaAleatoria = espera + Math.floor(Math.random() * espera);
    console.log(
      `⏳ Aguardando ${Math.round(esperaAleatoria / 1000)} segundos...\n`
    );
    await delay(esperaAleatoria);
  }

  console.log("🏁 Envio concluído.");
}
