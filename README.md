# Documentação do Projeto LeadTalks

## 💡 Visão Geral

O LeadTalks é um sistema completo para envio de mensagens personalizadas via WhatsApp, integrando:

- Frontend com Vite + React + Tailwind CSS (hospedado na Vercel)
- Backend com Express.js (também na Vercel)
- Banco de dados Supabase (PostgreSQL e autenticação)
- Conector WhatsApp com Baileys, rodando 24/7 em uma VM gratuita da Oracle

## ⚖️ Estratégia Utilizada

- **Frontend** leve, responsivo, hospedado no Vercel com deploy contínuo
- **Backend** separado, responsável pelas rotas REST que intermediam as comunicações entre frontend, Supabase e WhatsApp
- **whatsapp-core** com `Baileys` rodando em uma VM (ou contêiner Docker no futuro), mantendo sessão WebSocket viva
- **Supabase** para armazenar contatos, grupos, mensagens e controle de sessão

## 📂 Estrutura do Repositório (Monorepo)

```
LeadTalksv1/
├── frontend/          # React + Vite + Tailwind (Vercel)
├── backend/           # Express.js API (Vercel)
├── whatsapp-core/     # Conexão WhatsApp (Oracle VM)
├── .gitignore
├── README.md
```

## 🔄 Versionamento Git

- **main**: ramo principal com todo o projeto unificado
- **whatsapp-core-branch**: somente a pasta `whatsapp-core`, clonada na VM
- **dev**: para testes locais e ajustes intermediários

## 📊 Requisitos

### Frontend:

- Node.js >= 18
- Vite
- Tailwind CSS

### Backend:

- Node.js >= 18
- Express.js
- Dotenv

### whatsapp-core:

- Node.js >= 18
- Baileys (whiskeysockets)
- PM2
- Supabase SDK v2

## 🌐 Instalação (por pasta)

### Frontend

```bash
cd frontend
npm install
npm run dev # desenvolvimento
```

### Backend

```bash
cd backend
npm install
npm run dev # vercel dev ou node index.js
```

### WhatsApp-Core (na VM ou Docker)

```bash
cd whatsapp-core
npm install
pm2 start leadtalks.js --name leadtalk
```

## 🔍 Principais Comandos

| Contexto     | Comando                         | Ação                              |
| ------------ | ------------------------------- | --------------------------------- |
| PM2 (na VM)  | `pm2 logs leadtalk`             | Verificar log de conexão WhatsApp |
| PM2          | `pm2 restart leadtalk`          | Reiniciar WhatsApp-core           |
| Supabase CLI | `supabase gen types typescript` | Atualiza tipos                    |
| Git          | `git switch -c nome-branch`     | Criar nova branch                 |

## 🚧 Backend - Rotas API

| Rota                | Método | Função                              |
| ------------------- | ------ | ----------------------------------- |
| /api/login          | POST   | Login Supabase                      |
| /api/register       | POST   | Registro Supabase                   |
| /api/qr             | GET    | Obter QR Code gerado pela VM        |
| /api/sessao         | GET    | Verifica se WhatsApp está conectado |
| /api/enviar         | POST   | Envia mensagem via Baileys          |
| /api/contatos       | GET    | Lista contatos salvos no Supabase   |
| /api/grupos         | GET    | Lista grupos                        |
| /api/membros-grupos | GET    | Lista membros dos grupos            |

## 🏠 Frontend - Páginas

- `/Login` → login do usuário
- `/Register` → registro de novo usuário
- `/Recover` → recuperação de senha (Supabase)
- `/QR` → escaneamento do WhatsApp (ativa leadtalks.js)
- `/Home` → painel principal com envio de mensagens

## 📅 Futuro

- Adicionar suporte a grupos dinâmicos com seleção por categoria
- Agendamento de mensagens (cron/supabase triggers)
- Integração com IA para assistente automatizado

---

Atualizado em: 30/04/2025
Responsável: Caio Zafalon
