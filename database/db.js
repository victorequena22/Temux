/**
 * ==============================================================================
 * Módulo de Base de Datos SQLite para UCLA - INT214 Programación I
 * Desarrollado con el motor nativo de alto rendimiento 'node:sqlite'
 * ==============================================================================
 */

const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname);
const DB_PATH = path.join(DB_DIR, 'aula.db');
const SCHEMA_PATH = path.join(DB_DIR, 'schema.sql');
const ALUMNOS_JSON = path.join(__dirname, '..', 'alumnos.json');

// Asegurar directorio
fs.mkdirSync(DB_DIR, { recursive: true });

// Inicializar conexión persistente a la base de datos
const db = new DatabaseSync(DB_PATH);

// Habilitar claves foráneas y WAL para rendimiento óptimo
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

/**
 * Inicializa el esquema y carga los 136 alumnos si la BD es nueva
 */
function inicializarBaseDeDatos() {
  const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schemaSql);

  // 1. Asegurar Secciones oficiales (1, 2 y 3)
  const stmtSec = db.prepare(`
    INSERT INTO secciones (id, codigo, total_estudiantes)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET codigo = excluded.codigo
  `);

  stmtSec.run(1, 'SECCION-1', 46);
  stmtSec.run(2, 'SECCION-2', 45);
  stmtSec.run(3, 'SECCION-3', 45);

  // 2. Importar alumnos desde alumnos.json si aún no existen
  const totalAlumnos = db.prepare('SELECT COUNT(*) as count FROM alumnos').get().count;

  if (totalAlumnos === 0 && fs.existsSync(ALUMNOS_JSON)) {
    const lista = JSON.parse(fs.readFileSync(ALUMNOS_JSON, 'utf8'));
    const stmtInsert = db.prepare(`
      INSERT INTO alumnos (cedula, apellidos_nombres, seccion_id, condicion, puerto_asignado)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(cedula) DO NOTHING
    `);

    for (const a of lista) {
      stmtInsert.run(
        String(a.cedula).trim(),
        String(a.nombre).trim(),
        Number(a.seccion),
        0, // Condición inicial
        Number(a.puerto) || null
      );
    }
    console.log(`[BD] Se importaron ${lista.length} estudiantes desde alumnos.json a SQLite.`);
  }

  // 3. Crear Plantilla Inicial ("Semana 1: Entrada y Salida con readline-sync y chalk")
  const totalPlantillas = db.prepare('SELECT COUNT(*) as count FROM plantillas').get().count;
  if (totalPlantillas === 0) {
    crearPlantillaInicial();
  }
}

/**
 * Inserta la plantilla de la Semana 1 por defecto
 */
function crearPlantillaInicial() {
  const insPlantilla = db.prepare(`
    INSERT INTO plantillas (id, titulo, descripcion, semana)
    VALUES (1, 'Semana 1: Entrada/Salida con readline-sync y chalk', 'Proyecto inicial interactivo con TypeScript y colores en consola', 1)
  `);
  insPlantilla.run();

  const insArchivo = db.prepare(`
    INSERT INTO archivos_plantilla (plantilla_id, ruta_archivo, contenido)
    VALUES (?, ?, ?)
  `);

  const packageJson = JSON.stringify({
    name: "proyecto-ucla-programacion-1",
    version: "1.0.0",
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
  }, null, 2);

  const tsconfigJson = JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      esModuleInterop: true,
      strict: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true
    }
  }, null, 2);

  const indexTs = `import readlineSync from 'readline-sync';
import chalk from 'chalk';

console.clear();
console.log(chalk.bold.blue('=============================================='));
console.log(chalk.bold.cyan('  UCLA - Decanato de Ciencias y Tecnología   '));
console.log(chalk.bold.yellow('          INT214 - PROGRAMACIÓN I            '));
console.log(chalk.bold.blue('==============================================\\n'));

// Entrada de datos por consola
const nombre = readlineSync.question(chalk.cyan('¿Cómo te llamas? '));
const edad = readlineSync.questionInt(chalk.cyan('¿Cuántos años tienes? '));

// Salida con estilos
console.log(chalk.bold.magenta(\`\\n¡Hola, \${nombre}! Tienes \${edad} años.\`));
console.log(chalk.green('Tu entorno con readline-sync y chalk está listo para usar.'));
console.log(chalk.gray('Escribe en la terminal: tsx index.ts\\n'));
`;

  insArchivo.run(1, 'package.json', packageJson);
  insArchivo.run(1, 'tsconfig.json', tsconfigJson);
  insArchivo.run(1, 'index.ts', indexTs);
}

