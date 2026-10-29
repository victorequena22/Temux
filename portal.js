const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const os = require('os');
const url = require('url');

const PORT_PORTAL = process.env.PORTAL_PORT || 3000;
const ALUMNOS_FILE = path.join(__dirname, 'alumnos.json');
const ALUMNOS_DIR = path.join(__dirname, 'alumnos');
const ASISTENCIA_DIR = path.join(__dirname, 'asistencia');

// Asegurar directorios base
fs.mkdirSync(ALUMNOS_DIR, { recursive: true });
fs.mkdirSync(ASISTENCIA_DIR, { recursive: true });

// Cargar base de datos de alumnos
let alumnos = [];
try {
  alumnos = JSON.parse(fs.readFileSync(ALUMNOS_FILE, 'utf8'));
} catch (err) {
  console.error("Error al cargar alumnos.json:", err.message);
  process.exit(1);
}

// Mapa rápido por cédula
const alumnosMap = new Map();
alumnos.forEach(a => alumnosMap.set(String(a.cedula).trim(), a));

// Detectar IP local para la red
function obtenerIpLocal() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.')) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// Obtener fecha y hora local actual
function obtenerFechaYHora() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const fecha = `${year}-${month}-${day}`;

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const hora = `${hours}:${minutes}:${seconds}`;

  return { fecha, hora };
}

// Registrar asistencia diaria del alumno
function registrarAsistencia(alumno, ipCliente) {
  const { fecha, hora } = obtenerFechaYHora();
  const archivoJson = path.join(ASISTENCIA_DIR, `asistencia_${fecha}.json`);
  const archivoCsv = path.join(ASISTENCIA_DIR, `asistencia_${fecha}.csv`);

  let registros = [];
  if (fs.existsSync(archivoJson)) {
    try {
      registros = JSON.parse(fs.readFileSync(archivoJson, 'utf8'));
    } catch (e) {
      registros = [];
    }
  }

  let yaExiste = registros.find(r => r.cedula === alumno.cedula);
  if (!yaExiste) {
    const nuevo = {
      fecha,
      hora,
      cedula: alumno.cedula,
      nombre: alumno.nombre,
      seccion: alumno.seccion,
      ip: ipCliente || 'localhost'
    };
    registros.push(nuevo);
    fs.writeFileSync(archivoJson, JSON.stringify(registros, null, 2), 'utf8');

    // Actualizar CSV
    guardarCsvAsistencia(fecha, registros);

    console.log(`[ASISTENCIA REGISTRADA] ${alumno.nombre} (C.I: ${alumno.cedula}) - Sec. ${alumno.seccion} [Hora: ${hora}]`);
    return { registrado: true, hora, esNuevo: true };
  }

  return { registrado: true, hora: yaExiste.hora, esNuevo: false };
}

// Guardar archivo CSV con formato para Excel
function guardarCsvAsistencia(fecha, registrosPresentes) {
  const archivoCsv = path.join(ASISTENCIA_DIR, `asistencia_${fecha}.csv`);
  const mapaPresentes = new Map();
  registrosPresentes.forEach(r => mapaPresentes.set(r.cedula, r));

  let csvContent = '\uFEFF'; // BOM para que Excel respete acentos y caracteres UTF-8
  csvContent += 'Nro,Cedula,Apellidos_y_Nombres,Seccion,Estado,Hora_Ingreso,IP_Cliente\n';

  let nro = 1;
  alumnos.forEach(alumno => {
    const p = mapaPresentes.get(alumno.cedula);
    const estado = p ? 'PRESENTE' : 'AUSENTE';
    const hora = p ? p.hora : '-';
    const ip = p ? p.ip : '-';
    csvContent += `${nro},"${alumno.cedula}","${alumno.nombre}",${alumno.seccion},"${estado}","${hora}","${ip}"\n`;
    nro++;
  });

  fs.writeFileSync(archivoCsv, csvContent, 'utf8');
}

