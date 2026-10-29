# 🚀 Instalador Automático: Node.js, code-server, TypeScript (tsc) y tsx

Script de instalación rápida todo-en-uno para configurar un entorno de desarrollo completo en **Termux (Android)** o **Linux (Ubuntu / Debian / Servidores VPS)**.

---

## 📦 ¿Qué instala este script?

1. **Node.js (LTS) & npm**: Entorno de ejecución de JavaScript del lado del servidor.
2. **code-server**: Visual Studio Code accesible desde cualquier navegador web.
3. **tsc (`typescript`)**: Compilador oficial de TypeScript instalado globalmente.
4. **tsx**: Ejecutor moderno y ultra-rápido de archivos TypeScript (con soporte para `--watch` y ESM) sin necesidad de compilar manualmente.

---

## ⚡ Instalación Rápida desde GitHub (One-Liner)

Una vez que subas este script a tu repositorio en GitHub, podrás instalarlo en cualquier dispositivo con un solo comando:

### Con `curl`:
```bash
curl -fsSL https://raw.githubusercontent.com/victorequena22/Temux/main/install.sh | bash
```

### O con `wget`:
```bash
wget -qO- https://raw.githubusercontent.com/victorequena22/Temux/main/install.sh | bash
```

---

## 🛠️ Cómo subir este proyecto a tu GitHub

Sigue estos sencillos pasos desde la terminal dentro de esta carpeta:

1. **Inicia el repositorio de Git:**
   ```bash
   git init
   ```

2. **Agrega los archivos:**
   ```bash
   git add .
   ```

3. **Crea el primer commit:**
   ```bash
   git commit -m "feat: script de instalación automática para node, code-server, tsc y tsx"
   ```

4. **Renombra la rama a `main`:**
   ```bash
   git branch -M main
   ```

5. **Crea un repositorio en [GitHub.com](https://github.com/new)** (debe ser **Público** para que `curl` pueda descargarlo sin token).

6. **Vincula tu repositorio remoto y sube el código:**
   ```bash
   git remote add origin https://github.com/victorequena22/Temux.git
   git push -u origin main
   ```

---

## 🖥️ ¿Cómo usar las herramientas instaladas?

### 1. Iniciar `code-server` y conectarse desde la Red Local
El script configura automáticamente `code-server` para escuchar en `0.0.0.0:8080`, permitiendo acceder desde cualquier PC, tablet u otro móvil en la misma red Wi-Fi.

* **Iniciar el servidor:**
  Ejecuta simplemente:
  ```bash
  start-code
  ```
  *(Al iniciar, detectará y mostrará automáticamente tu IP local en pantalla).*

* **Acceso desde el navegador:**
  * **En el mismo dispositivo:** `http://localhost:8080`
  * **Desde tu PC u otro dispositivo en la red Wi-Fi:** `http://<IP_DE_TU_DISPOSITIVO>:8080` *(Ejemplo: `http://192.168.1.35:8080`)*
  * **Contraseña de acceso por defecto:** `admin`

* **Cambiar configuración o quitar contraseña:**
  Edita el archivo de configuración:
  ```bash
  nano ~/.config/code-server/config.yaml
  ```
  Ejemplo para ingresar sin contraseña:
  ```yaml
  bind-addr: 0.0.0.0:8080
  auth: none
  cert: false
  ```

---

### 2. Probar TypeScript y tsx
Crea un archivo de prueba `index.ts`:
```bash
echo 'console.log("¡TypeScript funcionando correctamente!");' > index.ts
```

* **Ejecutar directamente con `tsx`:**
  ```bash
  tsx index.ts
  ```

* **Ejecutar con recarga automática al guardar cambios:**
  ```bash
  tsx watch index.ts
  ```

* **Compilar a JavaScript con `tsc`:**
  ```bash
  tsc index.ts
  node index.js
  ```

---

## 🐳 Opción con Docker (Alpine Linux)

Si prefieres ejecutar todo este entorno aislado dentro de un contenedor ultraligero basado en **Alpine Linux**, tienes a tu disposición el `Dockerfile` y `docker-compose.yml`.

### 1. Levantar con Docker Compose (Recomendado):
```bash
docker compose up -d
```
Esto construirá la imagen y levantará el contenedor en segundo plano con persistencia en `./workspace`.

### 2. O construir y correr manualmente con Docker CLI:
```bash
# Construir la imagen
docker build -t temux-code-server:alpine .

# Iniciar el contenedor
docker run -d \
  --name temux-code-server \
  -p 8080:8080 \
  -e PASSWORD=admin \
  -v "$(pwd)/workspace:/home/coder/project" \
  temux-code-server:alpine
```

### 3. Acceder al contenedor:
* Abre tu navegador en `http://localhost:8080` (o `http://<IP_DE_TU_PC>:8080`).
* Contraseña: `admin`.

