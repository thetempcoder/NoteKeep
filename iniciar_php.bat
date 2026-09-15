@echo off
chcp 65001 > nul
echo ===================================================
echo        NoteKeep - Iniciando Servidor PHP
echo ===================================================
echo.

where php >nul 2>nul
if %errorlevel% neq 0 (
    echo [AVISO] O comando 'php' nao foi encontrado no seu PATH.
    echo.
    echo Para usar com o backend PHP e banco SQLite:
    echo 1. Baixe o PHP para Windows em: https://windows.php.net/download/
    echo 2. Ou instale via XAMPP / Laragon / winget: winget install PHP.PHP
    echo.
    echo Mas fique tranquilo! Voce pode abrir o projeto imediatamente
    echo executando o arquivo 'iniciar_navegador.bat' que utiliza
    echo o armazenamento local do seu navegador com 100%% das funcionalidades!
    echo.
    pause
    exit /b
)

echo Iniciando servidor PHP embutido na porta 8000...
echo Acesse: http://localhost:8000
echo.
start http://localhost:8000
php -S localhost:8000
