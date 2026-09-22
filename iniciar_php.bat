@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

rem PHP_BINARY permite usar uma instalacao fora do PATH.
if defined PHP_BINARY if exist "%PHP_BINARY%" goto php_found
set "PHP_BINARY="
for /f "delims=" %%P in ('where php.exe 2^>nul') do if not defined PHP_BINARY set "PHP_BINARY=%%P"
if defined PHP_BINARY goto php_found
for %%P in ("%~dp0php\php.exe" "C:\php\php.exe" "C:\xampp\php\php.exe") do if exist "%%~P" set "PHP_BINARY=%%~P"
if defined PHP_BINARY goto php_found
for /d %%D in ("C:\laragon\bin\php\*") do if exist "%%~D\php.exe" set "PHP_BINARY=%%~D\php.exe"
if defined PHP_BINARY goto php_found

echo PHP nao encontrado. Iniciando no modo local do navegador.
echo Neste modo, as notas ficam no navegador, e nao no SQLite.
echo Para usar SQLite, instale PHP com pdo_sqlite ou defina PHP_BINARY.
call "%~dp0iniciar_navegador.bat"
exit /b %errorlevel%

:php_found
"%PHP_BINARY%" -r "exit(extension_loaded('pdo_sqlite') ? 0 : 1);"
if errorlevel 1 goto sqlite_error
echo NoteKeep - PHP e SQLite
echo Acesse: http://localhost:8000
echo Mantenha esta janela aberta. Use Ctrl+C para encerrar.
"%PHP_BINARY%" -S localhost:8000 -t "%~dp0."
set "SERVER_EXIT=%errorlevel%"
if "%SERVER_EXIT%"=="0" exit /b 0
echo O servidor PHP encerrou com erro. Verifique a mensagem acima.
echo Se a porta 8000 estiver ocupada, encerre o outro servidor e tente novamente.
pause
exit /b %SERVER_EXIT%

:sqlite_error
echo O PHP encontrado nao conseguiu carregar a extensao pdo_sqlite.
echo Executavel: "%PHP_BINARY%"
echo Use php --ini para localizar o php.ini e habilite extension=pdo_sqlite.
echo Para usar o modo local, execute iniciar_navegador.bat.
pause
exit /b 1
