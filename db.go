package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

type Alumno struct {
	Cedula          string `json:"cedula"`
	Nombre          string `json:"nombre"`
	Seccion         int    `json:"seccion"`
	Condicion       int    `json:"condicion"`
	PuertoAsignado  int    `json:"puerto"`
	SeccionCodigo   string `json:"seccion_codigo,omitempty"`
}

type Asistencia struct {
	ID        int64  `json:"id"`
	Cedula    string `json:"cedula"`
	Nombre    string `json:"nombre"`
	Seccion   int    `json:"seccion"`
	Fecha     string `json:"fecha"`
	Hora      string `json:"hora"`
	IPCliente string `json:"ip"`
	Estado    string `json:"estado"`
}

type Proyecto struct {
	ID                 int64      `json:"id"`
	Cedula             string     `json:"cedula"`
	PlantillaID        *int64     `json:"plantilla_id"`
	Nombre             string     `json:"nombre"`
	Descripcion        string     `json:"descripcion"`
	Entregado          bool       `json:"entregado"`
	FechaEntrega       *time.Time `json:"fecha_entrega"`
	Calificacion       *float64   `json:"calificacion"`
	ComentariosProfesor *string   `json:"comentarios_profesor"`
	CreatedAt          string     `json:"created_at"`
	UpdatedAt          string     `json:"updated_at"`
}

type ArchivoProyecto struct {
	ID          int64  `json:"id"`
	ProyectoID  int64  `json:"proyecto_id"`
	RutaArchivo string `json:"ruta_archivo"`
	Contenido   string `json:"contenido"`
	TamanoBytes int64  `json:"tamano_bytes"`
	UpdatedAt   string `json:"updated_at"`
}

type DB struct {
	conn *sql.DB
}

func InitDB(dbPath string) (*DB, error) {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("error al crear directorio de BD: %w", err)
	}

	conn, err := sql.Open("sqlite", dbPath+"?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)")
	if err != nil {
		return nil, fmt.Errorf("error al conectar con SQLite: %w", err)
	}

	database := &DB{conn: conn}
	if err := database.runSchema(); err != nil {
		return nil, fmt.Errorf("error al ejecutar esquema: %w", err)
	}

	if err := database.seedAlumnos(); err != nil {
		return nil, fmt.Errorf("error al inicializar alumnos: %w", err)
	}

	return database, nil
}

func (d *DB) runSchema() error {
	schema := `
	PRAGMA foreign_keys = ON;

	CREATE TABLE IF NOT EXISTS secciones (
		id INTEGER PRIMARY KEY,
		codigo TEXT NOT NULL UNIQUE,
		asignatura TEXT NOT NULL DEFAULT 'INT214 - PROGRAMACION I',
		programa TEXT NOT NULL DEFAULT 'INGENIERÍA TELEMÁTICA',
		lapso TEXT NOT NULL DEFAULT '2026-2',
		total_estudiantes INTEGER DEFAULT 0
	);

	CREATE TABLE IF NOT EXISTS alumnos (
		cedula TEXT PRIMARY KEY,
		apellidos_nombres TEXT NOT NULL,
		seccion_id INTEGER NOT NULL REFERENCES secciones(id) ON UPDATE CASCADE,
		condicion INTEGER DEFAULT 0,
		puerto_asignado INTEGER,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS asistencias (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		cedula TEXT NOT NULL REFERENCES alumnos(cedula) ON DELETE CASCADE,
		fecha DATE NOT NULL,
		hora TIME NOT NULL,
		ip_cliente TEXT,
		estado TEXT DEFAULT 'PRESENTE' CHECK (estado IN ('PRESENTE', 'TARDANZA', 'JUSTIFICADO', 'AUSENTE')),
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(cedula, fecha)
	);

	CREATE TABLE IF NOT EXISTS plantillas (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		titulo TEXT NOT NULL,
		descripcion TEXT,
		semana INTEGER,
		seccion_id INTEGER REFERENCES secciones(id),
		activa BOOLEAN DEFAULT 1,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS archivos_plantilla (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		plantilla_id INTEGER NOT NULL REFERENCES plantillas(id) ON DELETE CASCADE,
		ruta_archivo TEXT NOT NULL,
		contenido TEXT NOT NULL,
		UNIQUE(plantilla_id, ruta_archivo)
	);

	CREATE TABLE IF NOT EXISTS proyectos (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		cedula TEXT NOT NULL REFERENCES alumnos(cedula) ON DELETE CASCADE,
		plantilla_id INTEGER REFERENCES plantillas(id) ON DELETE SET NULL,
		nombre TEXT NOT NULL,
		descripcion TEXT,
		entregado BOOLEAN DEFAULT 0,
		fecha_entrega DATETIME,
		calificacion REAL CHECK (calificacion IS NULL OR (calificacion >= 0 AND calificacion <= 20)),
		comentarios_profesor TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(cedula, nombre)
	);

	CREATE TABLE IF NOT EXISTS archivos_proyecto (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
		ruta_archivo TEXT NOT NULL,
		contenido TEXT NOT NULL,
		tamano_bytes INTEGER DEFAULT 0,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(proyecto_id, ruta_archivo)
	);

	CREATE INDEX IF NOT EXISTS idx_alumnos_seccion ON alumnos(seccion_id);
	CREATE INDEX IF NOT EXISTS idx_asistencias_fecha ON asistencias(fecha);
	CREATE INDEX IF NOT EXISTS idx_proyectos_cedula ON proyectos(cedula);
	CREATE INDEX IF NOT EXISTS idx_archivos_proyecto ON archivos_proyecto(proyecto_id);
	`
	_, err := d.conn.Exec(schema)
	return err
}