// ------------------------------------------------------------------------------
// OPERACIONES: ALUMNOS
// ------------------------------------------------------------------------------

function obtenerAlumno(cedula) {
  const cedulaLimpia = String(cedula || '').replace(/[^0-9]/g, '');
  return db.prepare(`
    SELECT a.cedula, a.apellidos_nombres as nombre, a.seccion_id as seccion,
           a.condicion, a.puerto_asignado as puerto, s.codigo as seccion_codigo
    FROM alumnos a
    JOIN secciones s ON a.seccion_id = s.id
    WHERE a.cedula = ?
  `).get(cedulaLimpia);
}

function listarAlumnos(seccionId = 0) {
  if (seccionId > 0) {
    return db.prepare(`
      SELECT a.cedula, a.apellidos_nombres as nombre, a.seccion_id as seccion,
             a.condicion, a.puerto_asignado as puerto
      FROM alumnos a
      WHERE a.seccion_id = ?
      ORDER BY a.apellidos_nombres ASC
    `).all(seccionId);
  }
  return db.prepare(`
    SELECT a.cedula, a.apellidos_nombres as nombre, a.seccion_id as seccion,
           a.condicion, a.puerto_asignado as puerto
    FROM alumnos a
    ORDER BY a.seccion_id ASC, a.apellidos_nombres ASC
  `).all();
}

// ------------------------------------------------------------------------------
// OPERACIONES: ASISTENCIA
// ------------------------------------------------------------------------------

function registrarAsistencia(cedula, ipCliente = 'localhost') {
  const now = new Date();
  const fecha = now.toISOString().split('T')[0];
  const hora = now.toTimeString().split(' ')[0];

  const stmt = db.prepare(`
    INSERT INTO asistencias (cedula, fecha, hora, ip_cliente, estado)
    VALUES (?, ?, ?, ?, 'PRESENTE')
    ON CONFLICT(cedula, fecha) DO UPDATE SET ip_cliente = excluded.ip_cliente
  `);

  stmt.run(String(cedula), fecha, hora, ipCliente);
  return { fecha, hora };
}

function obtenerAsistenciaFecha(fecha, seccionId = 0) {
  const alumnosList = listarAlumnos(seccionId);
  const asistenciasList = db.prepare(`
    SELECT cedula, fecha, hora, ip_cliente, estado
    FROM asistencias
    WHERE fecha = ?
  `).all(fecha);

  const mapaAsistencias = new Map();
  asistenciasList.forEach(a => mapaAsistencias.set(a.cedula, a));

  const resultado = alumnosList.map(alumno => {
    const asis = mapaAsistencias.get(alumno.cedula);
    return {
      cedula: alumno.cedula,
      nombre: alumno.nombre,
      seccion: alumno.seccion,
      presente: !!asis,
      hora: asis ? asis.hora : null,
      ip: asis ? asis.ip_cliente : null,
      estado: asis ? asis.estado : 'AUSENTE'
    };
  });

  const presentesCount = resultado.filter(r => r.presente).length;

  return {
    fecha,
    total: resultado.length,
    presentesCount,
    ausentesCount: resultado.length - presentesCount,
    alumnos: resultado
  };
}

// ------------------------------------------------------------------------------
// OPERACIONES: PROYECTOS Y ARCHIVOS
// ------------------------------------------------------------------------------

/**
 * Obtiene o crea el proyecto inicial de un alumno
 */
