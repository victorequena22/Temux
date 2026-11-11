package main

// HTML del Portal y Entorno Web
const HTMLIndex = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UCLA - Programación I | Entorno de Desarrollo</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <!-- Monaco Editor (VS Code Web Editor) -->
  <link rel="stylesheet" data-name="vs/editor/editor.main" href="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/editor/editor.main.min.css">
  <style>
    :root {
      --primary: #004b87;
      --primary-light: #0d6efd;
      --accent: #ffc107;
      --bg: #0f172a;
      --surface: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --success: #10b981;
      --danger: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', sans-serif;
      background: var(--bg);
      color: var(--text);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* VISTA LOGIN */
    #vistaLogin {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at 50% 20%, #1e3a8a 0%, #0f172a 70%);
      padding: 20px;
    }
    .login-card {
      background: rgba(30, 41, 59, 0.9);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 36px 32px;
      width: 100%;
      max-width: 440px;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    .login-card h1 { font-size: 1.5rem; color: #60a5fa; margin-bottom: 6px; }
    .login-card .subtitle { font-size: 0.9rem; color: var(--text-muted); margin-bottom: 24px; }
    .input-group { text-align: left; margin-bottom: 20px; }
    .input-group label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px; }
    .input-group input {
      width: 100%;
      padding: 12px 14px;
      background: #0f172a;
      border: 2px solid var(--border);
      border-radius: 10px;
      color: white;
      font-size: 1.1rem;
      outline: none;
      transition: border-color 0.2s;
    }
    .input-group input:focus { border-color: #3b82f6; }
    .btn {
      width: 100%;
      padding: 13px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: background 0.2s;
    }
    .btn:hover { background: #1d4ed8; }
    .btn:disabled { background: #475569; cursor: not-allowed; }
    .alert { padding: 12px; border-radius: 8px; font-size: 0.88rem; margin-top: 14px; display: none; }
    .alert-danger { background: rgba(239, 68, 68, 0.2); border: 1px solid var(--danger); color: #fca5a5; }

    /* VISTA IDE */
    #vistaIDE {
      flex: 1;
      display: none;
      flex-direction: column;
      height: 100%;
    }
    header.ide-header {
      background: #0f172a;
      border-bottom: 1px solid var(--border);
      padding: 8px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .ide-brand { display: flex; align-items: center; gap: 12px; }
    .ide-brand h2 { font-size: 1rem; color: #60a5fa; font-weight: 700; }
    .badge {
      background: #1e293b;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.78rem;
      color: var(--text-muted);
      border: 1px solid var(--border);
    }
    .ide-actions { display: flex; align-items: center; gap: 10px; }
    .save-status { font-size: 0.8rem; color: var(--success); display: flex; align-items: center; gap: 6px; }

    .ide-main {
      flex: 1;
      display: flex;
      height: calc(100vh - 54px);
    }
    /* Explorador lateral */
    .sidebar {
      width: 240px;
      background: #111827;
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
    }
    .sidebar-header {
      padding: 10px 14px;
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
    }
    .file-tree {
      flex: 1;
      overflow-y: auto;
      list-style: none;
      padding: 6px 0;
    }
    .file-item {
      padding: 8px 16px;
      font-size: 0.88rem;
      color: #cbd5e1;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background 0.15s;
    }
    .file-item:hover { background: #1e293b; }
    .file-item.active { background: #1e3a8a; color: white; font-weight: 600; }

    /* Área central de edición y terminal */
    .workspace-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .tabs-bar {
      background: #0f172a;
      display: flex;
      border-bottom: 1px solid var(--border);
      overflow-x: auto;
    }
    .tab {
      padding: 8px 16px;
      font-size: 0.85rem;
      background: #111827;
      color: var(--text-muted);
      cursor: pointer;
      border-right: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .tab.active { background: #1e293b; color: white; border-bottom: 2px solid #3b82f6; }

    .editor-container {
      flex: 1;
      min-height: 200px;
      position: relative;
    }

    /* Terminal inferior */
    .terminal-container {
      height: 220px;
      background: #000;
      border-top: 2px solid var(--border);
      display: flex;
      flex-direction: column;
    }
    .terminal-header {
      background: #111827;
      padding: 6px 14px;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .terminal-body {
      flex: 1;
      padding: 10px 14px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.9rem;
      color: #10b981;
      overflow-y: auto;
      white-space: pre-wrap;
    }
    .terminal-input-line {
      display: flex;
      background: #090d16;
      border-top: 1px solid #1e293b;
      padding: 6px 12px;
      gap: 8px;
    }
    .terminal-prompt { color: #60a5fa; font-family: 'JetBrains Mono', monospace; font-size: 0.9rem; }
    .terminal-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: white;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>

  <!-- ================= VISTA: LOGIN ESTUDIANTE ================= -->
  <div id="vistaLogin">
    <div class="login-card">
      <h1>UCLA • Programación I</h1>
      <p class="subtitle">Decanato de Ciencias y Tecnología • Ing. Telemática</p>

      <form id="formLogin" onsubmit="iniciarSesion(event)">
        <div class="input-group">
          <label for="cedulaInput">Cédula de Identidad:</label>
          <input type="text" id="cedulaInput" placeholder="Ej: 32808068" required autofocus autocomplete="off">
        </div>
        <button type="submit" id="btnLogin" class="btn">
          <span>🚀 Entrar a mi Entorno</span>
        </button>
      </form>

      <div id="loginAlert" class="alert alert-danger"></div>

      <div style="margin-top: 24px; font-size: 0.85rem; color: var(--text-muted);">
        ¿Eres el docente? <a href="/admin" style="color: #60a5fa; text-decoration: none;">Acceder al Panel de Control</a>
      </div>
    </div>
  </div>

  <!-- ================= VISTA: IDE ESTUDIANTE ================= -->
  <div id="vistaIDE">
    <header class="ide-header">
      <div class="ide-brand">
        <h2>UCLA Programación I</h2>
        <span class="badge" id="lblAlumnoNombre">Cargando...</span>
        <span class="badge" id="lblAlumnoSec">Sec. -</span>
      </div>

      <div class="ide-actions">
        <select id="selectProyectos" onchange="cambiarProyecto()" style="background:#1e293b; color:white; border:1px solid var(--border); padding:6px 12px; border-radius:8px; font-size:0.85rem;">
          <option value="Practica_01">Practica_01</option>
        </select>
        <button onclick="crearNuevoProyecto()" class="btn" style="width:auto; padding:6px 12px; font-size:0.82rem; background:#334155;">+ Proyecto</button>
        <span class="save-status" id="saveIndicator">✔ Guardado</span>
        <button onclick="ejecutarCodigo()" class="btn" style="width:auto; padding:6px 16px; font-size:0.85rem; background:#10b981;">▶ Ejecutar</button>
        <button onclick="entregarPractica()" class="btn" style="width:auto; padding:6px 14px; font-size:0.85rem; background:#f59e0b;">📤 Entregar</button>
      </div>
    </header>

    <div class="ide-main">
      <!-- Explorador de Archivos -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <span>Archivos</span>
          <button onclick="crearArchivo()" style="background:none; border:none; color:#60a5fa; cursor:pointer; font-size:1.1rem;">+</button>
        </div>
        <ul class="file-tree" id="listaArchivos">
          <!-- Archivos dinámicos -->
        </ul>
      </aside>

      <!-- Editor y Terminal -->
      <div class="workspace-area">
        <div class="tabs-bar" id="tabsBar">
          <div class="tab active" id="currentTabName">index.ts</div>
        </div>

        <div class="editor-container" id="editorContainer"></div>

        <div class="terminal-container">
          <div class="terminal-header">
            <span>Terminal Interactiva (TypeScript & tsx)</span>
            <button onclick="limpiarTerminal()" style="background:none; border:none; color:var(--text-muted); cursor:pointer;">Limpiar</button>
          </div>
          <div class="terminal-body" id="terminalOutput">Esperando ejecución... Escribe tu código y presiona [▶ Ejecutar].</div>
          <div class="terminal-input-line">
            <span class="terminal-prompt">$</span>
            <input type="text" id="terminalInput" class="terminal-input" placeholder="Escribe tu entrada aquí cuando el programa lo solicite..." onkeydown="manejarEntradaTerminal(event)">
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Carga de Monaco Editor de Microsoft -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.min.js"></script>
  <!-- Compilador oficial TypeScript para navegador -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/typescript/5.3.3/typescript.min.js"></script>

  <script>
    let editor = null;
    let alumnoActual = null;
    let proyectoActual = null;
    let archivosProyecto = {};
    let archivoAbierto = 'index.ts';
    let timeoutAutoGuardar = null;
    let resolverInputTerminal = null;

    // Inicializar Monaco Editor
    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }});
    require(['vs/editor/editor.main'], function() {
      editor = monaco.editor.create(document.getElementById('editorContainer'), {
        value: '// Cargando...',
        language: 'typescript',
        theme: 'vs-dark',
        automaticLayout: true,
        fontSize: 14,
        fontFamily: "'JetBrains Mono', monospace",
        minimap: { enabled: false },
        lineNumbers: 'on',
        tabSize: 2
      });

      // Atajo de guardado Ctrl+S
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        guardarArchivoActual();
      });

      // Auto-guardado al escribir
      editor.onDidChangeModelContent(() => {
        document.getElementById('saveIndicator').innerText = '💾 Guardando...';
        document.getElementById('saveIndicator').style.color = '#f59e0b';
        clearTimeout(timeoutAutoGuardar);
        timeoutAutoGuardar = setTimeout(guardarArchivoActual, 1500);
      });
    });

    async function iniciarSesion(e) {
      e.preventDefault();
      const cedula = document.getElementById('cedulaInput').value.trim();
      const alertBox = document.getElementById('loginAlert');
      const btn = document.getElementById('btnLogin');

      alertBox.style.display = 'none';
      btn.disabled = true;
      btn.innerText = 'Verificando...';

      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cedula })
        });
        const data = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'Error al conectar.');
        }

        alumnoActual = data.alumno;
        proyectoActual = data.proyecto;
        archivosProyecto = {};
        (data.archivos || []).forEach(f => archivosProyecto[f.ruta_archivo] = f.contenido);

        document.getElementById('vistaLogin').style.display = 'none';
        document.getElementById('vistaIDE').style.display = 'flex';

        document.getElementById('lblAlumnoNombre').innerText = alumnoActual.nombre;
        document.getElementById('lblAlumnoSec').innerText = 'Sec. ' + alumnoActual.seccion;

        cargarArchivosUI();
        abrirArchivo('index.ts');

      } catch (err) {
        alertBox.innerText = err.message;
        alertBox.style.display = 'block';
        btn.disabled = false;
        btn.innerText = '🚀 Entrar a mi Entorno';
      }
    }

    function cargarArchivosUI() {
      const lista = document.getElementById('listaArchivos');
      lista.innerHTML = '';
      Object.keys(archivosProyecto).forEach(ruta => {
        const li = document.createElement('li');
        li.className = 'file-item ' + (ruta === archivoAbierto ? 'active' : '');
        li.innerHTML = '📄 ' + ruta;
        li.onclick = () => abrirArchivo(ruta);
        lista.appendChild(li);
      });
    }

    function abrirArchivo(ruta) {
      if (!archivosProyecto[ruta]) return;
      archivoAbierto = ruta;
      document.getElementById('currentTabName').innerText = ruta;

      const lang = ruta.endsWith('.json') ? 'json' : 'typescript';
      const model = monaco.editor.createModel(archivosProyecto[ruta], lang);
      editor.setModel(model);

      cargarArchivosUI();
    }

    async function guardarArchivoActual() {
      if (!proyectoActual || !archivoAbierto) return;
      const contenido = editor.getValue();
      archivosProyecto[archivoAbierto] = contenido;

      try {
        await fetch('/api/proyectos/guardar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            proyecto_id: proyectoActual.id,
            ruta_archivo: archivoAbierto,
            contenido: contenido
          })
        });

        document.getElementById('saveIndicator').innerText = '✔ Guardado';
        document.getElementById('saveIndicator').style.color = '#10b981';
      } catch (e) {
        console.error(e);
      }
    }

    async function crearArchivo() {
      const nombre = prompt('Nombre del nuevo archivo (ej: funciones.ts):');
      if (!nombre) return;
      archivosProyecto[nombre] = '// ' + nombre + '\n';
      await guardarArchivoActual();
      abrirArchivo(nombre);
    }

    async function entregarPractica() {
      if (!confirm('¿Deseas enviar tu proyecto para calificación definitiva?')) return;
      await guardarArchivoActual();
      const res = await fetch('/api/proyectos/entregar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyecto_id: proyectoActual.id })
      });
      alert('¡Práctica entregada con éxito! El profesor ya puede calificarla.');
    }

    function limpiarTerminal() {
      document.getElementById('terminalOutput').innerText = '';
    }

    // Ejecutor TypeScript en el navegador
    async function ejecutarCodigo() {
      await guardarArchivoActual();
      const term = document.getElementById('terminalOutput');
      term.innerText = '⚙️ Compilando ' + archivoAbierto + ' con TypeScript...\n';

      try {
        const codigoTS = editor.getValue();
        // Compilar en memoria
        const resultadoJS = ts.transpile(codigoTS, {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.None
        });

        term.innerText += '🚀 Ejecutando programa:\n----------------------------------------\n';

        // Emulador de console.log y readline-sync
        const chalkSimulado = {
          cyan: s => s, green: s => s, red: s => s, yellow: s => s,
          bold: { blue: s => s, cyan: s => s, yellow: s => s, magenta: s => s }
        };

        const readlineSyncSimulado = {
          question: async (promptMsg) => {
            term.innerText += promptMsg + ' ';
            return await esperarEntradaUsuario();
          },
          questionInt: async (promptMsg) => {
            term.innerText += promptMsg + ' ';
            const txt = await esperarEntradaUsuario();
            return parseInt(txt) || 0;
          }
        };

        const customConsole = {
          log: (...args) => {
            term.innerText += args.join(' ') + '\n';
            term.scrollTop = term.scrollHeight;
          },
          clear: () => { term.innerText = ''; }
        };

        // Ejecutar función asíncrona segura
        const fn = new Function('readlineSync', 'chalk', 'console', `
          return (async () => {
            try {
              ${resultadoJS}
            } catch(e) {
              console.log("Error de ejecución: " + e.message);
            }
          })();
        `);

        await fn(readlineSyncSimulado, chalkSimulado, customConsole);
        term.innerText += '\n[Proceso terminado exitosamente]';

      } catch (err) {
        term.innerText += '\n❌ Error al compilar: ' + err.message;
      }
    }

    function esperarEntradaUsuario() {
      return new Promise(resolve => {
        resolverInputTerminal = resolve;
        const input = document.getElementById('terminalInput');
        input.focus();
      });
    }

    function manejarEntradaTerminal(e) {
      if (e.key === 'Enter' && resolverInputTerminal) {
        const input = document.getElementById('terminalInput');
        const valor = input.value;
        document.getElementById('terminalOutput').innerText += valor + '\n';
        input.value = '';
        const resolver = resolverInputTerminal;
        resolverInputTerminal = null;
        resolver(valor);
      }
    }
  </script>
