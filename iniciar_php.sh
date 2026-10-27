#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

# PHP_BINARY permite usar uma instalacao fora do PATH.
if [ -n "${PHP_BINARY:-}" ] && [ -x "$PHP_BINARY" ]; then
    :
elif command -v php >/dev/null 2>&1; then
    PHP_BINARY="$(command -v php)"
else
    PHP_BINARY=""
    for candidate in "$SCRIPT_DIR/php/php" "/usr/bin/php" "/usr/local/bin/php" "/opt/lampp/bin/php"; do
        if [ -x "$candidate" ]; then
            PHP_BINARY="$candidate"
            break
        fi
    done
fi

if [ -z "$PHP_BINARY" ]; then
    echo "PHP nao encontrado. Iniciando no modo local do navegador."
    echo "Neste modo, as notas ficam no navegador, e nao no SQLite."
    echo "Para usar SQLite, instale PHP com pdo_sqlite (ex.: sudo apt install php-cli php-sqlite3) ou defina PHP_BINARY."
    exec "$SCRIPT_DIR/iniciar_navegador.sh"
fi

if ! "$PHP_BINARY" -r "exit(extension_loaded('pdo_sqlite') ? 0 : 1);"; then
    echo "O PHP encontrado nao conseguiu carregar a extensao pdo_sqlite."
    echo "Executavel: $PHP_BINARY"
    echo "No Linux (Debian/Ubuntu), instale a extensao com: sudo apt install php-sqlite3"
    echo "Ou use php --ini para localizar o php.ini e habilite extension=pdo_sqlite."
    echo "Para usar o modo local, execute ./iniciar_navegador.sh."
    exit 1
fi

HOST="${HOST:-localhost}"
PORT="${PORT:-8000}"

echo "NoteKeep - PHP e SQLite"
echo "Acesse: http://${HOST}:${PORT}"
echo "Mantenha este terminal aberto. Use Ctrl+C para encerrar."

if command -v xdg-open >/dev/null 2>&1 && [ "${OPEN_BROWSER:-1}" != "0" ]; then
    (sleep 1 && xdg-open "http://localhost:${PORT}" >/dev/null 2>&1) &
fi

"$PHP_BINARY" -S "${HOST}:${PORT}" -t "$SCRIPT_DIR"
SERVER_EXIT=$?
if [ "$SERVER_EXIT" -eq 0 ] || [ "$SERVER_EXIT" -eq 130 ]; then
    exit 0
fi

echo "O servidor PHP encerrou com erro. Verifique a mensagem acima."
echo "Se a porta ${PORT} estiver ocupada, encerre o outro servidor e tente novamente."
exit "$SERVER_EXIT"