// Obtener datos de asistencia para una fecha
function obtenerAsistenciaFecha(fecha) {
  const archivoJson = path.join(ASISTENCIA_DIR, `asistencia_${fecha}.json`);
  let presentes = [];
  if (fs.existsSync(archivoJson)) {
    try {
      presentes = JSON.parse(fs.readFileSync(archivoJson, 'utf8'));
    } catch (e) {
      presentes = [];
    }
  }

  const mapaPresentes = new Map();
  presentes.forEach(p => mapaPresentes.set(p.cedula, p));

  const listaCompleta = alumnos.map(alumno => {
    const p = mapaPresentes.get(alumno.cedula);
    return {
      cedula: alumno.cedula,
      nombre: alumno.nombre,
      seccion: alumno.seccion,
      presente: !!p,
      hora: p ? p.hora : null,
      ip: p ? p.ip : null
    };
  });

  const totalPresentes = presentes.length;
  const sec1 = listaCompleta.filter(a => a.seccion === 1 && a.presente).length;
  const sec2 = listaCompleta.filter(a => a.seccion === 2 && a.presente).length;
  const sec3 = listaCompleta.filter(a => a.seccion === 3 && a.presente).length;

  return {
    fecha,
    total: alumnos.length,
    presentesCount: totalPresentes,
    ausentesCount: alumnos.length - totalPresentes,
    stats: {
      sec1: { presentes: sec1, total: 46 },
      sec2: { presentes: sec2, total: 45 },
      sec3: { presentes: sec3, total: 45 }
    },
    alumnos: listaCompleta
  };
}

// Ejecutar comando de Docker de manera asíncrona
function ejecutarComando(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        resolve({ ok: false, error: stderr || error.message });
      } else {
        resolve({ ok: true, output: stdout.trim() });
      }
    });
  });
}

let construyendoImagenPromise = null;

// Asegurar que la imagen base de Docker esté construida
async function asegurarImagenDocker() {
  const imgCheck = await ejecutarComando('docker image inspect temux-code-server:alpine');
  if (imgCheck.ok) return { ok: true };

  if (construyendoImagenPromise) {
    return await construyendoImagenPromise;
  }

  console.log('\n====================================================');
  console.log('  Construyendo imagen base temux-code-server:alpine ');
  console.log('  (Solo ocurre la primera vez, toma ~1 o 2 minutos) ');
  console.log('====================================================');

  construyendoImagenPromise = (async () => {
    const res = await ejecutarComando('docker build -t temux-code-server:alpine .');
    construyendoImagenPromise = null;
    if (!res.ok) {
      console.error('[ERROR] Falló la construcción de la imagen Docker:', res.error);
      return { ok: false, error: res.error };
    }
    console.log('[✔] ¡Imagen temux-code-server:alpine construida con éxito!\n');
    return { ok: true };
  })();

  return await construyendoImagenPromise;
}

// Inicializar plantilla de proyecto con readline-sync y chalk para el alumno
function inicializarProyectoAlumno(dirProject, alumno) {
  const filePackage = path.join(dirProject, 'package.json');
  const fileTsConfig = path.join(dirProject, 'tsconfig.json');
  const fileIndex = path.join(dirProject, 'index.ts');

  if (!fs.existsSync(filePackage)) {
    const pkg = {
      name: `proyecto-ci-${alumno.cedula}`,
      version: "1.0.0",
      description: `Entorno de Programación I - ${alumno.nombre}`,
      type: "module",
      scripts: {
        start: "tsx index.ts",
        dev: "tsx watch index.ts",
        build: "tsc"
      },
      dependencies: {
        "chalk": "^5.3.0",
        "readline-sync": "^1.4.10"
      },
      devDependencies: {
        "@types/chalk": "^2.2.4",
        "@types/node": "^20.0.0",
        "@types/readline-sync": "^1.4.8",
        "typescript": "^5.0.0",
        "tsx": "^4.0.0"
      }
    };
    fs.writeFileSync(filePackage, JSON.stringify(pkg, null, 2), 'utf8');
  }

  if (!fs.existsSync(fileTsConfig)) {
    const tsconfig = {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        esModuleInterop: true,
        strict: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true
      }
    };
    fs.writeFileSync(fileTsConfig, JSON.stringify(tsconfig, null, 2), 'utf8');
  }

  if (!fs.existsSync(fileIndex)) {
    const code = `import readlineSync from 'readline-sync';
import chalk from 'chalk';

console.clear();
console.log(chalk.bold.blue('=============================================='));
console.log(chalk.bold.cyan('  UCLA - Decanato de Ciencias y Tecnología   '));
console.log(chalk.bold.yellow('          INT214 - PROGRAMACIÓN I            '));
console.log(chalk.bold.blue('==============================================\\n'));
console.log(chalk.green('Estudiante: ${alumno.nombre}'));
console.log(chalk.gray('Cédula: ${alumno.cedula} | Sección: ${alumno.seccion}\\n'));

// Ejemplo interactivo con readline-sync y chalk
const nombre = readlineSync.question(chalk.cyan('¿Cómo te llamas? '));
const edad = readlineSync.questionInt(chalk.cyan('¿Cuántos años tienes? '));

console.log(chalk.bold.magenta(\`\\n¡Hola, \${nombre}! Tienes \${edad} años.\`));
console.log(chalk.green('Tu entorno con readline-sync y chalk está listo para usar.'));
console.log(chalk.gray('Para ejecutar tu código escribe en la terminal: tsx index.ts\\n'));
`;
    fs.writeFileSync(fileIndex, code, 'utf8');
  }
}

