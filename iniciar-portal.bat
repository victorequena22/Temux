@echo off
title Portal de Aulas Virtuales - Programacion I (UCLA)
color 0b

echo ====================================================
echo   Iniciando Portal de Alumnos - UCLA
echo   INT214 - Programacion I (Lapso 2026-2)
echo ====================================================
echo.

REM Verificar si Docker esta corriendo
docker info >nul 2>&1
if %errorlevel% neq 0 (
    color 0c
    echo [ERROR] Docker no se esta ejecutando.
    echo Por favor inicia Docker Desktop y vuelve a ejecutar este script.
    echo.
    pause
    exit /b 1
)

REM Construir imagen base si no existe
echo [*] Verificando imagen Docker temux-code-server:alpine...
docker image inspect temux-code-server:alpine >nul 2>&1
if %errorlevel% neq 0 (
    echo [*] Construyendo imagen por primera vez...
    docker build -t temux-code-server:alpine .
)

echo [*] Iniciando el portal web...
echo.
node portal.js
pause
