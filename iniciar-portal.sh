#!/usr/bin/env bash
set -e

echo -e "\033[0;36m====================================================\033[0m"
echo -e "\033[0;36m  Iniciando Portal de Alumnos - UCLA                \033[0m"
echo -e "\033[0;36m  INT214 - Programacion I (Lapso 2026-2)            \033[0m"
echo -e "\033[0;36m====================================================\033[0m\n"

if ! docker info >/dev/null 2>&1; then
    echo -e "\033[0;31m[ERROR] Docker no está en ejecución. Por favor inicia el servicio de Docker.\033[0m"
    exit 1
fi

if ! docker image inspect temux-code-server:alpine >/dev/null 2>&1; then
    echo -e "\033[0;33m[*] Construyendo imagen Docker temux-code-server:alpine...\033[0m"
    docker build -t temux-code-server:alpine .
fi

echo -e "\033[0;32m[*] Iniciando portal web...\033[0m\n"
node portal.js
