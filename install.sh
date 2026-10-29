#!/usr/bin/env bash

# ==============================================================================
# Script de Instalación Automatizada para Node.js, code-server, tsc y tsx
# Compatible con: Termux (Android) y Distribuciones Linux (Ubuntu/Debian)
# ==============================================================================

set -e

# Colores para la terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # Sin color

echo -e "${CYAN}====================================================${NC}"
echo -e "${CYAN}  Iniciando instalación del Entorno de Desarrollo   ${NC}"
echo -e "${CYAN}  (Node.js, code-server, TypeScript & tsx)          ${NC}"
echo -e "${CYAN}====================================================${NC}\n"

# ------------------------------------------------------------------------------
# 1. Detección del Entorno (Termux vs Linux Convencional)
# ------------------------------------------------------------------------------
IS_TERMUX=false
if [ -n "$TERMUX_VERSION" ] || [ -d "/data/data/com.termux" ]; then
    IS_TERMUX=true
    echo -e "${YELLOW}[!] Entorno detectado: Termux (Android)${NC}"
else
    echo -e "${BLUE}[*] Entorno detectado: Linux estándar${NC}"
    # Verificar permisos de sudo/root para Linux
    if [ "$(id -u)" -ne 0 ]; then
        if command -v sudo >/dev/null 2>&1; then
            SUDO="sudo"
        else
            echo -e "${RED}[ERROR] Este script requiere privilegios de root o 'sudo' para ejecutarse en Linux.${NC}"
            exit 1
        fi
    else
        SUDO=""
    fi
fi

# ------------------------------------------------------------------------------
# 2. Actualización del Sistema y Paquetes Base
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}==> [Paso 1/5] Actualizando repositorios y paquetes base...${NC}"

if [ "$IS_TERMUX" = true ]; then
    pkg update -y && pkg upgrade -y
    pkg install -y curl wget git tar
else
    $SUDO apt-get update -y
    $SUDO apt-get install -y curl wget git build-essential
fi

# ------------------------------------------------------------------------------
# 3. Instalación de Node.js y npm
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}==> [Paso 2/5] Instalando Node.js y npm...${NC}"

if [ "$IS_TERMUX" = true ]; then
    pkg install -y nodejs-lts
else
    if ! command -v node >/dev/null 2>&1; then
        echo -e "${CYAN}Configurando repositorio NodeSource LTS...${NC}"
        curl -fsSL https://deb.nodesource.com/setup_lts.x | $SUDO -E bash -
        $SUDO apt-get install -y nodejs
    else
        echo -e "${GREEN}Node.js ya se encuentra instalado: $(node -v)${NC}"
    fi
fi

# ------------------------------------------------------------------------------
# 4. Instalación de code-server (VS Code en el navegador)
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}==> [Paso 3/5] Instalando code-server...${NC}"

if [ "$IS_TERMUX" = true ]; then
    echo -e "${CYAN}Instalando Termux User Repository (tur-repo)...${NC}"
    pkg install -y tur-repo
    echo -e "${CYAN}Instalando paquete code-server desde TUR...${NC}"
    pkg install -y code-server
else
    if ! command -v code-server >/dev/null 2>&1; then
        echo -e "${CYAN}Descargando e instalando code-server oficial...${NC}"
        curl -fsSL https://code-server.dev/install.sh | sh
    else
        echo -e "${GREEN}code-server ya se encuentra instalado: $(code-server -v | head -n 1)${NC}"
    fi
fi

# ------------------------------------------------------------------------------
# 5. Instalación Global de TypeScript (tsc) y tsx
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}==> [Paso 4/5] Instalando tsc (TypeScript) y tsx globalmente con npm...${NC}"

if [ "$IS_TERMUX" = true ]; then
    npm install -g typescript tsx
else
    $SUDO npm install -g typescript tsx
fi

# ------------------------------------------------------------------------------
# 6. Configuración Inicial de code-server
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}==> [Paso 5/5] Configurando code-server...${NC}"

CONFIG_DIR="$HOME/.config/code-server"
CONFIG_FILE="$CONFIG_DIR/config.yaml"

mkdir -p "$CONFIG_DIR"

if [ ! -f "$CONFIG_FILE" ]; then
    cat <<EOF > "$CONFIG_FILE"
bind-addr: 0.0.0.0:8080
auth: password
password: admin
cert: false
EOF
    echo -e "${GREEN}Archivo de configuración creado en:${NC} $CONFIG_FILE"
    echo -e "${YELLOW}Contraseña por defecto establecida a:${NC} admin"
else
    echo -e "${YELLOW}Ya existe un archivo de configuración en:${NC} $CONFIG_FILE"
fi

# En Termux, creamos un comando de acceso rápido 'start-code'
if [ "$IS_TERMUX" = true ]; then
    LAUNCHER_PATH="$PREFIX/bin/start-code"
    cat << 'EOF' > "$LAUNCHER_PATH"
#!/data/data/com.termux/files/usr/bin/bash
echo -e "\033[0;32mIniciando code-server en http://localhost:8080\033[0m"
echo -e "\033[1;33mPara detenerlo pulsa Ctrl + C\033[0m"
code-server --bind-addr 0.0.0.0:8080
EOF
    chmod +x "$LAUNCHER_PATH"
    echo -e "${GREEN}Comando rápido '${CYAN}start-code${GREEN}' creado exitosamente.${NC}"
fi

# ------------------------------------------------------------------------------
# 7. Resumen de Versiones Instaladas
# ------------------------------------------------------------------------------
echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}         ¡Instalación completada con éxito!         ${NC}"
echo -e "${GREEN}====================================================${NC}\n"

echo -e "${CYAN}Versiones instaladas:${NC}"
echo -e "  - Node.js:     $(node -v 2>/dev/null || echo 'No detectado')"
echo -e "  - npm:         $(npm -v 2>/dev/null || echo 'No detectado')"
echo -e "  - tsc:         $(tsc -v 2>/dev/null || echo 'No detectado')"
echo -e "  - tsx:         $(tsx -v 2>/dev/null || echo 'No detectado')"
echo -e "  - code-server: $(code-server --version 2>/dev/null | head -n 1 || echo 'No detectado')"

echo -e "\n${YELLOW}¿Cómo usar code-server?${NC}"
if [ "$IS_TERMUX" = true ]; then
    echo -e "  1. Ejecuta: ${CYAN}start-code${NC}  (o escribe directamente: ${CYAN}code-server${NC})"
    echo -e "  2. Abre en tu navegador de Android: ${CYAN}http://localhost:8080${NC}"
    echo -e "  3. Contraseña por defecto: ${CYAN}admin${NC} (puedes cambiarla en ~/.config/code-server/config.yaml)"
else
    echo -e "  1. Ejecuta: ${CYAN}code-server${NC}"
    echo -e "     (O como servicio: ${CYAN}sudo systemctl enable --now code-server@$USER${NC})"
    echo -e "  2. Abre en tu navegador: ${CYAN}http://localhost:8080${NC}"
    echo -e "  3. Contraseña por defecto: ${CYAN}admin${NC} (en ~/.config/code-server/config.yaml)"
fi

echo -e "\n${CYAN}====================================================${NC}\n"
