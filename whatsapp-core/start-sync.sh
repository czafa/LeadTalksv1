#!/bin/bash

echo "🚀 Iniciando ngrok..."
node ngrok-sync.js

echo "⏳ Aguardando 3 segundos para garantir que o ngrok esteja pronto..."
sleep 3

echo "🟢 Iniciando server.js..."
node server.js
