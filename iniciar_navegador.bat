@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
python --version >nul 2>nul
if not errorlevel 1 goto python_server
py -3 --version >nul 2>nul
if not errorlevel 1 goto py_server
echo Python nao encontrado. Abra o arquivo index.html no navegador.
echo As notas ficarao salvas no navegador.
pause
exit /b 1

:python_server
set "PYTHON_COMMAND=python"
goto start_server
:py_server
set "PYTHON_COMMAND=py -3"
:start_server
echo NoteKeep - armazenamento local do navegador
echo Acesse: http://localhost:8000
echo Mantenha esta janela aberta. Use Ctrl+C para encerrar.
%PYTHON_COMMAND% -m http.server 8000 --bind localhost
set "SERVER_EXIT=%errorlevel%"
if "%SERVER_EXIT%"=="0" exit /b 0
echo O servidor encerrou com erro. Verifique a mensagem acima.
echo Se a porta 8000 estiver ocupada, encerre o outro servidor e tente novamente.
pause
exit /b %SERVER_EXIT%
