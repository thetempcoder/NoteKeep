@echo off
chcp 65001 > nul
echo ===================================================
echo           NoteKeep - Abrindo Aplicativo
echo ===================================================
echo.

where python >nul 2>nul
if %errorlevel% equ 0 (
    echo Iniciando servidor local ultra-rapido com Python...
    echo Acesse: http://localhost:8000
    start http://localhost:8000
    python -m http.server 8000
    exit /b
)

echo Abrindo diretamente no seu navegador padrao...
start index.html
