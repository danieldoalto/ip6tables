#!/bin/bash

# Script para matar todos os servidores ativos e iniciar o projeto Iptables Manager
# Autor: Cascade
# Data: 2025-06-25

# Definir cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Iptables Manager - Script de Reinicialização ===${NC}"

# Verificar se está sendo executado como root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Este script precisa ser executado como root (sudo)${NC}"
  exit 1
fi

# Diretório do projeto
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo -e "${YELLOW}Diretório do projeto:${NC} $PROJECT_DIR"

# Matar processos Node.js existentes
echo -e "${YELLOW}Matando processos Node.js existentes...${NC}"
pkill -f "node server.js" || true
sleep 1

# Verificar se algum processo ainda está usando as portas
PORT_HTTP=1338
PORT_WS=8002

echo -e "${YELLOW}Verificando portas em uso...${NC}"
HTTP_PID=$(lsof -t -i:$PORT_HTTP 2>/dev/null)
WS_PID=$(lsof -t -i:$PORT_WS 2>/dev/null)

if [ ! -z "$HTTP_PID" ]; then
  echo -e "${RED}Porta HTTP $PORT_HTTP ainda em uso pelo PID $HTTP_PID. Forçando encerramento...${NC}"
  kill -9 $HTTP_PID
fi

if [ ! -z "$WS_PID" ]; then
  echo -e "${RED}Porta WebSocket $PORT_WS ainda em uso pelo PID $WS_PID. Forçando encerramento...${NC}"
  kill -9 $WS_PID
fi

# Iniciar o servidor
echo -e "${YELLOW}Iniciando o servidor Iptables Manager...${NC}"
node server.js

# Este código nunca será executado a menos que o servidor seja encerrado
echo -e "${RED}Servidor encerrado.${NC}"
