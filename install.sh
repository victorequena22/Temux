#!/usr/bin/env bash

# ==============================================================================
# Script de Instalación Automatizada para Node.js, code-server, tsc y tsx
# Compatible con: Termux (Android) y Distribuciones Linux (Ubuntu/Debian)
# Configurado para: Acceso desde la Red Local (Wi-Fi / LAN)
# ==============================================================================

set -e

# Colores para la terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # Sin color

echo -e "${CYAN}====================================================${NC}"
echo -e "${CYAN}  Iniciando instalación del Entorno de Desarrollo   ${NC}"
echo -e "${CYAN}  (Node.js, code-server, TypeScript & tsx)          ${NC}"
echo -e "${CYAN}  * Configurado para acceso en red local (LAN) *    ${NC}"
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
    echo -e "${CYAN}Habilitando Termux User Repository (TUR)...${NC}"
    pkg install -y tur-repo
    # Refresh after enabling TUR so code-server and its Node.js runtime are upgraded together.
    pkg update -y && pkg upgrade -y
    pkg install -y curl wget git tar iproute2
else
    $SUDO apt-get update -y
    $SUDO apt-get install -y curl wget git build-essential iproute2
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

# Fail here rather than reporting a successful install when code-server's Node
# runtime cannot start (for example, because Termux packages are out of sync).
if ! command -v code-server >/dev/null 2>&1; then
    echo -e "${RED}[ERROR] code-server no quedó instalado o no está disponible en PATH.${NC}"
    exit 1
fi

if CODE_SERVER_VERSION=$(code-server --version 2>&1); then
    echo "$CODE_SERVER_VERSION"
else
    echo "$CODE_SERVER_VERSION"
    echo -e "${RED}[ERROR] code-server está instalado, pero no puede ejecutarse.${NC}"
    if [ "$IS_TERMUX" = true ] && printf '%s' "$CODE_SERVER_VERSION" | grep -q '_ZNSt6__ndk113__hash_memoryEPKvm'; then
        echo -e "${YELLOW}Este símbolo coincide con un problema reportado para code-server de TUR en Termux de Google Play.${NC}"
        echo -e "${YELLOW}Reinstalar libc++, Node.js o code-server no corrige esta incompatibilidad.${NC}"
        echo -e "Consulta el reporte: https://github.com/termux-play-store/termux-packages/issues/27"
        echo -e "${YELLOW}Usa Termux de F-Droid o GitHub. Antes de migrar, respalda tus archivos; las firmas de las distribuciones pueden diferir.${NC}"
    fi
    exit 1
fi

# ------------------------------------------------------------------------------
# 5. Instalación Global de TypeScript (tsc), tsx, readline-sync y chalk
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}==> [Paso 4/5] Instalando tsc, tsx, readline-sync y chalk globalmente...${NC}"

if [ "$IS_TERMUX" = true ]; then
    npm install -g typescript tsx readline-sync @types/readline-sync chalk @types/chalk
else
    $SUDO npm install -g typescript tsx readline-sync @types/readline-sync chalk @types/chalk
fi

# ------------------------------------------------------------------------------
# 6. Configuración de code-server para Conexión desde la Red (0.0.0.0:8080)
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}==> [Paso 5/5] Configurando code-server para acceso en red...${NC}"

CONFIG_DIR="$HOME/.config/code-server"
CONFIG_FILE="$CONFIG_DIR/config.yaml"

mkdir -p "$CONFIG_DIR"

if [ -f "$CONFIG_FILE" ]; then
    # Actualizar bind-addr a 0.0.0.0:8080 si ya existe
    if grep -q "bind-addr:" "$CONFIG_FILE"; then
        sed -i -E 's/bind-addr: .*/bind-addr: 0.0.0.0:8080/' "$CONFIG_FILE"
    else
        echo "bind-addr: 0.0.0.0:8080" >> "$CONFIG_FILE"
    fi
    echo -e "${GREEN}Configuración actualizada para permitir conexiones desde la red (0.0.0.0:8080).${NC}"
else
    cat <<EOF > "$CONFIG_FILE"
bind-addr: 0.0.0.0:8080
auth: password
password: admin
cert: false
EOF
    echo -e "${GREEN}Archivo de configuración creado para acceso en red (0.0.0.0:8080) en:${NC} $CONFIG_FILE"
    echo -e "${YELLOW}Contraseña por defecto establecida a:${NC} admin"
fi

# En Linux, si ufw está activo, habilitar el puerto 8080
if [ "$IS_TERMUX" = false ]; then
    if command -v ufw >/dev/null 2>&1; then
        if $SUDO ufw status 2>/dev/null | grep -q "Status: active"; then
            echo -e "${CYAN}Habilitando puerto 8080 en el firewall (ufw)...${NC}"
            $SUDO ufw allow 8080/tcp >/dev/null 2>&1 || true
        fi
    fi
fi

# Puerto para code-server
PORT=8080

# Crear script de acceso directo 'start-code' con detección dinámica de IP y Puerto
LAUNCHER_CONTENT='#!/usr/bin/env bash
GREEN="\033[0;32m"
CYAN="\033[0;36m"
YELLOW="\033[1;33m"
BOLD="\033[1m"
NC="\033[0m"
PORT=8080