// Verificar o iniciar contenedor del alumno
async function iniciarContenedorAlumno(alumno) {
  const containerName = `cs_${alumno.cedula}`;
  const dirProject = path.resolve(ALUMNOS_DIR, alumno.cedula, 'project');
  const dirConfig = path.resolve(ALUMNOS_DIR, alumno.cedula, 'config');

  fs.mkdirSync(dirProject, { recursive: true });
  fs.mkdirSync(dirConfig, { recursive: true });

  // Inicializar archivos del proyecto (package.json, tsconfig.json, index.ts con readline-sync y chalk)
  inicializarProyectoAlumno(dirProject, alumno);

  const check = await ejecutarComando(`docker inspect --format="{{.State.Running}}" ${containerName}`);
  
  if (check.ok) {
    if (check.output === 'true') {
      return { ok: true, status: 'already_running', port: alumno.puerto };
    } else {
      const start = await ejecutarComando(`docker start ${containerName}`);
      if (start.ok) {
        return { ok: true, status: 'started', port: alumno.puerto };
      }
    }
  }

  // Asegurar que la imagen base exista o construirla automáticamente
  const imgReady = await asegurarImagenDocker();
  if (!imgReady.ok) {
    return {
      ok: false,
      error: "Error al construir la imagen Docker: " + (imgReady.error || "Verifica que Docker Desktop esté abierto") + ". También puedes ejecutar en PowerShell: docker build -t temux-code-server:alpine ."
    };
  }

  const volProject = dirProject.replace(/\\/g, '/');
  const volConfig = dirConfig.replace(/\\/g, '/');

  const dockerRunCmd = `docker run -d ` +
    `--name ${containerName} ` +
    `-p ${alumno.puerto}:8080 ` +
    `-e PORT=8080 ` +
    `-e AUTH=password ` +
    `-e PASSWORD=${alumno.cedula} ` +
    `-v "${volProject}":/home/coder/project ` +
    `-v "${volConfig}":/home/coder/.config ` +
    `--cpus="0.75" ` +
    `--memory="512m" ` +
    `--restart=unless-stopped ` +
    `temux-code-server:alpine`;

  const runRes = await ejecutarComando(dockerRunCmd);
  if (!runRes.ok) {
    return { ok: false, error: runRes.error };
  }

  await new Promise(r => setTimeout(r, 1200));
  return { ok: true, status: 'created', port: alumno.puerto };
}

// Obtener lista de contenedores cs_* activos
async function obtenerContenedoresActivos() {
  const res = await ejecutarComando(`docker ps --filter "name=cs_" --format "{{.Names}}|{{.Status}}"`);
  if (!res.ok) return [];
  const lineas = res.output.split('\n').filter(Boolean);
  return lineas.map(l => {
    const [name, status] = l.split('|');
    return { name, status };
  });
}

// Detener todos los contenedores de alumnos
async function detenerTodosLosContenedores() {
  const res = await ejecutarComando(`docker ps -q --filter "name=cs_"`);
  if (res.ok && res.output) {
    const ids = res.output.replace(/\n/g, ' ');
    await ejecutarComando(`docker stop ${ids}`);
    return { ok: true, count: ids.split(' ').length };
  }
  return { ok: true, count: 0 };
}

