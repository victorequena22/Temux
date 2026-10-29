#!/usr/bin/env bash

# ==============================================================================
# Script de Gestión de Aulas Virtuales - code-server para Alumnos
# Genera instancias Docker independientes para cada alumno
# ==============================================================================

set -e

COMPOSE_FILE="docker-compose.alumnos.yml"
CREDS_FILE="credenciales_alumnos.txt"
CREDS_CSV="credenciales_alumnos.csv"
BASE_PORT=8080
ALUMNOS_DIR="./alumnos"

# Colores para la consola
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

# Función para detectar la IP de red local del profesor
obtener_ip() {
    local ip=""
    ip=$(ip -4 addr show wlan0 2>/dev/null | awk '/inet / {print $2}' | cut -d/ -f1 | head -n 1)
    [ -z "$ip" ] && ip=$(ip -o -4 addr show up scope global 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | head -n 1)
    [ -z "$ip" ] && ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    [ -z "$ip" ] && ip=$(ifconfig 2>/dev/null | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -n 1 | awk '{print $2}' | tr -d 'addr:')
    [ -z "$ip" ] && ip="localhost"
    echo "$ip"
}

# Generar contraseña aleatoria o predecible para clase
generar_password() {
    local index=$1
    # Genera contraseña legible para clase: ej. alumno2026-01
    printf "clase-%02d" "$index"
}

mostrar_ayuda() {
    echo -e "${CYAN}====================================================${NC}"
    echo -e "${BOLD}  Gestor de Entornos code-server para Alumnos${NC}"
    echo -e "${CYAN}====================================================${NC}"
    echo -e "Uso:"
    echo -e "  ${GREEN}bash alumnos.sh crear <numero_alumnos>${NC}     Ej: bash alumnos.sh crear 15"
    echo -e "  ${GREEN}bash alumnos.sh crear <archivo_nombres.txt>${NC} Ej: bash alumnos.sh crear estudiantes.txt"
    echo -e "  ${GREEN}bash alumnos.sh iniciar${NC}                    Inicia todos los contenedores"
    echo -e "  ${GREEN}bash alumnos.sh detener${NC}                    Detiene todos los contenedores"
    echo -e "  ${GREEN}bash alumnos.sh reiniciar${NC}                  Reinicia el aula"
    echo -e "  ${GREEN}bash alumnos.sh estado${NC}                     Muestra el estado de cada alumno"
    echo -e "  ${GREEN}bash alumnos.sh credenciales${NC}               Muestra la tabla de accesos"
    echo -e "  ${RED}bash alumnos.sh limpiar${NC}                    Elimina contenedores (mantiene tareas)"
    echo -e "${CYAN}====================================================${NC}\n"
}

