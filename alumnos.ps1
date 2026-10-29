# ==============================================================================
# Script de Gestión de Aulas Virtuales para Windows PowerShell
# code-server para Alumnos en Docker
# ==============================================================================

param (
    [Parameter(Position=0)]
    [string]$Accion = "ayuda",

    [Parameter(Position=1)]
    [string]$Parametro = ""
)

$ComposeFile = "docker-compose.alumnos.yml"
$CredsFile   = "credenciales_alumnos.txt"
$CredsCsv    = "credenciales_alumnos.csv"
$BasePort    = 8080
$AlumnosDir  = "./alumnos"

function Obtener-IPLocal {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 2>$null | 
           Where-Object { 
               $_.IPAddress -notlike "127.*" -and 
               $_.IPAddress -notlike "169.254.*" -and
               $_.InterfaceAlias -notlike "*vEthernet*" -and
               $_.InterfaceAlias -notlike "*Loopback*"
           } | 
           Select-Object -ExpandProperty IPAddress -First 1)
    if (-not $ip) { $ip = "localhost" }
    return $ip
}

function Mostrar-Ayuda {
    Write-Host "====================================================" -ForegroundColor Cyan
    Write-Host "  Gestor de Entornos code-server para Alumnos" -ForegroundColor Yellow
    Write-Host "====================================================" -ForegroundColor Cyan
    Write-Host "Comandos disponibles:"
    Write-Host "  .\alumnos.ps1 crear 15                 - Crea instancias para 15 alumnos" -ForegroundColor Green
    Write-Host "  .\alumnos.ps1 crear alumnos.txt        - Crea instancias desde un archivo de texto" -ForegroundColor Green
    Write-Host "  .\alumnos.ps1 iniciar                  - Enciende todas las instancias de la clase" -ForegroundColor Green
    Write-Host "  .\alumnos.ps1 detener                  - Apaga todas las instancias" -ForegroundColor Green
    Write-Host "  .\alumnos.ps1 reiniciar                - Reinicia las instancias" -ForegroundColor Green
    Write-Host "  .\alumnos.ps1 estado                   - Muestra el estado de cada contenedor" -ForegroundColor Green
    Write-Host "  .\alumnos.ps1 credenciales             - Muestra las URLs y contraseñas de acceso" -ForegroundColor Green
    Write-Host "  .\alumnos.ps1 limpiar                  - Elimina contenedores (conserva tareas)" -ForegroundColor Red
    Write-Host "====================================================`n" -ForegroundColor Cyan
}