// Servidor HTTP
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const hostHeader = req.headers['host'] || '';
  const clientHost = hostHeader.split(':')[0] || obtenerIpLocal();
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'localhost';

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // API: Iniciar sesión con Cédula
  if (req.method === 'POST' && pathname === '/api/login') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { cedula } = JSON.parse(body || '{}');
        const cedulaLimpia = String(cedula || '').replace(/[^0-9]/g, '');

        if (!cedulaLimpia) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ ok: false, error: 'Por favor ingresa un número de cédula válido.' }));
        }

        const alumno = alumnosMap.get(cedulaLimpia);
        if (!alumno) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            ok: false,
            error: `La cédula ${cedulaLimpia} no se encuentra en las listas de Programación I (Secciones 1, 2 y 3).`
          }));
        }

        // 1. REGISTRAR ASISTENCIA DIARIA AUTOMÁTICA
        const asistInfo = registrarAsistencia(alumno, clientIp);

        // 2. CREAR/INICIAR CONTENEDOR EN DOCKER
        const resultado = await iniciarContenedorAlumno(alumno);
        if (!resultado.ok) {
          console.error(`[ERROR] No se pudo iniciar el contenedor para ${alumno.nombre} (${alumno.cedula}):`, resultado.error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            ok: false,
            error: 'No se pudo iniciar la instancia de Docker: ' + resultado.error
          }));
        }

        console.log(`[LOGIN DINÁMICO] ${alumno.nombre} (C.I: ${alumno.cedula}) - Sec. ${alumno.seccion} -> Contenedor cs_${alumno.cedula} en puerto ${alumno.puerto} [Estado: ${resultado.status}]`);

        const ipDestino = (clientHost === 'localhost' || clientHost === '127.0.0.1') ? 'localhost' : clientHost;
        const urlDestino = `http://${ipDestino}:${alumno.puerto}`;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          alumno: {
            cedula: alumno.cedula,
            nombre: alumno.nombre,
            seccion: alumno.seccion,
            puerto: alumno.puerto
          },
          url: urlDestino,
          password: alumno.cedula,
          status: resultado.status,
          asistencia: asistInfo
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // API: Estado de contenedores (Admin)
  if (req.method === 'GET' && pathname === '/api/admin/estado') {
    const activos = await obtenerContenedoresActivos();
    const activosSet = new Set(activos.map(a => a.name));

    const lista = alumnos.map(a => ({
      ...a,
      activo: activosSet.has(`cs_${a.cedula}`)
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      total: alumnos.length,
      activosCount: activos.length,
      alumnos: lista
    }));
  }

  // API: Obtener Asistencia por Fecha (Admin)
  if (req.method === 'GET' && pathname === '/api/admin/asistencia') {
    const { fecha: fechaHoy } = obtenerFechaYHora();
    const fecha = parsedUrl.query.fecha || fechaHoy;
    const datos = obtenerAsistenciaFecha(fecha);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(datos));
  }

  // API: Descargar CSV de Asistencia para Excel (Admin)
  if (req.method === 'GET' && pathname === '/api/admin/asistencia/descargar') {
    const { fecha: fechaHoy } = obtenerFechaYHora();
    const fecha = parsedUrl.query.fecha || fechaHoy;
    const archivoCsv = path.join(ASISTENCIA_DIR, `asistencia_${fecha}.csv`);

    // Si aún no se ha generado para esa fecha, generarlo
    if (!fs.existsSync(archivoCsv)) {
      const archivoJson = path.join(ASISTENCIA_DIR, `asistencia_${fecha}.json`);
      let pres = [];
      if (fs.existsSync(archivoJson)) {
        try { pres = JSON.parse(fs.readFileSync(archivoJson, 'utf8')); } catch(e){}
      }
      guardarCsvAsistencia(fecha, pres);
    }

    const contenido = fs.readFileSync(archivoCsv);
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="asistencia_UCLA_${fecha}.csv"`
    });
    return res.end(contenido);
  }

  // API: Detener todas las instancias (Admin)
  if (req.method === 'POST' && pathname === '/api/admin/detener-todos') {
    const r = await detenerTodosLosContenedores();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, message: `Se detuvieron ${r.count} contenedores.` }));
  }

  // Vista principal: Portal HTML
  if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html' || pathname === '/admin')) {
    const isAdmin = pathname === '/admin';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(generarHtml(isAdmin));
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Página no encontrada');
});

// Generador de Interfaz Web
function generarHtml(isAdmin) {
  const { fecha: fechaHoy } = obtenerFechaYHora();
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UCLA - Programación I | Entornos de Desarrollo</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #004b87;
      --primary-light: #0d6efd;
      --accent: #ffc107;
      --bg: #f4f7fb;
      --card-bg: #ffffff;
      --text: #212529;
      --text-muted: #6c757d;
      --border: #e2e8f0;
      --success: #198754;
      --danger: #dc3545;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: linear-gradient(135deg, #002b4d 0%, #004b87 100%);
      color: white;
      padding: 24px 20px;
      text-align: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    header h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 4px; }
    header p { font-size: 0.95rem; opacity: 0.9; }
    .badge-materia {
      display: inline-block;
      background: rgba(255,255,255,0.2);
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.85rem;
      margin-top: 8px;
      font-weight: 500;
    }
    main {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 25px 20px;
    }
    .card {
      background: var(--card-bg);
      border-radius: 16px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.06);
      width: 100%;
      max-width: ${isAdmin ? '1050px' : '480px'};
      padding: 30px;
      border: 1px solid var(--border);
    }
    .card h2 {
      font-size: 1.35rem;
      font-weight: 700;
      color: var(--primary);
      margin-bottom: 6px;
      text-align: center;
    }
    .card .subtitle {
      font-size: 0.9rem;
      color: var(--text-muted);
      text-align: center;
      margin-bottom: 24px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      font-size: 0.88rem;
      font-weight: 600;
      margin-bottom: 8px;
    }
    input[type="text"], input[type="search"], input[type="date"], select {
      width: 100%;
      padding: 12px 14px;
      font-size: 1rem;
      border: 2px solid var(--border);
      border-radius: 10px;
      outline: none;
      transition: all 0.2s;
    }
    input[type="text"]:focus, input[type="search"]:focus, input[type="date"]:focus {
      border-color: var(--primary-light);
      box-shadow: 0 0 0 3px rgba(13,110,253,0.15);
    }
    .btn {
      width: 100%;
      padding: 13px;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      transition: background 0.2s;
      text-decoration: none;
    }
    .btn:hover { background: #003662; }
    .btn:disabled { background: #a0aec0; cursor: not-allowed; }
    .btn-danger { background: var(--danger); }
    .btn-danger:hover { background: #bb2d3b; }
    .btn-success { background: var(--success); }
    .btn-success:hover { background: #146c43; }
    .info-box {
      margin-top: 20px;
      background: #eef5ff;
      border-left: 4px solid var(--primary-light);
      padding: 14px;
      border-radius: 8px;
      font-size: 0.88rem;
      line-height: 1.5;
    }
    .spinner {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 3px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .alert {
      padding: 14px;
      border-radius: 8px;
      margin-top: 16px;
      font-size: 0.9rem;
      display: none;
    }
    .alert-danger { background: #f8d7da; color: #842029; border: 1px solid #f5c2c7; }
    .alert-success { background: #d1e7dd; color: #0f5132; border: 1px solid #badbcc; }
    .footer {
      text-align: center;
      padding: 16px;
      font-size: 0.85rem;
      color: var(--text-muted);
    }
    /* Estilos Admin y Pestañas */
    .tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      border-bottom: 2px solid var(--border);
      padding-bottom: 10px;
    }
    .tab-btn {
      padding: 10px 18px;
      border-radius: 8px;
      border: none;
      background: #e2e8f0;
      color: #334155;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .tab-btn.active {
      background: var(--primary);
      color: white;
    }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }
    .stat-card {
      background: #f8fafc;
      border: 1px solid var(--border);
      padding: 14px;
      border-radius: 10px;
      text-align: center;
    }
    .stat-card .num { font-size: 1.5rem; font-weight: 700; color: var(--primary); }
    .stat-card .label { font-size: 0.8rem; color: var(--text-muted); margin-top: 4px; }
    
    table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 0.88rem; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border); }
    th { background: #f8fafc; font-weight: 600; position: sticky; top: 0; }
    .status-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 0.78rem;
      font-weight: 600;
    }
    .status-active, .status-presente { background: #d1e7dd; color: #0f5132; }
    .status-inactive, .status-ausente { background: #f8d7da; color: #842029; }
  </style>
</head>
<body>

  <header>
    <h1>Universidad Centroccidental "Lisandro Alvarado"</h1>
    <p>Decanato de Ciencias y Tecnología • Ingeniería Telemática</p>
    <div class="badge-materia">INT214 - PROGRAMACIÓN I (Lapso 2026-2)</div>
  </header>

  <main>
    ${isAdmin ? renderAdminView(fechaHoy) : renderStudentView()}
  </main>

  <div class="footer">
    ${isAdmin ? '<a href="/">← Volver al Portal de Alumnos</a>' : '<a href="/admin">Panel del Profesor</a>'}
    • Sistema de Aulas Virtuales con Registro Diario de Asistencia
  </div>

</body>
</html>`;
}

