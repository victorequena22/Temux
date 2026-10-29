#!/usr/bin/env bash
set -e

PORT="${PORT:-8080}"
AUTH_MODE="${AUTH:-password}"
export PASSWORD="${PASSWORD:-admin}"

echo "===================================================="
echo "  Iniciando code-server UCLA"
echo "  Puerto:                ${PORT}"
echo "  Autenticación:         ${AUTH_MODE}"
echo "  Directorio de trabajo: /home/coder/project"
echo "===================================================="

exec code-server \
    --bind-addr 0.0.0.0:"${PORT}" \
    --auth "${AUTH_MODE}" \
    /home/coder/project