func (d *DB) seedAlumnos() error {
	// Secciones
	secciones := []struct {
		id    int
		code  string
		total int
	}{
		{1, "SECCION-1", 46},
		{2, "SECCION-2", 45},
		{3, "SECCION-3", 45},
	}

	for _, s := range secciones {
		_, err := d.conn.Exec(`
			INSERT INTO secciones (id, codigo, total_estudiantes)
			VALUES (?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET codigo = excluded.codigo
		`, s.id, s.code, s.total)
		if err != nil {
			return err
		}
	}

	// Comprobar si ya hay alumnos
	var count int
	err := d.conn.QueryRow("SELECT COUNT(*) FROM alumnos").Scan(&count)
	if err == nil && count > 0 {
		return nil
	}

	// Leer alumnos.json si existe
	raw, err := os.ReadFile("alumnos.json")
	if err != nil {
		return nil
	}

	var jsonAlumnos []struct {
		Cedula  string `json:"cedula"`
		Nombre  string `json:"nombre"`
		Seccion int    `json:"seccion"`
		Puerto  int    `json:"puerto"`
	}

	if err := json.Unmarshal(raw, &jsonAlumnos); err != nil {
		return err
	}

	tx, err := d.conn.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`
		INSERT INTO alumnos (cedula, apellidos_nombres, seccion_id, condicion, puerto_asignado)
		VALUES (?, ?, ?, 0, ?)
		ON CONFLICT(cedula) DO NOTHING
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, a := range jsonAlumnos {
		_, _ = stmt.Exec(strings.TrimSpace(a.Cedula), strings.TrimSpace(a.Nombre), a.Seccion, a.Puerto)
	}

	// Plantilla inicial
	tx.Exec(`
		INSERT OR IGNORE INTO plantillas (id, titulo, descripcion, semana)
		VALUES (1, 'Semana 1: Entrada/Salida con readline-sync y chalk', 'Proyecto inicial interactivo con TypeScript y colores en consola', 1)
	`)

	packageJSON := `{
  "name": "proyecto-ucla-programacion-1",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "tsx index.ts",
    "dev": "tsx watch index.ts"
  },
  "dependencies": {
    "chalk": "^5.3.0",
    "readline-sync": "^1.4.10"
  },
  "devDependencies": {
    "@types/chalk": "^2.2.4",
    "@types/node": "^20.0.0",
    "@types/readline-sync": "^1.4.8",
    "typescript": "^5.0.0",
    "tsx": "^4.0.0"
  }
}`

	tsconfigJSON := `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}`

	indexTS := `import readlineSync from 'readline-sync';
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
`

	tx.Exec(`INSERT OR IGNORE INTO archivos_plantilla (plantilla_id, ruta_archivo, contenido) VALUES (1, 'package.json', ?)`, packageJSON)
	tx.Exec(`INSERT OR IGNORE INTO archivos_plantilla (plantilla_id, ruta_archivo, contenido) VALUES (1, 'tsconfig.json', ?)`, tsconfigJSON)
	tx.Exec(`INSERT OR IGNORE INTO archivos_plantilla (plantilla_id, ruta_archivo, contenido) VALUES (1, 'index.ts', ?)`, indexTS)

	return tx.Commit()
}

// ------------------------------------------------------------------------------
// MÉTODOS DE CONSULTA
// ------------------------------------------------------------------------------

func (d *DB) ObtenerAlumno(cedula string) (*Alumno, error) {
	c := strings.TrimSpace(cedula)
	var a Alumno
	err := d.conn.QueryRow(`
		SELECT a.cedula, a.apellidos_nombres, a.seccion_id, a.condicion, COALESCE(a.puerto_asignado, 0), s.codigo
		FROM alumnos a
		JOIN secciones s ON a.seccion_id = s.id
		WHERE a.cedula = ?
	`, c).Scan(&a.Cedula, &a.Nombre, &a.Seccion, &a.Condicion, &a.PuertoAsignado, &a.SeccionCodigo)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (d *DB) RegistrarAsistencia(cedula, ip string) (string, string, error) {
	now := time.Now()
	fecha := now.Format("2006-01-02")
	hora := now.Format("15:04:05")

	_, err := d.conn.Exec(`
		INSERT INTO asistencias (cedula, fecha, hora, ip_cliente, estado)
		VALUES (?, ?, ?, ?, 'PRESENTE')
		ON CONFLICT(cedula, fecha) DO UPDATE SET ip_cliente = excluded.ip_cliente
	`, cedula, fecha, hora, ip)

	return fecha, hora, err
}

func (d *DB) ListarAsistencia(fecha string, seccion int) ([]Asistencia, error) {
	query := `
		SELECT a.cedula, a.apellidos_nombres, a.seccion_id,
		       COALESCE(asis.fecha, ?),
		       COALESCE(asis.hora, '-'),
		       COALESCE(asis.ip_cliente, '-'),
		       COALESCE(asis.estado, 'AUSENTE')
		FROM alumnos a
		LEFT JOIN asistencias asis ON a.cedula = asis.cedula AND asis.fecha = ?
	`
	var rows *sql.Rows
	var err error

	if seccion > 0 {
		query += " WHERE a.seccion_id = ? ORDER BY a.apellidos_nombres ASC"
		rows, err = d.conn.Query(query, fecha, fecha, seccion)
	} else {
		query += " ORDER BY a.seccion_id ASC, a.apellidos_nombres ASC"
		rows, err = d.conn.Query(query, fecha, fecha)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var lista []Asistencia
	for rows.Next() {
		var item Asistencia
		if err := rows.Scan(&item.Cedula, &item.Nombre, &item.Seccion, &item.Fecha, &item.Hora, &item.IPCliente, &item.Estado); err == nil {
			lista = append(lista, item)
		}
	}
	return lista, nil
}

func (d *DB) ObtenerOCrearProyecto(cedula, nombreProyecto string, plantillaID int64) (*Proyecto, error) {
	var p Proyecto
	err := d.conn.QueryRow(`
		SELECT id, cedula, plantilla_id, nombre, descripcion, entregado, fecha_entrega, calificacion, comentarios_profesor, created_at, updated_at
		FROM proyectos
		WHERE cedula = ? AND nombre = ?
	`, cedula, nombreProyecto).Scan(&p.ID, &p.Cedula, &p.PlantillaID, &p.Nombre, &p.Descripcion, &p.Entregado, &p.FechaEntrega, &p.Calificacion, &p.ComentariosProfesor, &p.CreatedAt, &p.UpdatedAt)

	if err == nil {
		return &p, nil
	}

	// Crear nuevo proyecto
	res, err := d.conn.Exec(`
		INSERT INTO proyectos (cedula, plantilla_id, nombre, descripcion)
		VALUES (?, ?, ?, ?)
	`, cedula, plantillaID, nombreProyecto, "Proyecto "+nombreProyecto)
	if err != nil {
		return nil, err
	}

	id, _ := res.LastInsertId()
	p.ID = id
	p.Cedula = cedula
	p.Nombre = nombreProyecto
	p.Descripcion = "Proyecto " + nombreProyecto

	// Copiar archivos de la plantilla
	rows, err := d.conn.Query("SELECT ruta_archivo, contenido FROM archivos_plantilla WHERE plantilla_id = ?", plantillaID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var ruta, contenido string
			if err := rows.Scan(&ruta, &contenido); err == nil {
				d.GuardarArchivo(p.ID, ruta, contenido)
			}
		}
	}

	return &p, nil
}

func (d *DB) ListarProyectosAlumno(cedula string) ([]Proyecto, error) {
	rows, err := d.conn.Query(`
		SELECT id, cedula, plantilla_id, nombre, descripcion, entregado, fecha_entrega, calificacion, comentarios_profesor, created_at, updated_at
		FROM proyectos
		WHERE cedula = ?
		ORDER BY id ASC
	`, cedula)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var lista []Proyecto
	for rows.Next() {
		var p Proyecto
		if err := rows.Scan(&p.ID, &p.Cedula, &p.PlantillaID, &p.Nombre, &p.Descripcion, &p.Entregado, &p.FechaEntrega, &p.Calificacion, &p.ComentariosProfesor, &p.CreatedAt, &p.UpdatedAt); err == nil {
			lista = append(lista, p)
		}
	}
	return lista, nil
}

func (d *DB) GuardarArchivo(proyectoID int64, rutaArchivo, contenido string) error {
	tamano := int64(len(contenido))
	_, err := d.conn.Exec(`
		INSERT INTO archivos_proyecto (proyecto_id, ruta_archivo, contenido, tamano_bytes, updated_at)
		VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(proyecto_id, ruta_archivo) DO UPDATE SET
			contenido = excluded.contenido,
			tamano_bytes = excluded.tamano_bytes,
			updated_at = CURRENT_TIMESTAMP
	`, proyectoID, rutaArchivo, contenido, tamano)

	if err == nil {
		d.conn.Exec("UPDATE proyectos SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", proyectoID)
	}
	return err
}

func (d *DB) ObtenerArchivosProyecto(proyectoID int64) ([]ArchivoProyecto, error) {
	rows, err := d.conn.Query(`
		SELECT id, proyecto_id, ruta_archivo, contenido, tamano_bytes, updated_at
		FROM archivos_proyecto
		WHERE proyecto_id = ?
		ORDER BY ruta_archivo ASC
	`, proyectoID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var lista []ArchivoProyecto
	for rows.Next() {
		var a ArchivoProyecto
		if err := rows.Scan(&a.ID, &a.ProyectoID, &a.RutaArchivo, &a.Contenido, &a.TamanoBytes, &a.UpdatedAt); err == nil {
			lista = append(lista, a)
		}
	}
	return lista, nil
}

func (d *DB) EntregarProyecto(proyectoID int64) error {
	_, err := d.conn.Exec(`
		UPDATE proyectos
		SET entregado = 1, fecha_entrega = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, proyectoID)
	return err
}