function renderStudentView() {
  return `
    <div class="card">
      <h2>Portal de Acceso a VS Code</h2>
      <p class="subtitle">Ingresa tu cédula para registrar tu asistencia e iniciar tu entorno personal</p>

      <form id="loginForm" onsubmit="handleLogin(event)">
        <div class="form-group">
          <label for="cedula">Cédula de Identidad:</label>
          <input type="text" id="cedula" name="cedula" placeholder="Ej: 32808068" required autofocus autocomplete="off">
        </div>

        <button type="submit" id="btnSubmit" class="btn">
          <span>🚀 Entrar a mi Entorno</span>
        </button>
      </form>

      <div id="alertBox" class="alert"></div>

      <div class="info-box">
        <strong>💡 Instrucciones para el alumno:</strong><br>
        1. Al ingresar tu cédula, tu <strong>asistencia del día queda registrada automáticamente</strong>.<br>
        2. Tu servidor personal de VS Code se encenderá en 1 segundo.<br>
        3. Cuando el navegador te pida contraseña, <strong>tu contraseña es tu misma Cédula</strong>.
      </div>
    </div>

    <script>
      async function handleLogin(e) {
        e.preventDefault();
        const cedulaInput = document.getElementById('cedula');
        const btn = document.getElementById('btnSubmit');
        const alertBox = document.getElementById('alertBox');
        const cedula = cedulaInput.value.trim();

        if (!cedula) return;

        btn.disabled = true;
        btn.innerHTML = '<div class="spinner"></div><span>Registrando asistencia y arrancando...</span>';
        alertBox.style.display = 'none';

        try {
          const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cedula })
          });
          const data = await res.json();

          if (!res.ok || !data.ok) {
            throw new Error(data.error || 'Ocurrió un error al conectar.');
          }

          alertBox.className = 'alert alert-success';
          alertBox.style.display = 'block';
          alertBox.innerHTML = '<strong>¡Bienvenido(a) ' + data.alumno.nombre + '!</strong><br>' +
                               'Sección ' + data.alumno.seccion + ' • Asistencia registrada a las ' + data.asistencia.hora + '<br>' +
                               'Redirigiendo a tu VS Code personal...';

          setTimeout(() => {
            window.location.href = data.url;
          }, 1400);

        } catch (err) {
          alertBox.className = 'alert alert-danger';
          alertBox.style.display = 'block';
          alertBox.innerText = err.message;
          btn.disabled = false;
          btn.innerHTML = '<span>🚀 Entrar a mi Entorno</span>';
        }
      }
    </script>
  `;
}

