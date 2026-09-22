# NoteKeep

Aplicativo de anotações em português, feito com HTML, CSS e JavaScript. Funciona com armazenamento local no navegador ou com uma API PHP e banco SQLite.

## Executar no Windows

### Armazenamento no navegador

Execute `iniciar_navegador.bat` e acesse `http://localhost:8000`. O script usa Python 3, disponível como `python` ou `py -3`. Mantenha a janela do servidor aberta enquanto usa o aplicativo; encerre com Ctrl+C.

Sem Python, abra `index.html` manualmente. Alguns recursos, como voz e criptografia, dependem do suporte do navegador e podem exigir execução em localhost.

Notas e marcadores ficam no LocalStorage. Use sempre o mesmo navegador e endereço para acessar esses dados. Limpar os dados do site também remove as notas locais.

### PHP e SQLite

Execute `iniciar_php.bat` e acesse `http://localhost:8000`. É necessário PHP com a extensão `pdo_sqlite` habilitada. O banco é criado em `data/keep.db`.

O script procura PHP no PATH, em `php/php.exe` dentro do projeto e nas pastas padrão de PHP, XAMPP e Laragon no disco C. Para outra instalação, defina a variável `PHP_BINARY` com o caminho completo de `php.exe`.

Se PHP não for encontrado, o script inicia o modo local pelo iniciador Python e informa a mudança. Se faltar `pdo_sqlite`, mostra como habilitar a extensão. Erros de inicialização permanecem visíveis na janela.

Execute apenas um servidor por vez: os dois scripts usam a porta 8000. Os modos local e SQLite têm dados separados; não há migração automática entre eles.

## Recursos

- Notas de texto, listas de tarefas, cores e notas fixadas.
- Pesquisa, marcadores, arquivo e lixeira.
- Temas claro e escuro, visualizações em grade, lista e Kanban.
- Paleta de comandos com Ctrl+K e atalhos no editor com `/`.
- Imagens, entrada por voz e proteção de notas com senha.
- Assistente de IA para conversar sobre notas selecionadas, extrair texto de imagens e salvar respostas como notas.

O assistente requer uma chave do Google AI Studio, configurada na aba IA. A chave fica no LocalStorage do navegador. Ao usar esses recursos, o conteúdo necessário à solicitação é enviado à API do Google. Disponibilidade e cobrança dependem da conta e do serviço.

## Arquivos

| Arquivo | Função |
| --- | --- |
| `index.html` | Interface |
| `styles.css` | Estilos e temas |
| `app.js` | Notas, interações e persistência |
| `ai.js` | Integração com o assistente |
| `api/notes.php` | API de notas |
| `api/labels.php` | API de marcadores |
| `api/db.php` | Conexão e criação do banco |
| `iniciar_php.bat` | Inicialização com PHP |
| `iniciar_navegador.bat` | Inicialização com Python |

## Verificação

Com Node.js instalado, execute `npm ci` e `npm test`. Os testes usam um DOM simulado, sem abrir navegador, e verificam inicialização, detecção do armazenamento e interações básicas.
