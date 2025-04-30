# 📱 LeadTalk - WhatsApp Core (VM Oracle)

Este é o módulo `whatsapp-core` responsável por conectar ao WhatsApp usando a biblioteca [Baileys](https://github.com/WhiskeySockets/Baileys), extrair contatos, grupos e membros, e enviar mensagens, tudo integrado ao Supabase.

> ✅ Este projeto pode rodar **localmente** (modo desenvolvimento) ou na **VM Oracle** (modo produção), com comportamento adaptativo.

---

## 🧱 Estrutura do projeto

```
whatsapp-core/
├── auth.js             # Gera o QR e autentica no WhatsApp
├── leadtalks.js        # Extrai contatos, grupos e envia ao Supabase
├── sender.js           # Envia mensagens a partir da fila (queue)
├── supabase.js         # Conexão centralizada com Supabase
├── .env                # Variáveis de ambiente (configuração)
├── package.json        # Scripts e dependências
├── data/               # Arquivos .json locais (somente em dev)
├── auth/               # Armazena credenciais da sessão WhatsApp
```

---

## ⚙️ Variáveis de ambiente

Crie um arquivo `.env` com o seguinte conteúdo:

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
ENV_MODE=development   # Use 'production' na VM Oracle
```

---

## 🛠️ Scripts disponíveis

| Comando        | Descrição                                  |
| -------------- | ------------------------------------------ |
| `npm run auth` | Gera o QR Code e conecta ao WhatsApp       |
| `npm run lead` | Extrai contatos/grupos e envia ao Supabase |
| `npm run send` | Envia mensagens da fila (`queue`)          |

---

## 💡 Funcionalidade inteligente

Este projeto detecta automaticamente se está em ambiente local ou de produção:

- **Local (ENV_MODE=development)**:

  - Salva arquivos `.json` em `/data`
  - Conecta e envia dados normalmente ao Supabase

- **VM Oracle (ENV_MODE=production)**:
  - **Não salva nenhum `.json` local**
  - Tudo é enviado ao Supabase diretamente

---

## 🚀 Rodando na VM Oracle (produção)

1. Copie a pasta para a VM ou clone a branch `whatsapp-core`
2. Crie e configure o `.env` com `ENV_MODE=production`
3. Instale as dependências:

```bash
npm install
```

4. Inicie com:

```bash
npm run auth     # Conecta e salva sessão
npm run lead     # Extrai contatos/grupos para Supabase
npm run send     # Envia mensagens da fila
```

5. Para rodar automaticamente com PM2:

```bash
npm install -g pm2
pm2 start leadtalks.js --name leadtalk
pm2 save
```

---

## 🧠 Requisitos

- Node.js 18+
- WhatsApp em funcionamento para autenticação
- Banco Supabase com tabelas: `contatos`, `grupos`, `membros_grupos`, `queue`, `log`, `sessao`

---

## 🧩 Integrado com:

- ✅ Supabase (banco e autenticação)
- ✅ Vercel (frontend e backend `/api`)
- ✅ VM Oracle (execução 24/7)

---

Feito por [Caio Zafalon]