</body>
</html>`;

// HTML del Panel del Docente / Admin
const HTMLAdmin = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Panel Docente | UCLA Programación I</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #004b87;
      --bg: #f8fafc;
      --card: #ffffff;
      --border: #e2e8f0;
      --text: #1e293b;
      --text-muted: #64748b;
      --success: #10b981;
      --danger: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); padding: 24px; }
    .container { max-width: 1100px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    h1 { font-size: 1.5rem; color: var(--primary); }
    .tabs { display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 2px solid var(--border); padding-bottom: 10px; }
    .tab-btn { padding: 10px 18px; border: none; border-radius: 8px; background: #e2e8f0; color: #334155; font-weight: 600; cursor: pointer; }
    .tab-btn.active { background: var(--primary); color: white; }
    .card { background: white; border-radius: 12px; border: 1px solid var(--border); padding: 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.03); }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 0.9rem; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid var(--border); }
    th { background: #f1f5f9; font-weight: 600; }
    .badge { padding: 4px 10px; border-radius: 20px; font-size: 0.78rem; font-weight: 600; }
    .badge-presente { background: #dcfce7; color: #15803d; }
    .badge-ausente { background: #fee2e2; color: #b91c1c; }
    .btn { padding: 10px 16px; background: var(--primary); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>Panel del Profesor • UCLA Programación I</h1>
        <p style="color:var(--text-muted); font-size:0.9rem;">Control de Asistencia y Calificaciones</p>
      </div>
      <a href="/" class="btn" style="background:#475569;">← Ir al Portal de Estudiantes</a>
    </header>

    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <label><strong>Fecha:</strong></label>
          <input type="date" id="fechaPicker" onchange="cargarAsistencia()" style="padding:8px 12px; border-radius:8px; border:1px solid var(--border);">
          <select id="seccionFiltro" onchange="cargarAsistencia()" style="padding:8px 12px; border-radius:8px; border:1px solid var(--border);">
            <option value="0">Todas las Secciones</option>
            <option value="1">Sección 1</option>
            <option value="2">Sección 2</option>
            <option value="3">Sección 3</option>
          </select>
        </div>
        <a id="btnExport" href="#" class="btn" style="background:#10b981;">📥 Exportar a Excel (CSV)</a>
      </div>

      <div style="margin-bottom:12px; font-size:0.95rem;">
        Total presentes: <strong id="lblPresentes" style="color:var(--success);">0</strong> / <span id="lblTotal">136</span>
      </div>

      <table>
        <thead>
          <tr>
            <th>Cédula</th>
            <th>Estudiante</th>
            <th>Sección</th>
            <th>Estado</th>
            <th>Hora Ingreso</th>
            <th>IP</th>
          </tr>
        </thead>
        <tbody id="tablaBody">
          <tr><td colspan="6" style="text-align:center;">Cargando lista...</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <script>
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('fechaPicker').value = hoy;

    async function cargarAsistencia() {
      const fecha = document.getElementById('fechaPicker').value;
      const sec = document.getElementById('seccionFiltro').value;
      document.getElementById('btnExport').href = '/api/admin/asistencia/export?fecha=' + fecha + '&seccion=' + sec;

      const res = await fetch('/api/admin/asistencia?fecha=' + fecha + '&seccion=' + sec);
      const data = await res.json();

      document.getElementById('lblPresentes').innerText = data.presentes;
      document.getElementById('lblTotal').innerText = data.total;

      const tbody = document.getElementById('tablaBody');
      tbody.innerHTML = (data.alumnos || []).map(a => `
        <tr>
          <td><strong>${a.cedula}</strong></td>
          <td>${a.nombre}</td>
          <td>Sec. ${a.seccion}</td>
          <td><span class="badge ${a.estado === 'PRESENTE' ? 'badge-presente' : 'badge-ausente'}">${a.estado}</span></td>
          <td>${a.hora}</td>
          <td><small style="color:#64748b;">${a.ip}</small></td>
        </tr>
      `).join('');
    }

    cargarAsistencia();
  </script>
</body>
</html>`;
