# ==============================================================================
# Dockerfile: code-server Oficial + Node.js + TypeScript + readline-sync + chalk
# ==============================================================================
FROM codercom/code-server:latest

LABEL maintainer="victorequena22"
LABEL description="Entorno oficial code-server con Node.js, TypeScript, readline-sync y chalk"

USER root

# 1. Instalar Node.js, npm, git y paquetes globales esenciales
RUN apt-get update && apt-get install -y --no-install-recommends \
    nodejs \
    npm \
    git \
    curl \
    ca-certificates \
    && npm install --global typescript tsx readline-sync @types/readline-sync chalk @types/chalk \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# 2. Pre-instalar módulos en plantilla para que los alumnos tengan autocompletado y tipos de inmediato
RUN mkdir -p /home/coder/template && \
    cd /home/coder/template && \
    npm init -y && \
    npm pkg set type="module" && \
    npm install readline-sync @types/readline-sync chalk @types/chalk

# 3. Asegurar permisos en directorios de trabajo
RUN mkdir -p /home/coder/project /home/coder/.config/code-server && \
    chown -R coder:coder /home/coder

# 4. Copiar script de arranque
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER coder
WORKDIR /home/coder/project

# Variables de entorno para resolución de módulos en proyectos TypeScript
ENV NODE_PATH=/home/coder/template/node_modules:/usr/local/lib/node_modules
ENV PORT=8080
ENV AUTH=password
ENV PASSWORD=admin

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
