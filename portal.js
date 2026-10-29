const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const os = require('os');

const PORT_PORTAL = process.env.PORTAL_PORT || 3000;
const ALUMNOS_FILE = path.join(__dirname, 'alumnos.json');
const ALUMNOS_DIR = path.join(__dirname, 'alumnos');

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

// Verificar o iniciar contenedor del alumno
async function iniciarContenedorAlumno(alumno) {
  const containerName = `cs_${alumno.cedula}`;
  const dirProject = path.resolve(ALUMNOS_DIR, alumno.cedula, 'project');
  const dirConfig = path.resolve(ALUMNOS_DIR, alumno.cedula, 'config');

  fs.mkdirSync(dirProject, { recursive: true });
  fs.mkdirSync(dirConfig, { recursive: true });

  // 1. Verificar si existe y si está corriendo
  const check = await ejecutarComando(`docker inspect --format="{{.State.Running}}" ${containerName}`);
  
  if (check.ok) {
    if (check.output === 'true') {
      return { ok: true, status: 'already_running', port: alumno.puerto };
    } else {
      // Iniciar contenedor detenido
      const start = await ejecutarComando(`docker start ${containerName}`);
      if (start.ok) {
        return { ok: true, status: 'started', port: alumno.puerto };
      }
    }
  }

  // 2. Si no existe, crearlo y arrancarlo
  // Usar formato compatible con Windows y Linux en paths de volumen
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

  // Pequeña espera para que code-server inicialice
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
  const hostHeader = req.headers['host'] || '';
  const clientHost = hostHeader.split(':')[0] || obtenerIpLocal();

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // API: Iniciar sesión con Cédula
  if (req.method === 'POST' && req.url === '/api/login') {
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

        // Crear/Iniciar contenedor
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
          status: resultado.status
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // API: Estado de alumnos (Admin)
  if (req.method === 'GET' && req.url === '/api/admin/estado') {
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

  // API: Detener todas las instancias (Admin)
  if (req.method === 'POST' && req.url === '/api/admin/detener-todos') {
    const r = await detenerTodosLosContenedores();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, message: `Se detuvieron ${r.count} contenedores.` }));
  }

  // Vista principal: Portal HTML
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html' || req.url === '/admin')) {
    const isAdmin = req.url === '/admin';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(generarHtml(isAdmin));
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Página no encontrada');
});

