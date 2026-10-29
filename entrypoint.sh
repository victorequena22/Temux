#!/usr/bin/env bash
set -e

PORT="${PORT:-8080}"
AUTH_MODE="${AUTH:-password}"
export PASSWORD="${PASSWORD:-admin}"

# Si el proyecto del alumno no tiene node_modules, enlazar la plantilla precargada
if [ ! -d "/home/coder/project/node_modules" ]; then
    ln -s /home/coder/template/node_modules /home/coder/project/node_modules 2>/dev/null || true
fi

echo "===================================================="
echo "  Iniciando code-server UCLA (Programación I)"
echo "  Librerías listas: readline-sync, chalk, TypeScript"
echo "  Puerto:                ${PORT}"
echo "  Autenticación:         ${AUTH_MODE}"
echo "  Directorio de trabajo: /home/coder/project"
echo "===================================================="

exec code-server \
    --bind-addr 0.0.0.0:"${PORT}" \
    --auth "${AUTH_MODE}" \
    /home/coder/project
