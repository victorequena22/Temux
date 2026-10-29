# ==============================================================================
# Dockerfile: Alpine Linux + Node.js LTS + code-server + tsc + tsx
# ==============================================================================
FROM node:20-alpine

LABEL maintainer="victorequena22"
LABEL description="Entorno ligero Alpine con Node.js, code-server, TypeScript (tsc) y tsx"

# 1. Instalar dependencias del sistema y compatibilidad musl/glibc
RUN apk update && apk add --no-cache \
    gcompat \
    alpine-sdk \
    bash \
    curl \
    git \
    python3 \
    krb5-dev \
    libstdc++

# 2. Instalar globalmente code-server, typescript (tsc) y tsx
RUN npm install --global --unsafe-perm \
    code-server \
    typescript \
    tsx

# 3. Crear usuario no privilegiado 'coder' y directorios de trabajo
RUN addgroup -g 1000 coder && \
    adduser -u 1000 -G coder -s /bin/bash -D coder && \
    mkdir -p /home/coder/project /home/coder/.config/code-server && \
    chown -R coder:coder /home/coder

# 4. Copiar script de arranque
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# 5. Configurar usuario y espacio de trabajo
USER coder
WORKDIR /home/coder/project

# Variables de entorno por defecto
ENV PORT=8080
ENV AUTH=password
ENV PASSWORD=admin

# Exponer el puerto de code-server
EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
