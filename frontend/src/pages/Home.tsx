import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Contato = {
  id: string;
  nome: string;
  numero: string;
};

export default function Home() {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [mensagem, setMensagem] = useState("");
  const [intervalo, setIntervalo] = useState(10);
  const [logEnvio, setLogEnvio] = useState<string[]>([]);
  const [contatosSelecionados, setContatosSelecionados] = useState<string[]>(
    []
  );

  useEffect(() => {
    const fetchContatos = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      if (!userId) return;

      const { data, error } = await supabase
        .from("contatos")
        .select("id, nome, numero")
        .eq("usuario_id", userId);

      if (error) {
        console.error("Erro ao carregar contatos:", error);
      } else {
        setContatos(data || []);
      }
    };

    fetchContatos();
  }, []);

  const obterNome = (numero: string) => {
    const contato = contatos.find((c) => c.numero === numero);
    return contato?.nome || "contato";
  };

  const handleEnviarMensagens = async () => {
    if (contatosSelecionados.length === 0 || mensagem.trim() === "") {
      alert("Selecione ao menos 1 contato e escreva uma mensagem.");
      return;
    }

    for (let i = 0; i < contatosSelecionados.length; i++) {
      const numero = contatosSelecionados[i];
      const nome = obterNome(numero);
      const msgPersonalizada = mensagem.replace("{{nome}}", nome);

      try {
        const res = await fetch("/api/enviar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ numero, mensagem: msgPersonalizada }),
        });

        if (!res.ok) throw new Error("Erro ao enviar");

        console.log(`✅ Mensagem enviada para ${numero}`);
      } catch (err) {
        console.error(`❌ Falha ao enviar para ${numero}:`, err);
      }

      await new Promise((r) => setTimeout(r, intervalo * 1000));
    }
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      {/* Barra superior */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end mb-4">
        <input
          type="text"
          placeholder="🔍 Pesquise um contato"
          className="border border-gray-300 rounded p-2 w-full"
        />
        <textarea
          placeholder="Mensagem personalizada (use {{nome}})"
          rows={1}
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          className="border border-gray-300 rounded p-2 w-full resize-none"
        />
        <input
          type="number"
          placeholder="Intervalo (segundos)"
          value={intervalo}
          min={1}
          onChange={(e) => setIntervalo(Number(e.target.value))}
          className="border border-gray-300 rounded p-2 w-full"
        />
        <button
          onClick={handleEnviarMensagens}
          className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded"
        >
          📨 Enviar
        </button>
      </div>

      {/* Botão de log */}
      <div className="text-center mb-4">
        <button className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded">
          📄 Ver Log
        </button>
      </div>

      {/* Log */}
      <pre className="bg-white text-gray-800 p-4 rounded shadow max-h-64 overflow-y-auto whitespace-pre-wrap">
        {logEnvio.join("\n")}
      </pre>
      <button
        onClick={() => setLogEnvio([])}
        className="ml-4 bg-red-100 hover:bg-red-200 text-red-800 font-bold py-2 px-4 rounded"
      >
        🧹 Limpar Log
      </button>

      {/* Contatos e Grupos lado a lado */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* Contatos */}
        <div className="bg-white shadow rounded p-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Contatos</h2>
          <ul className="space-y-2">
            {contatos.map((contato) => (
              <li
                key={contato.id}
                className="flex items-center justify-between border p-2 rounded"
              >
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    value={contato.numero}
                    checked={contatosSelecionados.includes(contato.numero)}
                    onChange={(e) => {
                      const numero = e.target.value;
                      setContatosSelecionados((prev) =>
                        e.target.checked
                          ? [...prev, numero]
                          : prev.filter((n) => n !== numero)
                      );
                    }}
                  />
                  {contato.nome} ({contato.numero})
                </label>
              </li>
            ))}
          </ul>
        </div>

        {/* Grupos */}
        <div className="bg-white shadow rounded p-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Grupos</h2>
          <ul className="space-y-2 bg-gray-100 p-2 rounded">
            <li className="text-gray-400 italic">Ainda não implementado</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
