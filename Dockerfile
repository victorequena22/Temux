# ==============================================================================
# Dockerfile: code-server Oficial + Node.js LTS + TypeScript (tsc) + tsx
# ==============================================================================
FROM codercom/code-server:latest

LABEL maintainer="victorequena22"
LABEL description="Entorno oficial code-server con Node.js LTS, TypeScript (tsc) y tsx"

USER root

# 1. Instalar Node.js LTS, git y herramientas esenciales
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    build-essential \
    && curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install --global typescript tsx \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# 2. Asegurar directorios de trabajo
RUN mkdir -p /home/coder/project /home/coder/.config/code-server && \
    chown -R coder:coder /home/coder

# 3. Copiar script de arranque
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER coder
WORKDIR /home/coder/project

# Variables de entorno por defecto
ENV PORT=8080
ENV AUTH=password
ENV PASSWORD=admin

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