function renderAdminView(fechaHoy) {
  return `
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
        <div>
          <h2>Panel de Control del Profesor</h2>
          <p class="subtitle" style="margin-bottom: 0; text-align: left;">Monitoreo de contenedores y registro de asistencia diaria</p>
        </div>
        <button onclick="detenerTodos()" class="btn btn-danger" style="width: auto; padding: 10px 18px; font-size: 0.88rem;">
          🛑 Apagar Contenedores Activos
        </button>
      </div>

      <!-- Pestañas de Navegación -->
      <div class="tabs">
        <button class="tab-btn active" onclick="cambiarPestana('pestana-asistencia')">📋 Registro de Asistencia Diaria</button>
        <button class="tab-btn" onclick="cambiarPestana('pestana-contenedores')">🖥️ Contenedores en Vivo</button>
      </div>

      <!-- ================= PESTAÑA: ASISTENCIA ================= -->
      <div id="pestana-asistencia" class="tab-content active">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <label for="fechaPicker" style="margin-bottom: 0; font-weight: 600;">Fecha de Clase:</label>
            <input type="date" id="fechaPicker" value="${fechaHoy}" onchange="cargarAsistencia()" style="width: auto; padding: 8px 12px;">
          </div>
          <a id="btnDescargarCsv" href="/api/admin/asistencia/descargar?fecha=${fechaHoy}" class="btn btn-success" style="width: auto; padding: 9px 16px; font-size: 0.9rem;">
            📥 Descargar en Excel (.CSV)
          </a>
        </div>

        <!-- Tarjetas de Estadísticas -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="num" id="statTotalPres">0</div>
            <div class="label">Total Presentes (Hoy)</div>
          </div>
          <div class="stat-card">
            <div class="num" id="statSec1">0 / 46</div>
            <div class="label">Sección 1</div>
          </div>
          <div class="stat-card">
            <div class="num" id="statSec2">0 / 45</div>
            <div class="label">Sección 2</div>
          </div>
          <div class="stat-card">
            <div class="num" id="statSec3">0 / 45</div>
            <div class="label">Sección 3</div>
          </div>
        </div>

        <!-- Filtros de Asistencia -->
        <div style="display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap;">
          <input type="search" id="filtroAsistencia" placeholder="Buscar alumno por nombre o cédula..." oninput="filtrarAsistencia()" style="flex: 2; min-width: 200px;">
          <select id="seccionAsistencia" onchange="filtrarAsistencia()" style="flex: 1; min-width: 150px;">
            <option value="0">Todas las Secciones</option>
            <option value="1">Sección 1</option>
            <option value="2">Sección 2</option>
            <option value="3">Sección 3</option>
          </select>
          <select id="estadoAsistencia" onchange="filtrarAsistencia()" style="flex: 1; min-width: 150px;">
            <option value="todos">Todos los alumnos</option>
            <option value="presentes">Solo Presentes</option>
            <option value="ausentes">Solo Ausentes</option>
          </select>
        </div>

        <div style="max-height: 440px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px;">
          <table>
            <thead>
              <tr>
                <th>Cédula</th>
                <th>Apellidos y Nombres</th>
                <th>Sec.</th>
                <th>Estado</th>
                <th>Hora de Ingreso</th>
                <th>IP de Conexión</th>
              </tr>
            </thead>
            <tbody id="tablaAsistencia">
              <tr><td colspan="6" style="text-align: center;">Cargando asistencia...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ================= PESTAÑA: CONTENEDORES ================= -->
      <div id="pestana-contenedores" class="tab-content">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <span style="font-size: 0.9rem; color: var(--text-muted);">
            Instancias encendidas ahora: <strong id="lblActivos" style="color: var(--success); font-size: 1.1rem;">0</strong> / <span id="lblTotal">136</span>
          </span>
          <button onclick="cargarContenedores()" class="btn" style="width: auto; padding: 6px 14px; font-size: 0.85rem;">🔄 Refrescar</button>
        </div>

        <div style="display: flex; gap: 10px; margin-bottom: 14px;">
          <input type="search" id="filtroContenedores" placeholder="Buscar en contenedores..." oninput="filtrarContenedores()" style="flex: 1;">
        </div>

        <div style="max-height: 440px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px;">
          <table>
            <thead>
              <tr>
                <th>Cédula</th>
                <th>Apellidos y Nombres</th>
                <th>Sec.</th>
                <th>Puerto</th>
                <th>Estado</th>
                <th>Acceso</th>
              </tr>
            </thead>
            <tbody id="tablaContenedores">
              <tr><td colspan="6" style="text-align: center;">Cargando contenedores...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>

    <script>
      let datosAsistenciaActual = [];
      let datosContenedores = [];

      function cambiarPestana(id) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        event.target.classList.add('active');
      }

      async function cargarAsistencia() {
        const fecha = document.getElementById('fechaPicker').value;
        document.getElementById('btnDescargarCsv').href = '/api/admin/asistencia/descargar?fecha=' + fecha;

        try {
          const res = await fetch('/api/admin/asistencia?fecha=' + fecha);
          const data = await res.json();
          datosAsistenciaActual = data.alumnos;

          document.getElementById('statTotalPres').innerText = data.presentesCount + ' / ' + data.total;
          document.getElementById('statSec1').innerText = data.stats.sec1.presentes + ' / 46';
          document.getElementById('statSec2').innerText = data.stats.sec2.presentes + ' / 45';
          document.getElementById('statSec3').innerText = data.stats.sec3.presentes + ' / 45';

          filtrarAsistencia();
        } catch (e) {
          console.error(e);
        }
      }

      function filtrarAsistencia() {
        const q = document.getElementById('filtroAsistencia').value.toLowerCase();
        const sec = parseInt(document.getElementById('seccionAsistencia').value);
        const est = document.getElementById('estadoAsistencia').value;
        const tbody = document.getElementById('tablaAsistencia');

        const filtrados = datosAsistenciaActual.filter(a => {
          const coincideTexto = a.cedula.includes(q) || a.nombre.toLowerCase().includes(q);
          const coincideSec = sec === 0 || a.seccion === sec;
          const coincideEst = est === 'todos' || 
                              (est === 'presentes' && a.presente) || 
                              (est === 'ausentes' && !a.presente);
          return coincideTexto && coincideSec && coincideEst;
        });

        if (filtrados.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No hay alumnos que coincidan con el filtro.</td></tr>';
          return;
        }

        tbody.innerHTML = filtrados.map(a => {
          const badge = a.presente
            ? '<span class="status-badge status-presente">Presente</span>'
            : '<span class="status-badge status-ausente">Ausente</span>';
          
          return '<tr>' +
            '<td><strong>' + a.cedula + '</strong></td>' +
            '<td>' + a.nombre + '</td>' +
            '<td>' + a.seccion + '</td>' +
            '<td>' + badge + '</td>' +
            '<td>' + (a.hora || '-') + '</td>' +
            '<td><small style="color: var(--text-muted);">' + (a.ip || '-') + '</small></td>' +
          '</tr>';
        }).join('');
      }

      async function cargarContenedores() {
        try {
          const res = await fetch('/api/admin/estado');
          const data = await res.json();
          datosContenedores = data.alumnos;
          document.getElementById('lblTotal').innerText = data.total;
          document.getElementById('lblActivos').innerText = data.activosCount;
          filtrarContenedores();
        } catch (e) {
          console.error(e);
        }
      }

      function filtrarContenedores() {
        const q = document.getElementById('filtroContenedores').value.toLowerCase();
        const tbody = document.getElementById('tablaContenedores');

        const filtrados = datosContenedores.filter(a => {
          return a.cedula.includes(q) || a.nombre.toLowerCase().includes(q);
        });

        tbody.innerHTML = filtrados.map(a => {
          const estado = a.activo 
            ? '<span class="status-badge status-active">Activo</span>'
            : '<span class="status-badge" style="background: #e2e8f0; color: #64748b;">Inactivo</span>';
          
          const enlace = a.activo 
            ? '<a href="http://' + window.location.hostname + ':' + a.puerto + '" target="_blank" style="color: var(--primary-light); font-weight: 600;">Abrir VS Code</a>'
            : '<span style="color: #aaa;">-</span>';

          return '<tr>' +
            '<td><strong>' + a.cedula + '</strong></td>' +
            '<td>' + a.nombre + '</td>' +
            '<td>' + a.seccion + '</td>' +
            '<td>' + a.puerto + '</td>' +
            '<td>' + estado + '</td>' +
            '<td>' + enlace + '</td>' +
          '</tr>';
        }).join('');
      }

      async function detenerTodos() {
        if (!confirm('¿Deseas apagar todos los contenedores de los alumnos? Las tareas, código y asistencia NO se perderán.')) return;
        const res = await fetch('/api/admin/detener-todos', { method: 'POST' });
        const d = await res.json();
        alert(d.message);
        cargarContenedores();
      }

      // Carga inicial y actualización automática cada 8s
      cargarAsistencia();
      cargarContenedores();
      setInterval(() => {
        cargarContenedores();
      }, 8000);
    </script>
  `;
}