comando_crear() {
    local param="$1"
    if [ -z "$param" ]; then
        echo -e "${RED}[ERROR] Especifica el número de alumnos o un archivo de texto con sus nombres.${NC}"
        echo -e "Ejemplo: bash alumnos.sh crear 20"
        exit 1
    fi

    # Asegurar que la imagen base exista
    if [ ! -f "Dockerfile" ]; then
        echo -e "${RED}[ERROR] No se encontró el archivo Dockerfile en el directorio actual.${NC}"
        exit 1
    fi

    echo -e "${CYAN}[*] Construyendo imagen base temux-code-server:alpine si es necesario...${NC}"
    docker build -t temux-code-server:alpine .

    declare -a LISTA_ALUMNOS=()

    if [ -f "$param" ]; then
        echo -e "${CYAN}[*] Leyendo lista de alumnos desde el archivo: $param${NC}"
        while IFS= read -r linea || [ -n "$linea" ]; do
            # Limpiar espacios
            linea=$(echo "$linea" | xargs)
            [ -n "$linea" ] && LISTA_ALUMNOS+=("$linea")
        done < "$param"
    elif [[ "$param" =~ ^[0-9]+$ ]]; then
        echo -e "${CYAN}[*] Generando aula para $param alumnos...${NC}"
        for ((i=1; i<=param; i++)); do
            LISTA_ALUMNOS+=("$(printf "alumno_%02d" $i)")
        done
    else
        echo -e "${RED}[ERROR] El parámetro debe ser un número entero o la ruta a un archivo de texto.${NC}"
        exit 1
    fi

    local total=${#LISTA_ALUMNOS[@]}
    if [ "$total" -eq 0 ]; then
        echo -e "${RED}[ERROR] No se encontraron alumnos para registrar.${NC}"
        exit 1
    fi

    IP_SERVIDOR=$(obtener_ip)
    mkdir -p "$ALUMNOS_DIR"

    # Iniciar archivo docker-compose
    cat << 'EOF' > "$COMPOSE_FILE"
# Archivo autogenerado por alumnos.sh para gestión de clases
services:
EOF

    # Iniciar archivos de credenciales
    echo "================================================================================" > "$CREDS_FILE"
    echo "                 LISTA DE ACCESO A CODE-SERVER PARA ALUMNOS                     " >> "$CREDS_FILE"
    echo "================================================================================" >> "$CREDS_FILE"
    printf "%-18s | %-32s | %-12s | %-6s\n" "ALUMNO" "URL DE ACCESO" "PASSWORD" "PUERTO" >> "$CREDS_FILE"
    echo "-------------------+----------------------------------+--------------+--------" >> "$CREDS_FILE"

    echo "Alumno,URL,Password,Puerto,Carpeta_Host" > "$CREDS_CSV"

    local idx=1
    for alumno in "${LISTA_ALUMNOS[@]}"; do
        # Normalizar identificador para docker (minúsculas, sin espacios ni caracteres especiales)
        local id_seguro
        id_seguro=$(echo "$alumno" | tr '[:upper:]' '[:lower:]' | sed -e 's/[^a-z0-9]/_/g')
        [ -z "$id_seguro" ] && id_seguro="alumno_$idx"

        local puerto=$((BASE_PORT + idx))
        local password
        password=$(generar_password "$idx")
        local dir_alumno="$ALUMNOS_DIR/$id_seguro"
        mkdir -p "$dir_alumno/project" "$dir_alumno/config"

        # Configuración del servicio en docker-compose
        cat << EOF >> "$COMPOSE_FILE"
  ${id_seguro}:
    image: temux-code-server:alpine
    container_name: cs_${id_seguro}
    restart: unless-stopped
    ports:
      - "${puerto}:8080"
    environment:
      - PORT=8080
      - AUTH=password
      - PASSWORD=${password}
    volumes:
      - ${dir_alumno}/project:/home/coder/project
      - ${dir_alumno}/config:/home/coder/.config
    working_dir: /home/coder/project
    deploy:
      resources:
        limits:
          cpus: '0.75'
          memory: 512M

EOF

        local url="http://${IP_SERVIDOR}:${puerto}"
        printf "%-18s | %-32s | %-12s | %-6s\n" "$alumno" "$url" "$password" "$puerto" >> "$CREDS_FILE"
        echo "\"$alumno\",\"$url\",\"$password\",$puerto,\"$dir_alumno\"" >> "$CREDS_CSV"

        ((idx++))
    done

    echo -e "${GREEN}====================================================${NC}"
    echo -e "${GREEN}  ¡Aula virtual configurada para $total alumnos!    ${NC}"
    echo -e "${GREEN}====================================================${NC}"
    echo -e "Archivos generados:"
    echo -e "  • Orquestador Docker:     ${CYAN}$COMPOSE_FILE${NC}"
    echo -e "  • Lista de Credenciales:  ${YELLOW}$CREDS_FILE${NC}"
    echo -e "  • Archivo para Excel:     ${YELLOW}$CREDS_CSV${NC}"
    echo -e "  • Carpetas de proyectos:  ${CYAN}$ALUMNOS_DIR/<alumno>/project${NC}"
    echo -e "\n${BOLD}Para encender todas las instancias de los alumnos ejecuta:${NC}"
    echo -e "  👉 ${GREEN}bash alumnos.sh iniciar${NC}\n"
    
    comando_credenciales
}

comando_iniciar() {
    if [ ! -f "$COMPOSE_FILE" ]; then
        echo -e "${RED}[ERROR] No existe '$COMPOSE_FILE'. Primero genera las instancias con: bash alumnos.sh crear <numero>${NC}"
        exit 1
    fi
    echo -e "${CYAN}[*] Iniciando instancias de alumnos...${NC}"
    docker compose -f "$COMPOSE_FILE" up -d
    echo -e "\n${GREEN}[✔] ¡Todas las instancias están activas!${NC}"
    echo -e "Los alumnos ya pueden conectarse desde sus navegadores."
}

comando_detener() {
    if [ ! -f "$COMPOSE_FILE" ]; then
        echo -e "${RED}[ERROR] No existe '$COMPOSE_FILE'.${NC}"
        exit 1
    fi
    echo -e "${YELLOW}[*] Deteniendo instancias de alumnos...${NC}"
    docker compose -f "$COMPOSE_FILE" stop
    echo -e "${GREEN}[✔] Instancias detenidas.${NC}"
}

comando_reiniciar() {
    if [ ! -f "$COMPOSE_FILE" ]; then
        echo -e "${RED}[ERROR] No existe '$COMPOSE_FILE'.${NC}"
        exit 1
    fi
    echo -e "${CYAN}[*] Reiniciando instancias...${NC}"
    docker compose -f "$COMPOSE_FILE" restart
    echo -e "${GREEN}[✔] Instancias reiniciadas.${NC}"
}

comando_estado() {
    if [ ! -f "$COMPOSE_FILE" ]; then
        echo -e "${RED}[ERROR] No existe '$COMPOSE_FILE'.${NC}"
        exit 1
    fi
    docker compose -f "$COMPOSE_FILE" ps
}

comando_credenciales() {
    if [ -f "$CREDS_FILE" ]; then
        cat "$CREDS_FILE"
        echo -e "\n${YELLOW}Nota para el profesor:${NC}"
        echo -e "Puedes abrir el archivo ${CYAN}$CREDS_FILE${NC} para copiar y repartir los enlaces a tus alumnos,"
        echo -e "o importar ${CYAN}$CREDS_CSV${NC} directamente en Excel/Google Sheets."
    else
        echo -e "${RED}[ERROR] Aún no se ha generado la lista de credenciales.${NC}"
        echo -e "Crea las instancias con: bash alumnos.sh crear <numero>"
    fi
}

comando_limpiar() {
    if [ -f "$COMPOSE_FILE" ]; then
        read -p "¿Estás seguro de que deseas eliminar los contenedores de los alumnos? (Los archivos y tareas NO se borrarán) [s/N]: " confirm
        if [[ "$confirm" =~ ^[sS]$ ]]; then
            docker compose -f "$COMPOSE_FILE" down
            echo -e "${GREEN}[✔] Contenedores eliminados. Las carpetas de tareas en '$ALUMNOS_DIR' siguen intactas.${NC}"
        else
            echo "Operación cancelada."
        fi
    fi
}

# Enrutador de comandos
case "$1" in
    crear)
        comando_crear "$2"
        ;;
    iniciar|start)
        comando_iniciar
        ;;
    detener|stop)
        comando_detener
        ;;
    reiniciar|restart)
        comando_reiniciar
        ;;
    estado|status|ps)
        comando_estado
        ;;
    credenciales|lista)
        comando_credenciales
        ;;
    limpiar|down)
        comando_limpiar
        ;;
    *)
        mostrar_ayuda
        ;;
esac
