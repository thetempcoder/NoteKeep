# NoteKeep com Assistente de IA âœ¨

O **NoteKeep** Ã© uma aplicaÃ§Ã£o moderna de anotaÃ§Ãµes com suporte a backend em **PHP (API REST + SQLite)**, persistÃªncia adaptativa (**LocalStorage**) e uma aba inteligente integrada Ã  **API do AI Studio**.

---

## ðŸš€ Como Executar

VocÃª tem duas formas muito fÃ¡ceis de rodar o projeto no seu computador:

### OpÃ§Ã£o 1: Sem PHP instalado (ExecuÃ§Ã£o Imediata)
DÃª um duplo clique no arquivo:
```
iniciar_navegador.bat
```
* O script iniciarÃ¡ um servidor local rÃ¡pido ou abrirÃ¡ o arquivo `index.html` no seu navegador padrÃ£o.
* Todas as suas notas, checklists e configuraÃ§Ãµes ficam salvas no armazenamento local do navegador (`LocalStorage`).

### OpÃ§Ã£o 2: Com PHP e Banco SQLite
Quando vocÃª tiver o PHP instalado e no seu PATH do Windows:
```
iniciar_php.bat
```
* Isso iniciarÃ¡ o servidor PHP embutido em `http://localhost:8000`.
* As notas e marcadores serÃ£o gravados automaticamente no banco de dados SQLite em `data/keep.db`.

---

## âœ¨ Funcionalidades

### 1. Interface & Produtividade
* **Design Moderno**: Ãcones limpos, sombras dinÃ¢micas e tipografia refinada.
* **Paleta de Cores**: 11 tons pastÃ©is (Coral, PÃªssego, Areia, Menta, SÃ¡lvia, NÃ©voa, Tempestade, CrepÃºsculo, Flor, Argila e Giz).
* **Modo Escuro / Claro**: Alterne facilmente pelo botÃ£o de tema no topo direito.
* **Layout Masonry Responsivo**: Os cartÃµes se organizam de forma fluida conforme o tamanho da nota.
* **Alternador de VisualizaÃ§Ã£o**: Alterne entre modo grade (cartÃµes) e modo lista.
* **Pesquisa em Tempo Real**: Filtro instantÃ¢neo por tÃ­tulo, conteÃºdo, checklists ou tags.
* **Notas Fixadas**: SeÃ§Ã£o "FIXADAS" separada no topo com prioridade.
* **Checklists Interativos**: Adicione itens, marque como concluÃ­do com riscado e contagem.
* **Modal de EdiÃ§Ã£o Completo**: Clique em qualquer cartÃ£o para editar com salvamento automÃ¡tico ao fechar.
* **Marcadores (Etiquetas)**: Crie, renomeie e exclua tags personalizadas pelo menu lateral.
* **Lixeira e Arquivo**: Mova notas para a lixeira (com botÃ£o de Desfazer via toast) ou arquive-as.

---

### 2. Assistente de IA (AI Studio)
* **Aba Dedicada:** Acesse a aba **IA** no menu lateral ou clique no botÃ£o colorido no topo.
* **Sua Chave de API:** Clique em **"Chave da API"** e insira sua chave gratuita obtida no [AI Studio](https://aistudio.google.com/app/apikey). A chave fica salva de forma segura apenas no seu prÃ³prio navegador.
* **SeleÃ§Ã£o de Notas de Contexto:** Escolha exatamente quais notas farÃ£o parte do contexto da conversa (com atalhos: "Todas", "Fixadas", "Limpar").
* **Prompts RÃ¡pidos Inteligentes:**
  * ðŸ’¡ *Resumir notas selecionadas*
  * ðŸ“‹ *Criar plano de aÃ§Ã£o por prioridade*
  * ðŸ” *Encontrar temas e ideias conectadas*
  * âœï¸ *Redigir rascunho de e-mail baseado nas notas*
* **Salvar como Nota:** Qualquer resposta gerada pela IA pode ser convertida diretamente em uma nova nota do NoteKeep com 1 clique!

---

## ðŸ“‚ Estrutura do Projeto

```
NoteKeep/
â”œâ”€â”€ api/
â”‚   â”œâ”€â”€ db.php             # ConexÃ£o PDO com SQLite e criaÃ§Ã£o do schema
â”‚   â”œâ”€â”€ notes.php          # API RESTful (GET, POST, PUT, DELETE) para notas
â”‚   â””â”€â”€ labels.php         # API RESTful para marcadores
â”œâ”€â”€ data/
â”‚   â””â”€â”€ keep.db            # Banco de dados SQLite local (gerado automaticamente)
â”œâ”€â”€ index.html             # Interface completa do aplicativo
â”œâ”€â”€ styles.css             # Folha de estilo, temas e animaÃ§Ãµes
â”œâ”€â”€ app.js                 # LÃ³gica de notas, masonry, checklists e persistÃªncia
â”œâ”€â”€ ai.js                  # IntegraÃ§Ã£o com a IA do AI Studio
â”œâ”€â”€ iniciar_php.bat        # Launcher para servidor PHP
â”œâ”€â”€ iniciar_navegador.bat  # Launcher para navegador / Python
â””â”€â”€ README.md              # DocumentaÃ§Ã£o do projeto
```

