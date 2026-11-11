# 🚀 Guía de Instalación: Node.js, code-server, TypeScript (tsc) y tsx en Termux

Script de instalación rápida todo-en-uno para configurar un entorno de desarrollo completo en **Termux (Android)** o **Linux (Ubuntu / Debian / Servidores VPS)**.

---

## 📦 ¿Qué instala este script?

1. **Node.js (LTS) & npm**: Entorno de ejecución de JavaScript del lado del servidor.
2. **code-server**: Visual Studio Code accesible desde cualquier navegador web.
3. **tsc (`typescript`)**: Compilador oficial de TypeScript instalado globalmente.
4. **tsx**: Ejecutor moderno y ultra-rápido de archivos TypeScript (con soporte para `--watch` y ESM).
5. **readline-sync & @types/readline-sync**: Lectura sincrónica de entradas por teclado desde la consola.
6. **chalk & @types/chalk**: Salida en consola con colores y estilos.

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

## 🖥️ ¿Cómo usar las herramientas instaladas?

### 1. Iniciar `code-server` y conectarse desde la Red Local

El script configura automáticamente `code-server` para escuchar en `0.0.0.0:8080`, permitiendo acceder desde cualquier PC, tablet u otro móvil en la misma red Wi-Fi.

- **Iniciar el servidor:**
  Ejecuta simplemente:

  ```bash
  start-code
  ```

  _(Al iniciar, detectará y mostrará automáticamente tu IP local en pantalla)._

- **Acceso desde el navegador:**
  - **En el mismo dispositivo:** `http://localhost:8080`
  - **Desde tu PC u otro dispositivo en la red Wi-Fi:** `http://<IP_DE_TU_DISPOSITIVO>:8080` _(Ejemplo: `http://192.168.1.35:8080`)_
  - **Contraseña de acceso por defecto:** `admin`

- **Cambiar configuración o quitar contraseña:**
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

- **Ejecutar directamente con `tsx`:**

  ```bash
  tsx index.ts
  ```

- **Ejecutar con recarga automática al guardar cambios:**

  ```bash
  tsx watch index.ts
  ```

- **Compilar a JavaScript con `tsc`:**
  ```bash
  tsc index.ts
  node index.js
  ```

### Solución de problemas: error del enlazador al iniciar code-server

Si aparece `CANNOT LINK EXECUTABLE` junto al símbolo `_ZNSt6__ndk113__hash_memoryEPKvm`, no sigas reinstalando `libc++`, Node.js ni `code-server`: el mismo error está reportado para `code-server` de TUR en Termux de Google Play ([reporte](https://github.com/termux-play-store/termux-packages/issues/27)). El instalador identifica este caso y se detiene con un mensaje explicativo.

La alternativa es migrar a Termux de F-Droid o GitHub y luego volver a instalar los paquetes. **Respalda primero los archivos de Termux**: según las firmas de las distribuciones, puede ser necesario desinstalar la aplicación actual y eso borra sus datos. No instales una distribución encima de otra sin seguir sus instrucciones de migración.

---

## 🐳 Opción con Docker (Alpine Linux)

Si prefieres ejecutar todo este entorno aislado dentro de un contenedor ultraligero basado en **Alpine Linux**, tienes a tu disposición el `Dockerfile` y `docker-compose.yml`.