func (d *DB) CalificarProyecto(proyectoID int64, calificacion float64, comentarios string) error {
	_, err := d.conn.Exec(`
		UPDATE proyectos
		SET calificacion = ?, comentarios_profesor = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, calificacion, comentarios, proyectoID)
	return err
}

func (d *DB) ObtenerEstadisticas() map[string]interface{} {
	stats := make(map[string]interface{})
	var totalAlumnos, totalProyectos, entregados, asistenciasHoy int
	fechaHoy := time.Now().Format("2006-01-02")

	_ = d.conn.QueryRow("SELECT COUNT(*) FROM alumnos").Scan(&totalAlumnos)
	_ = d.conn.QueryRow("SELECT COUNT(*) FROM proyectos").Scan(&totalProyectos)
	_ = d.conn.QueryRow("SELECT COUNT(*) FROM proyectos WHERE entregado = 1").Scan(&entregados)
	_ = d.conn.QueryRow("SELECT COUNT(*) FROM asistencias WHERE fecha = ?", fechaHoy).Scan(&asistenciasHoy)

	stats["total_alumnos"] = totalAlumnos
	stats["total_proyectos"] = totalProyectos
	stats["proyectos_entregados"] = entregados
	stats["asistencias_hoy"] = asistenciasHoy
	stats["fecha_hoy"] = fechaHoy

	return stats
}
