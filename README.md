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

### 1. Iniciar `code-server` (VS Code Web)
* **En Termux:**
  Puedes usar el comando directo creado por el script:
  ```bash
  start-code
  ```
  O simplemente:
  ```bash
  code-server
  ```
* **En Linux:**
  ```bash
  code-server
  ```
  *(O para mantenerlo siempre encendido como servicio de fondo: `sudo systemctl enable --now code-server@$USER`)*

* **Acceso desde el navegador:**
  * Abre tu navegador en: `http://localhost:8080` (o `http://<IP_DE_TU_DISPOSITIVO>:8080`)
  * **Contraseña por defecto:** `admin`

* **Cambiar configuración o quitar contraseña:**
  Edita el archivo de configuración:
  ```bash
  nano ~/.config/code-server/config.yaml
  ```
  Ejemplo para entrar sin contraseña:
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