switch ($Accion.ToLower()) {
    "crear" {
        if (-not $Parametro) {
            Write-Host "[ERROR] Debes especificar la cantidad de alumnos o la ruta a un archivo de texto." -ForegroundColor Red
            Write-Host "Ejemplo: .\alumnos.ps1 crear 20"
            exit 1
        }

        Write-Host "[*] Construyendo imagen temux-code-server:alpine si es necesario..." -ForegroundColor Cyan
        docker build -t temux-code-server:alpine .

        $listaAlumnos = @()

        if (Test-Path $Parametro) {
            Write-Host "[*] Leyendo lista de alumnos desde: $Parametro" -ForegroundColor Cyan
            $lineas = Get-Content $Parametro
            foreach ($linea in $lineas) {
                $limpio = $linea.Trim()
                if ($limpio) { $listaAlumnos += $limpio }
            }
        } elseif ($Parametro -match "^\d+$") {
            $num = [int]$Parametro
            Write-Host "[*] Generando aula para $num alumnos..." -ForegroundColor Cyan
            for ($i = 1; $i -le $num; $i++) {
                $listaAlumnos += ("alumno_{0:D2}" -f $i)
            }
        } else {
            Write-Host "[ERROR] El parametro debe ser un numero o un archivo de texto valido." -ForegroundColor Red
            exit 1
        }

        $total = $listaAlumnos.Count
        if ($total -eq 0) {
            Write-Host "[ERROR] No se encontraron alumnos para registrar." -ForegroundColor Red
            exit 1
        }

        $ipServidor = Obtener-IPLocal
        New-Item -ItemType Directory -Force -Path $AlumnosDir | Out-Null

        $composeContent = "# Archivo autogenerado para gestion de clases`nservices:`n"
        $credsText = "================================================================================`n"
        $credsText += "                 LISTA DE ACCESO A CODE-SERVER PARA ALUMNOS                     `n"
        $credsText += "================================================================================`n"
        $credsText += ("{0,-18} | {1,-32} | {2,-12} | {3,-6}`n" -f "ALUMNO", "URL DE ACCESO", "PASSWORD", "PUERTO")
        $credsText += "-------------------+----------------------------------+--------------+--------`n"

        $credsCsv = "Alumno,URL,Password,Puerto,Carpeta_Host`n"

        $idx = 1
        foreach ($alumno in $listaAlumnos) {
            $idSeguro = ($alumno.ToLower() -replace '[^a-z0-9]', '_')
            if (-not $idSeguro) { $idSeguro = "alumno_$idx" }

            $puerto = $BasePort + $idx
            $pass = ("clase-{0:D2}" -f $idx)
            $dirAlumno = "$AlumnosDir/$idSeguro"
            New-Item -ItemType Directory -Force -Path "$dirAlumno/project" | Out-Null
            New-Item -ItemType Directory -Force -Path "$dirAlumno/config" | Out-Null

            $composeContent += "  " + $idSeguro + ":`n"
            $composeContent += "    image: temux-code-server:alpine`n"
            $composeContent += "    container_name: cs_" + $idSeguro + "`n"
            $composeContent += "    restart: unless-stopped`n"
            $composeContent += "    ports:`n"
            $composeContent += "      - `"$puerto:8080`"`n"
            $composeContent += "    environment:`n"
            $composeContent += "      - PORT=8080`n"
            $composeContent += "      - AUTH=password`n"
            $composeContent += "      - PASSWORD=$pass`n"
            $composeContent += "    volumes:`n"
            $composeContent += "      - $dirAlumno/project:/home/coder/project`n"
            $composeContent += "      - $dirAlumno/config:/home/coder/.config`n"
            $composeContent += "    working_dir: /home/coder/project`n"
            $composeContent += "    deploy:`n"
            $composeContent += "      resources:`n"
            $composeContent += "        limits:`n"
            $composeContent += "          cpus: '0.75'`n"
            $composeContent += "          memory: 512M`n`n"

            $url = "http://$($ipServidor):$puerto"
            $credsText += ("{0,-18} | {1,-32} | {2,-12} | {3,-6}`n" -f $alumno, $url, $pass, $puerto)
            $credsCsv += ("`"{0}`",`"{1}`",`"{2}`",{3},`"{4}`"`n" -f $alumno, $url, $pass, $puerto, $dirAlumno)
            $idx++
        }

        Set-Content -Path $ComposeFile -Value $composeContent -Encoding UTF8
        Set-Content -Path $CredsFile -Value $credsText -Encoding UTF8
        Set-Content -Path $CredsCsv -Value $credsCsv -Encoding UTF8

        Write-Host "====================================================" -ForegroundColor Green
        Write-Host "  ¡Aula virtual configurada para $total alumnos!    " -ForegroundColor Green
        Write-Host "====================================================" -ForegroundColor Green
        Write-Host "Archivos generados:"
        Write-Host "  • Orquestador Docker:     $ComposeFile" -ForegroundColor Cyan
        Write-Host "  • Lista de Credenciales:  $CredsFile" -ForegroundColor Yellow
        Write-Host "  • Archivo para Excel:     $CredsCsv" -ForegroundColor Yellow
        Write-Host "  • Carpetas de alumnos:    $AlumnosDir/<alumno>/project" -ForegroundColor Cyan
        Write-Host "`nPara iniciar los contenedores de todos los alumnos ejecuta:" -ForegroundColor White
        Write-Host "  -> .\alumnos.ps1 iniciar`n" -ForegroundColor Green

        Get-Content $CredsFile
    }

    "iniciar" {
        if (-not (Test-Path $ComposeFile)) {
            Write-Host "[ERROR] No existe '$ComposeFile'. Primero genera las instancias con: .\alumnos.ps1 crear <numero>" -ForegroundColor Red
            exit 1
        }
        Write-Host "[*] Iniciando instancias de alumnos..." -ForegroundColor Cyan
        docker compose -f $ComposeFile up -d
        Write-Host "`n[OK] ¡Todas las instancias están activas!" -ForegroundColor Green
        Write-Host "Los alumnos ya pueden conectarse desde sus navegadores."
    }

    "detener" {
        if (-not (Test-Path $ComposeFile)) {
            Write-Host "[ERROR] No existe '$ComposeFile'." -ForegroundColor Red
            exit 1
        }
        Write-Host "[*] Deteniendo instancias de alumnos..." -ForegroundColor Yellow
        docker compose -f $ComposeFile stop
        Write-Host "[OK] Instancias detenidas." -ForegroundColor Green
    }

    "reiniciar" {
        if (-not (Test-Path $ComposeFile)) {
            Write-Host "[ERROR] No existe '$ComposeFile'." -ForegroundColor Red
            exit 1
        }
        docker compose -f $ComposeFile restart
        Write-Host "[OK] Instancias reiniciadas." -ForegroundColor Green
    }

    "estado" {
        if (-not (Test-Path $ComposeFile)) {
            Write-Host "[ERROR] No existe '$ComposeFile'." -ForegroundColor Red
            exit 1
        }
        docker compose -f $ComposeFile ps
    }

    "credenciales" {
        if (Test-Path $CredsFile) {
            Get-Content $CredsFile
        } else {
            Write-Host "[AVISO] Aun no se ha generado la lista. Usa primero: .\alumnos.ps1 crear <numero>" -ForegroundColor Yellow
            Write-Host "O si prefieres el portal bajo demanda con las cedulas de tus 136 alumnos:" -ForegroundColor Cyan
            Write-Host "Ejecuta: .\iniciar-portal.bat" -ForegroundColor Green
        }
    }

    "limpiar" {
        if (Test-Path $ComposeFile) {
            docker compose -f $ComposeFile down
            Write-Host "[OK] Contenedores eliminados. Las carpetas de tareas en '$AlumnosDir' siguen intactas." -ForegroundColor Green
        }
    }

    Default {
        Mostrar-Ayuda
    }
}