function obtenerOCrearProyecto(cedula, nombreProyecto = 'Practica_01', plantillaId = 1) {
  let proyecto = db.prepare(`
    SELECT * FROM proyectos WHERE cedula = ? AND nombre = ?
  `).get(cedula, nombreProyecto);

  if (!proyecto) {
    const ins = db.prepare(`
      INSERT INTO proyectos (cedula, plantilla_id, nombre, descripcion)
      VALUES (?, ?, ?, ?)
    `);
    const info = ins.run(cedula, plantillaId, nombreProyecto, `Proyecto ${nombreProyecto} de ${cedula}`);
    const proyectoId = Number(info.lastInsertRowid);

    // Si viene de plantilla, copiar archivos iniciales
    if (plantillaId) {
      const archivos = db.prepare(`
        SELECT ruta_archivo, contenido FROM archivos_plantilla WHERE plantilla_id = ?
      `).all(plantillaId);

      const insArch = db.prepare(`
        INSERT INTO archivos_proyecto (proyecto_id, ruta_archivo, contenido, tamano_bytes)
        VALUES (?, ?, ?, ?)
      `);

      for (const f of archivos) {
        insArch.run(proyectoId, f.ruta_archivo, f.contenido, Buffer.byteLength(f.contenido, 'utf8'));
      }
    }

    proyecto = db.prepare('SELECT * FROM proyectos WHERE id = ?').get(proyectoId);
  }

  return proyecto;
}

function listarProyectosAlumno(cedula) {
  return db.prepare(`
    SELECT id, nombre, descripcion, entregado, fecha_entrega, calificacion,
           comentarios_profesor, created_at, updated_at
    FROM proyectos
    WHERE cedula = ?
    ORDER BY id ASC
  `).all(cedula);
}

function guardarArchivoProyecto(proyectoId, rutaArchivo, contenido) {
  const tamano = Buffer.byteLength(contenido, 'utf8');
  const stmt = db.prepare(`
    INSERT INTO archivos_proyecto (proyecto_id, ruta_archivo, contenido, tamano_bytes, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(proyecto_id, ruta_archivo) DO UPDATE SET
      contenido = excluded.contenido,
      tamano_bytes = excluded.tamano_bytes,
      updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(Number(proyectoId), rutaArchivo, contenido);

  // Actualizar updated_at del proyecto padre
  db.prepare(`UPDATE proyectos SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(Number(proyectoId));
  return { ok: true, rutaArchivo, tamano };
}

function obtenerArchivosProyecto(proyectoId) {
  return db.prepare(`
    SELECT ruta_archivo, contenido, tamano_bytes, updated_at
    FROM archivos_proyecto
    WHERE proyecto_id = ?
    ORDER BY ruta_archivo ASC
  `).all(Number(proyectoId));
}

function entregarProyecto(proyectoId) {
  db.prepare(`
    UPDATE proyectos
    SET entregado = 1, fecha_entrega = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(Number(proyectoId));
  return { ok: true, entregado: true };
}

function calificarProyecto(proyectoId, calificacion, comentarios = '') {
  db.prepare(`
    UPDATE proyectos
    SET calificacion = ?, comentarios_profesor = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(Number(calificacion), comentarios, Number(proyectoId));
  return { ok: true, proyectoId, calificacion };
}

// ------------------------------------------------------------------------------
// OPERACIONES: ESTADÍSTICAS GENERALES (PANEL PROFESOR)
// ------------------------------------------------------------------------------

function obtenerEstadisticasGenerales() {
  const totalAlumnos = db.prepare('SELECT COUNT(*) as c FROM alumnos').get().c;
  const totalProyectos = db.prepare('SELECT COUNT(*) as c FROM proyectos').get().c;
  const proyectosEntregados = db.prepare('SELECT COUNT(*) as c FROM proyectos WHERE entregado = 1').get().c;
  const fechaHoy = new Date().toISOString().split('T')[0];
  const asistenciasHoy = db.prepare('SELECT COUNT(*) as c FROM asistencias WHERE fecha = ?').get(fechaHoy).c;

  return {
    totalAlumnos,
    totalProyectos,
    proyectosEntregados,
    asistenciasHoy,
    fechaHoy
  };
}

// Inicializar automáticamente al importar el módulo
inicializarBaseDeDatos();

module.exports = {
  db,
  inicializarBaseDeDatos,
  obtenerAlumno,
  listarAlumnos,
  registrarAsistencia,
  obtenerAsistenciaFecha,
  obtenerOCrearProyecto,
  listarProyectosAlumno,
  guardarArchivoProyecto,
  obtenerArchivosProyecto,
  entregarProyecto,
  calificarProyecto,
  obtenerEstadisticasGenerales
};