// Generador de Interfaz Web
function generarHtml(isAdmin) {
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
      padding: 30px 20px;
    }
    .card {
      background: var(--card-bg);
      border-radius: 16px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.06);
      width: 100%;
      max-width: ${isAdmin ? '900px' : '480px'};
      padding: 32px 28px;
      border: 1px solid var(--border);
    }
    .card h2 {
      font-size: 1.35rem;
      font-weight: 700;
      color: var(--primary);
      margin-bottom: 8px;
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
    input[type="text"], input[type="search"] {
      width: 100%;
      padding: 14px 16px;
      font-size: 1.1rem;
      border: 2px solid var(--border);
      border-radius: 10px;
      outline: none;
      transition: all 0.2s;
    }
    input[type="text"]:focus, input[type="search"]:focus {
      border-color: var(--primary-light);
      box-shadow: 0 0 0 3px rgba(13,110,253,0.15);
    }
    .btn {
      width: 100%;
      padding: 14px;
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
    }
    .btn:hover { background: #003662; }
    .btn:disabled { background: #a0aec0; cursor: not-allowed; }
    .btn-danger { background: #dc3545; }
    .btn-danger:hover { background: #bb2d3b; }
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
    /* Estilos Admin */
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 0.88rem; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border); }
    th { background: #f8fafc; font-weight: 600; }
    .status-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .status-active { background: #d1e7dd; color: #0f5132; }
    .status-inactive { background: #e2e8f0; color: #475569; }
  </style>
</head>
<body>

  <header>
    <h1>Universidad Centroccidental "Lisandro Alvarado"</h1>
    <p>Decanato de Ciencias y Tecnología • Ingeniería Telemática</p>
    <div class="badge-materia">INT214 - PROGRAMACIÓN I (Lapso 2026-2)</div>
  </header>

  <main>
    ${isAdmin ? renderAdminView() : renderStudentView()}
  </main>

  <div class="footer">
    ${isAdmin ? '<a href="/">← Volver al Portal de Alumnos</a>' : '<a href="/admin">Panel del Profesor</a>'}
    • Sistema de Aulas Virtuales con Contenedores Docker
  </div>

</body>
</html>`;
}

function renderStudentView() {
  return `
    <div class="card">
      <h2>Portal de Acceso a VS Code</h2>
      <p class="subtitle">Ingresa tu cédula para iniciar tu entorno personal de desarrollo</p>

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
        1. Al pulsar el botón, tu servidor personal de VS Code se encenderá automáticamente.<br>
        2. Cuando te solicite contraseña en pantalla, <strong>tu contraseña es tu misma Cédula</strong>.<br>
        3. Todo tu código y proyectos se guardan automáticamente en tu carpeta personal.
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
        btn.innerHTML = '<div class="spinner"></div><span>Preparando tu entorno...</span>';
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
                               'Sección ' + data.alumno.seccion + ' • Redirigiendo a tu VS Code...';

          setTimeout(() => {
            window.location.href = data.url;
          }, 1500);

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

function renderAdminView() {
  return `
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
        <div>
          <h2>Panel de Control del Profesor</h2>
          <p class="subtitle" style="margin-bottom: 0; text-align: left;">Monitoreo de instancias activas de alumnos</p>
        </div>
        <button onclick="detenerTodos()" class="btn btn-danger" style="width: auto; padding: 10px 18px; font-size: 0.88rem;">
          🛑 Apagar Todas las Instancias
        </button>
      </div>

      <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
        <input type="search" id="filtro" placeholder="Buscar por nombre o cédula..." oninput="filtrar()" style="flex: 1; padding: 10px;">
        <select id="seccionFiltro" onchange="filtrar()" style="padding: 10px; border-radius: 10px; border: 2px solid var(--border);">
          <option value="0">Todas las Secciones</option>
          <option value="1">Sección 1</option>
          <option value="2">Sección 2</option>
          <option value="3">Sección 3</option>
        </select>
      </div>

      <div style="margin-bottom: 12px; font-size: 0.9rem; color: var(--text-muted);">
        Alumnos activos ahora: <strong id="lblActivos" style="color: var(--success); font-size: 1.1rem;">0</strong> / <span id="lblTotal">136</span>
      </div>

      <div style="max-height: 480px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px;">
        <table>
          <thead>
            <tr>
              <th>Cédula</th>
              <th>Apellidos y Nombres</th>
              <th>Sec.</th>
              <th>Puerto</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody id="tablaAlumnos">
            <tr><td colspan="6" style="text-align: center;">Cargando lista...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <script>
      let todosAlumnos = [];

      async function cargarEstado() {
        try {
          const res = await fetch('/api/admin/estado');
          const data = await res.json();
          todosAlumnos = data.alumnos;
          document.getElementById('lblTotal').innerText = data.total;
          document.getElementById('lblActivos').innerText = data.activosCount;
          filtrar();
        } catch (e) {
          console.error(e);
        }
      }

      function filtrar() {
        const q = document.getElementById('filtro').value.toLowerCase();
        const sec = parseInt(document.getElementById('seccionFiltro').value);
        const tbody = document.getElementById('tablaAlumnos');

        const filtrados = todosAlumnos.filter(a => {
          const coincideTexto = a.cedula.includes(q) || a.nombre.toLowerCase().includes(q);
          const coincideSec = sec === 0 || a.seccion === sec;
          return coincideTexto && coincideSec;
        });

        tbody.innerHTML = filtrados.map(a => {
          const estado = a.activo 
            ? '<span class="status-badge status-active">Activo</span>'
            : '<span class="status-badge status-inactive">Inactivo</span>';
          
          const enlace = a.activo 
            ? '<a href="http://' + window.location.hostname + ':' + a.puerto + '" target="_blank" style="color: var(--primary-light); font-weight: 600;">Abrir VS Code</a>'
            : '<span style="color: #999;">-</span>';

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
        if (!confirm('¿Deseas apagar todos los contenedores de los alumnos? Las tareas y archivos no se perderán.')) return;
        const res = await fetch('/api/admin/detener-todos', { method: 'POST' });
        const d = await res.json();
        alert(d.message);
        cargarEstado();
      }

      cargarEstado();
      setInterval(cargarEstado, 5000); // Actualiza cada 5s
    </script>
  `;
}

// Iniciar servidor
server.listen(PORT_PORTAL, '0.0.0.0', () => {
  const ip = obtenerIpLocal();
  console.log('====================================================');
  console.log('  Portal de Aulas Virtuales - Programación I (UCLA)');
  console.log('====================================================');
  console.log(`  • Portal Alumnos:  http://localhost:${PORT_PORTAL}`);
  console.log(`  • Portal en Red:   http://${ip}:${PORT_PORTAL}`);
  console.log(`  • Panel Profesor:  http://${ip}:${PORT_PORTAL}/admin`);
  console.log('====================================================');
  console.log(`  Total alumnos registrados: ${alumnos.length}`);
  console.log('  Listo para recibir conexiones...');
});
