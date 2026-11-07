-- ==============================================================================
-- Esquema de Base de Datos SQLite: UCLA - INT214 PROGRAMACIÓN I
-- Decanato de Ciencias y Tecnología • Ingeniería Telemática • Lapso 2026-2
-- ==============================================================================

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------------------------
-- 1. SECCIONES ACADÉMICAS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS secciones (
    id INTEGER PRIMARY KEY,
    codigo TEXT NOT NULL UNIQUE,          -- 'SECCION-1', 'SECCION-2', 'SECCION-3'
    asignatura TEXT NOT NULL DEFAULT 'INT214 - PROGRAMACION I',
    programa TEXT NOT NULL DEFAULT 'INGENIERÍA TELEMÁTICA',
    lapso TEXT NOT NULL DEFAULT '2026-2',
    total_estudiantes INTEGER DEFAULT 0
);

-- ------------------------------------------------------------------------------
-- 2. ALUMNOS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alumnos (
    cedula TEXT PRIMARY KEY,
    apellidos_nombres TEXT NOT NULL,
    seccion_id INTEGER NOT NULL REFERENCES secciones(id) ON UPDATE CASCADE,
    condicion INTEGER DEFAULT 0,          -- Condición académica según lista UCLA (0, 1, 2, 5)
    puerto_asignado INTEGER,              -- Puerto TCP base para modo contenedor (ej: 8101..8250)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 3. ASISTENCIAS DIARIAS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asistencias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cedula TEXT NOT NULL REFERENCES alumnos(cedula) ON DELETE CASCADE,
    fecha DATE NOT NULL,                  -- Formato 'YYYY-MM-DD'
    hora TIME NOT NULL,                   -- Formato 'HH:MM:SS'
    ip_cliente TEXT,
    estado TEXT DEFAULT 'PRESENTE' CHECK (estado IN ('PRESENTE', 'TARDANZA', 'JUSTIFICADO', 'AUSENTE')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cedula, fecha)
);

-- ------------------------------------------------------------------------------
-- 4. PLANTILLAS DE PRÁCTICAS (Publicadas por el Profesor)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plantillas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,                 -- Ej: 'Práctica 1: Entrada y Salida con readline-sync'
    descripcion TEXT,
    semana INTEGER,                       -- Semana del semestre (1..16)
    seccion_id INTEGER REFERENCES secciones(id), -- NULL = Aplica a todas las secciones
    activa BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Archivos iniciales incluidos en una plantilla (ej: index.ts, package.json, tsconfig.json)
CREATE TABLE IF NOT EXISTS archivos_plantilla (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plantilla_id INTEGER NOT NULL REFERENCES plantillas(id) ON DELETE CASCADE,
    ruta_archivo TEXT NOT NULL,           -- Ej: 'index.ts', 'tsconfig.json'
    contenido TEXT NOT NULL,
    UNIQUE(plantilla_id, ruta_archivo)
);

-- ------------------------------------------------------------------------------
-- 5. PROYECTOS DE LOS ESTUDIANTES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proyectos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cedula TEXT NOT NULL REFERENCES alumnos(cedula) ON DELETE CASCADE,
    plantilla_id INTEGER REFERENCES plantillas(id) ON DELETE SET NULL,
    nombre TEXT NOT NULL,                 -- Ej: 'Practica_01', 'Calculadora_Modular'
    descripcion TEXT,
    entregado BOOLEAN DEFAULT 0,          -- 1 = Entregado para calificar
    fecha_entrega DATETIME,               -- Marca de tiempo de la entrega final
    calificacion REAL CHECK (calificacion IS NULL OR (calificacion >= 0 AND calificacion <= 20)), -- Escala UCLA (0 - 20)
    comentarios_profesor TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cedula, nombre)
);

-- ------------------------------------------------------------------------------
-- 6. ARCHIVOS DE CÓDIGO FUENTE DE LOS PROYECTOS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS archivos_proyecto (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    ruta_archivo TEXT NOT NULL,           -- Ej: 'index.ts', 'calculadora.ts', 'src/tipos.ts'
    contenido TEXT NOT NULL,
    tamano_bytes INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(proyecto_id, ruta_archivo)
);

-- ------------------------------------------------------------------------------
-- ÍNDICES PARA CONSULTAS RÁPIDAS
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_alumnos_seccion ON alumnos(seccion_id);
CREATE INDEX IF NOT EXISTS idx_asistencias_fecha ON asistencias(fecha);
CREATE INDEX IF NOT EXISTS idx_asistencias_cedula ON asistencias(cedula);
CREATE INDEX IF NOT EXISTS idx_proyectos_cedula ON proyectos(cedula);
CREATE INDEX IF NOT EXISTS idx_archivos_proyecto ON archivos_proyecto(proyecto_id);
