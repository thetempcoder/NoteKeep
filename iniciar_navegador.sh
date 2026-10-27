#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

if command -v python3 >/dev/null 2>&1; then
    PYTHON_COMMAND="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON_COMMAND="python"
else
    echo "Python nao encontrado. Abra o arquivo index.html no navegador."
    echo "As notas ficarao salvas no navegador."
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$SCRIPT_DIR/index.html" >/dev/null 2>&1 &
    fi
    exit 1
fi

HOST="${HOST:-localhost}"
PORT="${PORT:-8000}"

echo "NoteKeep - armazenamento local do navegador"
echo "Acesse: http://${HOST}:${PORT}"
echo "Mantenha este terminal aberto. Use Ctrl+C para encerrar."

if command -v xdg-open >/dev/null 2>&1 && [ "${OPEN_BROWSER:-1}" != "0" ]; then
    (sleep 1 && xdg-open "http://localhost:${PORT}" >/dev/null 2>&1) &
fi

"$PYTHON_COMMAND" -m http.server "$PORT" --bind "$HOST"
SERVER_EXIT=$?
if [ "$SERVER_EXIT" -eq 0 ] || [ "$SERVER_EXIT" -eq 130 ]; then
    exit 0
fi

echo "O servidor encerrou com erro. Verifique a mensagem acima."
echo "Se a porta ${PORT} estiver ocupada, encerre o outro servidor e tente novamente."
exit "$SERVER_EXIT"
