# Frontend - LeadTalks

Este projeto representa a camada de interface do usuário (frontend) do LeadTalks. A aplicação foi criada com Vite + React + TypeScript, e configurada para usar TailwindCSS como framework de estilo utilitário.

---

## 📦 Tecnologias utilizadas

- [Vite](https://vitejs.dev/) — Empacotador e servidor de desenvolvimento
- [React](https://reactjs.org/) — Biblioteca de construção de interfaces
- [TypeScript](https://www.typescriptlang.org/) — Superset de JavaScript com tipagem
- [TailwindCSS](https://tailwindcss.com/) — Framework CSS baseado em utilitários

---

## 🚀 Como rodar o projeto

1. Acesse a pasta `frontend`:

```bash
cd frontend
Instale as dependências:

bash
Copiar
Editar
npm install
Inicie o servidor local:

bash
Copiar
Editar
npm run dev
Acesse: http://localhost:5173

📁 Estrutura atual
bash
Copiar
Editar
frontend/
├── index.html
├── src/
│   ├── App.tsx
│   ├── index.css          # Tailwind aplicado
│   └── main.tsx
├── tailwind.config.ts
├── postcss.config.js
├── package.json
├── tsconfig.json
└── README.md
⚠️ Problemas resolvidos
🧨 1. npx tailwindcss init -p não funcionava
Erro: could not determine executable to run

Causa: conflitos de permissões ou instalação quebrada
Solução: criamos os arquivos manualmente (tailwind.config.ts, postcss.config.js)

🧨 2. require is not defined in ES module scope
Erro: uso de require() com "type": "module" no package.json
Solução: convertidos para import tailwindcss from 'tailwindcss' no postcss.config.js

✅ Status atual
Projeto React rodando com sucesso via Vite

TailwindCSS carregado corretamente

Pronto para início do desenvolvimento visual da UI
```