IP_LAN=$(ip -4 addr show wlan0 2>/dev/null | awk "/inet / {print \$2}" | cut -d/ -f1 | head -n 1)
[ -z "$IP_LAN" ] && IP_LAN=$(ip -o -4 addr show up scope global 2>/dev/null | awk "{print \$4}" | cut -d/ -f1 | head -n 1)
[ -z "$IP_LAN" ] && IP_LAN=$(hostname -I 2>/dev/null | awk "{print \$1}")
[ -z "$IP_LAN" ] && IP_LAN=$(ifconfig 2>/dev/null | grep -Eo "inet (addr:)?([0-9]*\.){3}[0-9]*" | grep -v "127.0.0.1" | head -n 1 | awk "{print \$2}" | tr -d "addr:")
[ -z "$IP_LAN" ] && IP_LAN="127.0.0.1"

echo -e "\n${YELLOW}════════════════════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}📡 CODE-SERVER ACTIVO Y ACCESIBLE EN LA RED${NC}"
echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
echo -e "  • ${BOLD}IP de este dispositivo:${NC} ${CYAN}${IP_LAN}${NC}"
echo -e "  • ${BOLD}Puerto de conexión:${NC}     ${CYAN}${PORT}${NC}"
echo -e "  • ${BOLD}URL Local:${NC}              ${CYAN}http://localhost:${PORT}${NC}"
echo -e "  • ${BOLD}URL desde tu Red (Wi-Fi):${NC} ${GREEN}http://${IP_LAN}:${PORT}${NC}"
echo -e "  • ${BOLD}Contraseña:${NC}             ${CYAN}admin${NC} (en ~/.config/code-server/config.yaml)"
echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
echo -e "\033[1;30m(Presiona Ctrl + C para detener el servidor)\033[0m\n"

code-server --bind-addr 0.0.0.0:${PORT} "$@"
'

if [ "$IS_TERMUX" = true ]; then
    LAUNCHER_PATH="$PREFIX/bin/start-code"
    echo "$LAUNCHER_CONTENT" > "$LAUNCHER_PATH"
    chmod +x "$LAUNCHER_PATH"
    echo -e "${GREEN}Comando rápido '${CYAN}start-code${GREEN}' creado en:${NC} $LAUNCHER_PATH"
else
    LAUNCHER_PATH="/usr/local/bin/start-code"
    echo "$LAUNCHER_CONTENT" | $SUDO tee "$LAUNCHER_PATH" >/dev/null
    $SUDO chmod +x "$LAUNCHER_PATH"
    echo -e "${GREEN}Comando rápido '${CYAN}start-code${GREEN}' creado en:${NC} $LAUNCHER_PATH"
fi

# Detectar IP para mostrar en el resumen final
IP_ACTUAL=$(ip -4 addr show wlan0 2>/dev/null | awk '/inet / {print $2}' | cut -d/ -f1 | head -n 1)
[ -z "$IP_ACTUAL" ] && IP_ACTUAL=$(ip -o -4 addr show up scope global 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | head -n 1)
[ -z "$IP_ACTUAL" ] && IP_ACTUAL=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$IP_ACTUAL" ] && IP_ACTUAL=$(ifconfig 2>/dev/null | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -n 1 | awk '{print $2}' | tr -d 'addr:')
[ -z "$IP_ACTUAL" ] && IP_ACTUAL="<IP_DE_TU_DISPOSITIVO>"

# ------------------------------------------------------------------------------
# 7. Resumen de Versiones e Información de Conexión
# ------------------------------------------------------------------------------
echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}         ¡Instalación completada con éxito!         ${NC}"
echo -e "${GREEN}====================================================${NC}\n"

echo -e "${CYAN}Versiones instaladas:${NC}"
echo -e "  - Node.js:     $(node -v 2>/dev/null || echo 'No detectado')"
echo -e "  - npm:         $(npm -v 2>/dev/null || echo 'No detectado')"
echo -e "  - tsc:         $(tsc -v 2>/dev/null || echo 'No detectado')"
echo -e "  - tsx:         $(tsx -v 2>/dev/null || echo 'No detectado')"
echo -e "  - code-server: $(code-server --version 2>/dev/null | head -n 1)"

echo -e "\n${YELLOW}════════════════════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}📡 DATOS DE CONEXIÓN A CODE-SERVER (RED / NAVEGADOR)${NC}"
echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
echo -e "  • ${BOLD}Dirección IP:${NC}            ${CYAN}${IP_ACTUAL}${NC}"
echo -e "  • ${BOLD}Puerto:${NC}                  ${CYAN}${PORT}${NC}"
echo -e "  • ${BOLD}URL Local (en el equipo):${NC} ${CYAN}http://localhost:${PORT}${NC}"
echo -e "  • ${BOLD}URL en Red (PC / Wi-Fi):${NC}  ${GREEN}http://${IP_ACTUAL}:${PORT}${NC}"
echo -e "  • ${BOLD}Contraseña de acceso:${NC}     ${CYAN}admin${NC}"
echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
echo -e "  👉 Para iniciar el servidor escribe: ${CYAN}start-code${NC}"
echo -e "  👉 Configuración y contraseña en:    ${CYAN}~/.config/code-server/config.yaml${NC}"
echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}\n"
