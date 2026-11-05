# 🚀 Temux — Entorno de Desarrollo para Programación I (UCLA)

Conjunto de herramientas para levantar entornos de desarrollo en **Termux / Linux** y gestionar **aulas virtuales multi-alumno** con VS Code en el navegador.

---

## 📂 Documentación

| Documento | Descripción |
|-----------|-------------|
| [GUIA_TERMUX.md](./GUIA_TERMUX.md) | Instalación de Node.js, code-server, TypeScript y tsx en Termux / Linux / Docker |

---

## 🎓 Portal Automático por Cédula (UCLA - Programación I)

Sistema bajo demanda (*on-demand*): En lugar de tener 136 contenedores encendidos gastando memoria, el sistema **crea y enciende el contenedor de cada alumno únicamente cuando este inicia sesión con su cédula**. Su cédula es también su contraseña de acceso a VS Code.

### ¿Cómo funciona para tus alumnos?
1. Los alumnos entran desde su navegador a:
   `http://<IP_DEL_PROFESOR>:3000` (o al puerto 80 con Caddy).
2. Ingresan su **Cédula de Identidad**.
3. El sistema valida si está en la lista oficial (Secciones 1, 2 y 3), enciende su contenedor personal en 1 segundo y lo redirige automáticamente a su VS Code.
4. En VS Code, el alumno introduce su **Cédula** como contraseña.
5. Todo su trabajo se guarda en la carpeta local del profesor: `./alumnos/<cedula>/project`.

### ¿Cómo iniciarlo como profesor?
* **En Windows:** Haz doble clic en `iniciar-portal.bat` (o ejecuta `node portal.js` / `.\iniciar-portal.ps1`).
* **En Linux / Mac / WSL:** Ejecuta `./iniciar-portal.sh`.
* **Panel de Control y Asistencia:** Abre en tu navegador `http://localhost:3000/admin`.

---

## 📋 Control Diario de Asistencia y Reportes en Excel

Cada vez que un estudiante ingresa su cédula en el portal para abrir su entorno, el sistema **registra automáticamente su asistencia del día**.

* **Almacenamiento por fecha:** Los registros se guardan en la carpeta `./asistencia/asistencia_YYYY-MM-DD.csv` y `.json`.
* **Descarga para Excel:** Desde el panel de administración (`/admin`), el profesor puede pulsar **"📥 Descargar en Excel (.CSV)"** para obtener la planilla oficial de asistencia del día con todos los alumnos marcados como **PRESENTE** o **AUSENTE**, hora de ingreso e IP.
* **Estadísticas en vivo:** Visualiza en tiempo real el porcentaje y número de asistentes desglosado por **Sección 1, Sección 2 y Sección 3**.

---

## 👨‍🏫 Modo Profesor: Aulas Virtuales Multi-Alumno

Si enseñas programación y quieres que **cada alumno tenga su propio VS Code independiente**, puedes crear decenas de instancias aisladas en segundos.

### Características para el profesor:
* **Entornos 100% aislados:** Cada alumno tiene su propio puerto, contraseña y carpeta de proyectos independiente.
* **Control de recursos:** Cada contenedor está limitado a 512 MB de RAM y 0.75 CPU para evitar que bucles infinitos de los alumnos saturen el servidor del profesor.
* **Revisión de tareas:** Puedes acceder directamente a las carpetas `./alumnos/<alumno>/project` para revisar y calificar el código de cada estudiante.
* **Generación de credenciales:** Genera un archivo `.txt` y un archivo `.csv` compatible con Excel para repartir a tus alumnos.

### Uso en Windows (PowerShell):
```powershell
# 1. Crear instancias para 20 alumnos (o con un archivo: .\alumnos.ps1 crear lista.txt)
.\alumnos.ps1 crear 20

# 2. Iniciar el aula
.\alumnos.ps1 iniciar

# 3. Ver credenciales y URLs de todos los alumnos
.\alumnos.ps1 credenciales

# 4. Detener el aula al terminar la clase
.\alumnos.ps1 detener
```

### Uso en Linux / Mac / WSL / Git Bash:
```bash
# 1. Crear instancias para 20 alumnos
bash alumnos.sh crear 20

# 2. Iniciar el aula
bash alumnos.sh iniciar

# 3. Ver credenciales
bash alumnos.sh credenciales

# 4. Detener el aula
bash alumnos.sh detener
```
