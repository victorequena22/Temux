# ==============================================================================
# Lanzador de PowerShell: Portal de Alumnos - UCLA
# ==============================================================================

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  Iniciando Portal de Alumnos - UCLA" -ForegroundColor Yellow
Write-Host "  INT214 - Programacion I (Lapso 2026-2)" -ForegroundColor Cyan
Write-Host "====================================================`n" -ForegroundColor Cyan

# 1. Verificar si Docker esta activo
try {
    $null = docker info 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Docker no se esta ejecutando." -ForegroundColor Red
        Write-Host "Por favor abre Docker Desktop y espera a que este listo.`n" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "[ERROR] Docker no se detecto en el sistema." -ForegroundColor Red
    exit 1
}

# 2. Verificar imagen base
$null = docker image inspect temux-code-server:alpine 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[*] Construyendo imagen Docker temux-code-server:alpine por primera vez..." -ForegroundColor Cyan
    docker build -t temux-code-server:alpine .
}

# 3. Iniciar el servidor web
Write-Host "[*] Iniciando el portal web con creacion dinamica...`n" -ForegroundColor Green
node portal.js
