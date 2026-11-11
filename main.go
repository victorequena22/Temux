package main

import (
	"encoding/csv"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"
)

var db *DB

func main() {
	port := flag.Int("port", 3000, "Puerto HTTP del servidor")
	dbPath := flag.String("db", "database/aula.db", "Ruta de la base de datos SQLite")
	flag.Parse()

	// 1. Inicializar Base de Datos SQLite
	var err error
	db, err = InitDB(*dbPath)
	if err != nil {
		log.Fatalf("[ERROR] No se pudo inicializar la base de datos: %v", err)
	}
	log.Println("[✔] Base de datos SQLite inicializada exitosamente.")

	// 2. Registrar Rutas
	mux := http.NewServeMux()

	// Páginas Web
	mux.HandleFunc("/", handleIndex)
	mux.HandleFunc("/admin", handleAdmin)

	// API Estudiantes
	mux.HandleFunc("/api/login", handleLogin)
	mux.HandleFunc("/api/proyectos", handleProyectos)
	mux.HandleFunc("/api/proyectos/guardar", handleGuardarArchivo)
	mux.HandleFunc("/api/proyectos/entregar", handleEntregarProyecto)

	// API Docente / Admin
	mux.HandleFunc("/api/admin/asistencia", handleAdminAsistencia)
	mux.HandleFunc("/api/admin/asistencia/export", handleExportarAsistenciaCSV)
	mux.HandleFunc("/api/admin/calificar", handleCalificar)
	mux.HandleFunc("/api/admin/stats", handleAdminStats)

	// Iniciar Servidor
	ip := getLocalIP()
	addr := fmt.Sprintf(":%d", *port)

	fmt.Println("====================================================")
	fmt.Println("  Servidor en Go • UCLA Programación I (INT214)")
	fmt.Println("  * Alto Rendimiento, Cero Docker, Memoria < 20 MB *")
	fmt.Println("====================================================")
	fmt.Printf("  • Portal Estudiantes: http://localhost:%d\n", *port)
	fmt.Printf("  • Acceso en Red:      http://%s:%d\n", ip, *port)
	fmt.Printf("  • Panel Docente:      http://%s:%d/admin\n", ip, *port)
	fmt.Println("====================================================")
	fmt.Println("  Listo para recibir conexiones...")

	if err := http.ListenAndServe(addr, enableCORS(mux)); err != nil {
		log.Fatalf("[ERROR] Servidor detenido: %v", err)
	}
}

// ------------------------------------------------------------------------------
// HANDLERS HTTP
// ------------------------------------------------------------------------------

func handleIndex(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(HTMLIndex))
}

func handleAdmin(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(HTMLAdmin))
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Cedula string `json:"cedula"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Cuerpo de solicitud inválido", http.StatusBadRequest)
		return
	}

	cedula := strings.TrimSpace(req.Cedula)
	alumno, err := db.ObtenerAlumno(cedula)
	if err != nil {
		jsonError(w, fmt.Sprintf("La cédula '%s' no se encuentra en las listas oficiales de Programación I (Secciones 1, 2 y 3).", cedula), http.StatusNotFound)
		return
	}

	// Registrar asistencia del día
	clientIP := r.RemoteAddr
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		clientIP = strings.Split(forwarded, ",")[0]
	}
	fecha, hora, _ := db.RegistrarAsistencia(alumno.Cedula, clientIP)

	// Obtener o inicializar su proyecto activo (Practica_01)
	proyecto, err := db.ObtenerOCrearProyecto(alumno.Cedula, "Practica_01", 1)
	if err != nil {
		jsonError(w, "Error al preparar proyecto del estudiante", http.StatusInternalServerError)
		return
	}

	archivos, _ := db.ObtenerArchivosProyecto(proyecto.ID)

	jsonResponse(w, map[string]interface{}{
		"ok":       true,
		"alumno":   alumno,
		"proyecto": proyecto,
		"archivos": archivos,
		"asistencia": map[string]string{
			"fecha": fecha,
			"hora":  hora,
		},
	})
}

func handleProyectos(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		cedula := r.URL.Query().Get("cedula")
		proyectos, err := db.ListarProyectosAlumno(cedula)
		if err != nil {
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
		jsonResponse(w, map[string]interface{}{"ok": true, "proyectos": proyectos})
		return
	}

	if r.Method == http.MethodPost {
		var req struct {
			Cedula string `json:"cedula"`
			Nombre string `json:"nombre"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, "Datos inválidos", http.StatusBadRequest)
			return
		}
		proy, err := db.ObtenerOCrearProyecto(req.Cedula, req.Nombre, 1)
		if err != nil {
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
		jsonResponse(w, map[string]interface{}{"ok": true, "proyecto": proy})
		return
	}
}