// Iniciar servidor
server.listen(PORT_PORTAL, '0.0.0.0', async () => {
  const ip = obtenerIpLocal();
  const { fecha } = obtenerFechaYHora();
  console.log('====================================================');
  console.log('  Portal de Aulas Virtuales - Programación I (UCLA)');
  console.log('  * Con Registro Automático Diario de Asistencia *  ');
  console.log('====================================================');
  console.log(`  • Portal Alumnos:      http://localhost:${PORT_PORTAL}`);
  console.log(`  • Portal en Red:       http://${ip}:${PORT_PORTAL}`);
  console.log(`  • Panel y Asistencia:  http://${ip}:${PORT_PORTAL}/admin`);
  console.log('====================================================');
  console.log(`  Fecha de clase activa: ${fecha}`);
  console.log(`  Total alumnos registrados: ${alumnos.length}`);

  // Verificar si la imagen base de Docker está construida
  const imgCheck = await ejecutarComando('docker image inspect temux-code-server:alpine');
  if (!imgCheck.ok) {
    console.log('\n[AVISO] La imagen temux-code-server:alpine aún no está construida.');
    console.log('Para construirla ejecuta en tu terminal:');
    console.log('👉 docker build -t temux-code-server:alpine .\n');
  } else {
    console.log('  [✔] Imagen temux-code-server:alpine lista.');
  }

  console.log('  Listo para recibir conexiones...');
});