func handleGuardarArchivo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ProyectoID  int64  `json:"proyecto_id"`
		RutaArchivo string `json:"ruta_archivo"`
		Contenido   string `json:"contenido"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Datos inválidos", http.StatusBadRequest)
		return
	}

	if err := db.GuardarArchivo(req.ProyectoID, req.RutaArchivo, req.Contenido); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonResponse(w, map[string]interface{}{"ok": true, "mensaje": "Archivo guardado exitosamente"})
}

func handleEntregarProyecto(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ProyectoID int64 `json:"proyecto_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Datos inválidos", http.StatusBadRequest)
		return
	}

	if err := db.EntregarProyecto(req.ProyectoID); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonResponse(w, map[string]interface{}{"ok": true, "mensaje": "Práctica entregada con éxito"})
}

func handleAdminAsistencia(w http.ResponseWriter, r *http.Request) {
	fecha := r.URL.Query().Get("fecha")
	if fecha == "" {
		fecha = time.Now().Format("2006-01-02")
	}
	seccion, _ := strconv.Atoi(r.URL.Query().Get("seccion"))

	lista, err := db.ListarAsistencia(fecha, seccion)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	presentes := 0
	for _, a := range lista {
		if a.Estado == "PRESENTE" {
			presentes++
		}
	}

	jsonResponse(w, map[string]interface{}{
		"ok":        true,
		"fecha":     fecha,
		"total":     len(lista),
		"presentes": presentes,
		"alumnos":   lista,
	})
}

func handleExportarAsistenciaCSV(w http.ResponseWriter, r *http.Request) {
	fecha := r.URL.Query().Get("fecha")
	if fecha == "" {
		fecha = time.Now().Format("2006-01-02")
	}
	seccion, _ := strconv.Atoi(r.URL.Query().Get("seccion"))

	lista, err := db.ListarAsistencia(fecha, seccion)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"asistencia_UCLA_%s.csv\"", fecha))

	// UTF-8 BOM para que Microsoft Excel en español muestre acentos correctamente
	w.Write([]byte{0xEF, 0xBB, 0xBF})

	writer := csv.NewWriter(w)
	defer writer.Flush()

	writer.Write([]string{"Nro", "Cedula", "Apellidos y Nombres", "Seccion", "Estado", "Hora Ingreso", "IP Cliente"})

	for i, a := range lista {
		writer.Write([]string{
			strconv.Itoa(i + 1),
			a.Cedula,
			a.Nombre,
			fmt.Sprintf("Seccion %d", a.Seccion),
			a.Estado,
			a.Hora,
			a.IPCliente,
		})
	}
}

func handleCalificar(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ProyectoID   int64   `json:"proyecto_id"`
		Calificacion float64 `json:"calificacion"`
		Comentarios  string  `json:"comentarios"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Datos inválidos", http.StatusBadRequest)
		return
	}

	if err := db.CalificarProyecto(req.ProyectoID, req.Calificacion, req.Comentarios); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonResponse(w, map[string]interface{}{"ok": true, "mensaje": "Calificación registrada"})
}

func handleAdminStats(w http.ResponseWriter, r *http.Request) {
	stats := db.ObtenerEstadisticas()
	jsonResponse(w, stats)
}

// ------------------------------------------------------------------------------
// UTILIDADES
// ------------------------------------------------------------------------------

func jsonResponse(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(data)
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"ok":    false,
		"error": msg,
	})
}

func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func getLocalIP() string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return "localhost"
	}
	for _, a := range addrs {
		if ipnet, ok := a.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ipnet.IP.To4() != nil && !strings.HasPrefix(ipnet.IP.String(), "169.254.") {
				return ipnet.IP.String()
			}
		}
	}
	return "localhost"
}
