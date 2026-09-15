/**
 * ==========================================================
 * ASSISTENTE IA - INTEGRAÃ‡ÃƒO AI STUDIO
 * ==========================================================
 */

class AIService {
  constructor() {
    this.apiKeyStorageKey = 'notekeep_ai_api_key';
    this.selectedNoteIds = new Set();
    this.chatHistory = [];
    this.modelName = atob('Z2VtaW5pLTIuNS1mbGFzaA=='); // modelo do AI Studio
    this.isGenerating = false;

    this.initElements();
    this.attachEvents();
    this.updateApiKeyUI();
  }

  initElements() {
    // Modal Chave API
    this.apiKeyModal = document.getElementById('apiKeyModal');
    this.btnOpenApiKeyModal = document.getElementById('btnOpenApiKeyModal');
    this.btnCloseApiKeyModal = document.getElementById('btnCloseApiKeyModal');
    this.btnSaveApiKey = document.getElementById('btnSaveApiKey');
    this.btnClearApiKey = document.getElementById('btnClearApiKey');
    this.apiKeyInput = document.getElementById('apiKeyInput');
    this.apiKeyStatusDot = document.getElementById('apiKeyStatusDot');
    this.apiKeyBtnText = document.getElementById('apiKeyBtnText');
    this.btnToggleApiKeyVisibility = document.getElementById('btnToggleApiKeyVisibility');
    this.keyVisibilityIcon = document.getElementById('keyVisibilityIcon');

    // Contexto de Notas
    this.notesSelectorList = document.getElementById('aiNotesSelectorList');
    this.selectedCounter = document.getElementById('aiSelectedCounter');
    this.btnSelectAll = document.getElementById('btnSelectAllNotes');
    this.btnSelectPinned = document.getElementById('btnSelectPinnedNotes');
    this.btnClearSelected = document.getElementById('btnClearSelectedNotes');

    // Chat
    this.messagesArea = document.getElementById('aiMessagesArea');
    this.welcomeCard = document.getElementById('aiWelcomeCard');
    this.promptInput = document.getElementById('aiPromptInput');
    this.btnSend = document.getElementById('btnSendAiMessage');
    this.quickPrompts = document.getElementById('aiQuickPrompts');
  }

  attachEvents() {
    // Abrir e fechar modal da chave
    this.btnOpenApiKeyModal.addEventListener('click', () => this.openApiKeyModal());
    this.btnCloseApiKeyModal.addEventListener('click', () => this.closeApiKeyModal());
    this.btnSaveApiKey.addEventListener('click', () => this.saveApiKey());
    this.btnClearApiKey.addEventListener('click', () => this.clearApiKey());

    // Toggle visibilidade da senha
    this.btnToggleApiKeyVisibility.addEventListener('click', () => {
      const isPassword = this.apiKeyInput.type === 'password';
      this.apiKeyInput.type = isPassword ? 'text' : 'password';
      this.keyVisibilityIcon.textContent = isPassword ? 'visibility_off' : 'visibility';
    });

    // Fechar ao clicar fora do modal
    this.apiKeyModal.addEventListener('click', (e) => {
      if (e.target === this.apiKeyModal) this.closeApiKeyModal();
    });

    // BotÃµes de seleÃ§Ã£o de contexto
    this.btnSelectAll.addEventListener('click', () => this.selectAllNotes());
    this.btnSelectPinned.addEventListener('click', () => this.selectPinnedNotes());
    this.btnClearSelected.addEventListener('click', () => this.clearSelectedNotes());

    // Enviar mensagem
    this.btnSend.addEventListener('click', () => this.sendMessage());
    this.promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Auto-expandir input de texto
    this.promptInput.addEventListener('input', () => {
      this.promptInput.style.height = 'auto';
      this.promptInput.style.height = Math.min(this.promptInput.scrollHeight, 120) + 'px';
    });

    // Chips de prompts rÃ¡pidos
    this.quickPrompts.addEventListener('click', (e) => {
      const chip = e.target.closest('.prompt-chip');
      if (chip) {
        const promptText = chip.dataset.prompt;
        this.promptInput.value = promptText;
        this.sendMessage();
      }
    });
  }

  /* Gerenciamento da Chave da API */
  getApiKey() {
    return localStorage.getItem(this.apiKeyStorageKey) || '';
  }

  hasApiKey() {
    const key = this.getApiKey();
    return Boolean(key && key.trim().length > 10);
  }

  openApiKeyModal() {
    this.apiKeyInput.value = this.getApiKey();
    this.apiKeyModal.classList.remove('hidden');
    this.apiKeyInput.focus();
  }

  closeApiKeyModal() {
    this.apiKeyModal.classList.add('hidden');
  }

  saveApiKey() {
    const key = this.apiKeyInput.value.trim();
    if (!key) {
      alert('Por favor, digite ou cole sua chave de API do AI Studio.');
      return;
    }
    localStorage.setItem(this.apiKeyStorageKey, key);
    this.updateApiKeyUI();
    this.closeApiKeyModal();
    if (window.App && window.App.showToast) {
      window.App.showToast('Chave da API salva com sucesso!');
    }
  }

  clearApiKey() {
    localStorage.removeItem(this.apiKeyStorageKey);
    this.apiKeyInput.value = '';
    this.updateApiKeyUI();
    this.closeApiKeyModal();
    if (window.App && window.App.showToast) {
      window.App.showToast('Chave de API removida.');
    }
  }

  updateApiKeyUI() {
    if (this.hasApiKey()) {
      this.apiKeyStatusDot.classList.add('active');
      this.apiKeyBtnText.textContent = 'Chave Ativa';
    } else {
      this.apiKeyStatusDot.classList.remove('active');
      this.apiKeyBtnText.textContent = 'Configurar Chave';
    }
  }

  /* Atualizar Seletor de Notas de Contexto */
  refreshNotesSelector(notes) {
    const activeNotes = notes.filter(n => !n.is_trashed);
    this.notesSelectorList.innerHTML = '';

    if (activeNotes.length === 0) {
      this.notesSelectorList.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">
          Nenhuma nota disponÃ­vel para seleÃ§Ã£o.
        </div>
      `;
      this.updateSelectedCounter();
      return;
    }

    // Se nenhuma estiver selecionada no inÃ­cio, seleciona as notas ativas por conveniÃªncia
    if (this.selectedNoteIds.size === 0 && activeNotes.length > 0) {
      activeNotes.slice(0, 5).forEach(n => this.selectedNoteIds.add(n.id));
    }

    activeNotes.forEach(note => {
      const isSelected = this.selectedNoteIds.has(note.id);
      const itemEl = document.createElement('div');
      itemEl.className = `context-note-item ${isSelected ? 'selected' : ''}`;
      itemEl.dataset.id = note.id;

      let preview = note.content || '';
      if (note.type === 'checklist' && Array.isArray(note.checklist_items)) {
        preview = note.checklist_items.map(i => (i.completed ? 'â˜‘ ' : 'â˜ ') + i.text).join(', ');
      }

      itemEl.innerHTML = `
        <input type="checkbox" class="check-box-input" ${isSelected ? 'checked' : ''}>
        <div class="context-note-info">
          <div class="context-note-title">${this.escapeHtml(note.title || 'Sem tÃ­tulo')}</div>
          <div class="context-note-snippet">${this.escapeHtml(preview || 'Nota em branco')}</div>
        </div>
      `;

      itemEl.addEventListener('click', (e) => {
        const checkbox = itemEl.querySelector('input[type="checkbox"]');
        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
        }
        if (checkbox.checked) {
          this.selectedNoteIds.add(note.id);
          itemEl.classList.add('selected');
        } else {
          this.selectedNoteIds.delete(note.id);
          itemEl.classList.remove('selected');
        }
        this.updateSelectedCounter();
      });

      this.notesSelectorList.appendChild(itemEl);
    });

    this.updateSelectedCounter();
  }

  selectAllNotes() {
    if (!window.App) return;
    const activeNotes = window.App.notes.filter(n => !n.is_trashed);
    activeNotes.forEach(n => this.selectedNoteIds.add(n.id));
    this.refreshNotesSelector(window.App.notes);
  }

  selectPinnedNotes() {
    if (!window.App) return;
    this.selectedNoteIds.clear();
    const pinnedNotes = window.App.notes.filter(n => !n.is_trashed && n.is_pinned);
    pinnedNotes.forEach(n => this.selectedNoteIds.add(n.id));
    this.refreshNotesSelector(window.App.notes);
  }

  clearSelectedNotes() {
    this.selectedNoteIds.clear();
    if (window.App) this.refreshNotesSelector(window.App.notes);
  }

  selectSingleNote(noteId) {
    this.selectedNoteIds.clear();
    this.selectedNoteIds.add(noteId);
    if (window.App) this.refreshNotesSelector(window.App.notes);
  }

  updateSelectedCounter() {
    const count = this.selectedNoteIds.size;
    this.selectedCounter.textContent = `${count} ${count === 1 ? 'selecionada' : 'selecionadas'}`;
  }

  /* Montar contexto formatado das notas */
  buildNotesContext() {
    if (!window.App) return '';
    const selectedNotes = window.App.notes.filter(n => this.selectedNoteIds.has(n.id));

    if (selectedNotes.length === 0) return '';

    let text = "--- INÃCIO DAS NOTAS SELECIONADAS DO NOTEKEEP ---\n";
    selectedNotes.forEach((n, idx) => {
      text += `\n[NOTA ${idx + 1}]\n`;
      text += `TÃ­tulo: ${n.title || '(Sem tÃ­tulo)'}\n`;
      if (n.labels && n.labels.length > 0) {
        text += `Marcadores: ${n.labels.join(', ')}\n`;
      }
      if (n.type === 'checklist' && Array.isArray(n.checklist_items)) {
        text += `Checklist:\n`;
        n.checklist_items.forEach(item => {
          text += `  - [${item.completed ? 'X' : ' '}] ${item.text}\n`;
        });
      } else {
        text += `ConteÃºdo: ${n.content || '(Vazio)'}\n`;
      }
    });
    text += "\n--- FIM DAS NOTAS SELECIONADAS ---\n";
    return text;
  }

  /* Envio de mensagem */
  async sendMessage() {
    const userPrompt = this.promptInput.value.trim();
    if (!userPrompt || this.isGenerating) return;

    if (!this.hasApiKey()) {
      this.openApiKeyModal();
      return;
    }

    // Esconder card de boas-vindas
    if (this.welcomeCard) {
      this.welcomeCard.classList.add('hidden');
    }

    // Inserir mensagem do usuÃ¡rio na tela
    this.appendMessage('user', userPrompt);
    this.promptInput.value = '';
    this.promptInput.style.height = 'auto';

    // Preparar estado de loading do assistente
    this.isGenerating = true;
    this.btnSend.disabled = true;
    const loadingEl = this.appendLoadingMessage();

    try {
      const apiKey = this.getApiKey();
      const notesContext = this.buildNotesContext();

      // Montar conteÃºdo da requisiÃ§Ã£o para o AI Studio
      let fullPrompt = "";
      if (notesContext) {
        fullPrompt = `${notesContext}\n\nCom base nas anotaÃ§Ãµes acima fornecidas pelo usuÃ¡rio, responda Ã  seguinte solicitaÃ§Ã£o de forma clara, Ãºtil e bem estruturada:\n\n${userPrompt}`;
      } else {
        fullPrompt = `O usuÃ¡rio estÃ¡ utilizando o NoteKeep, mas nenhuma nota foi selecionada no momento.\nPergunta do usuÃ¡rio: ${userPrompt}`;
      }

      // Adicionar ao histÃ³rico de sessÃ£o
      this.chatHistory.push({
        role: "user",
        parts: [{ text: fullPrompt }]
      });

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: this.chatHistory,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          }
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      const answerText = result.candidates?.[0]?.content?.parts?.[0]?.text || "NÃ£o foi possÃ­vel obter uma resposta da IA.";

      // Adicionar resposta do modelo ao histÃ³rico
      this.chatHistory.push({
        role: "model",
        parts: [{ text: answerText }]
      });

      // Substituir loading pela resposta
      loadingEl.remove();
      this.appendMessage('assistant', answerText);

    } catch (err) {
      console.error('Erro ao consultar IA:', err);
      loadingEl.remove();
      this.appendMessage('assistant', `âš ï¸ **Erro ao consultar a IA:**\n${err.message}\n\n*Verifique se a sua chave do AI Studio estÃ¡ correta e com cota ativa.*`, true);
    } finally {
      this.isGenerating = false;
      this.btnSend.disabled = false;
      this.scrollToBottom();
    }
  }

  appendMessage(role, text, isError = false) {
    const msgEl = document.createElement('div');
    msgEl.className = `chat-msg ${role}`;

    const avatarHtml = role === 'user'
      ? `<div class="chat-avatar">D</div>`
      : `<div class="chat-avatar"><span class="material-symbols-outlined" style="font-size:18px;">auto_awesome</span></div>`;

    const formattedContent = this.formatMarkdown(text);

    let actionsHtml = '';
    if (role === 'assistant' && !isError) {
      actionsHtml = `
        <div class="chat-actions-bar">
          <button class="btn-chat-action btn-copy-response" title="Copiar resposta">
            <span class="material-symbols-outlined">content_copy</span> Copiar
          </button>
          <button class="btn-chat-action btn-save-as-note" title="Criar uma nova nota no NoteKeep com esta resposta">
            <span class="material-symbols-outlined">note_add</span> Salvar como Nota
          </button>
        </div>
      `;
    }

    msgEl.innerHTML = `
      ${avatarHtml}
      <div class="chat-bubble">
        <div class="chat-text">${formattedContent}</div>
        ${actionsHtml}
      </div>
    `;

    // Eventos dos botÃµes de aÃ§Ã£o
    if (role === 'assistant' && !isError) {
      const btnCopy = msgEl.querySelector('.btn-copy-response');
      btnCopy.addEventListener('click', () => {
        navigator.clipboard.writeText(text);
        btnCopy.innerHTML = `<span class="material-symbols-outlined">check</span> Copiado!`;
        setTimeout(() => {
          btnCopy.innerHTML = `<span class="material-symbols-outlined">content_copy</span> Copiar`;
        }, 2000);
      });

      const btnSave = msgEl.querySelector('.btn-save-as-note');
      btnSave.addEventListener('click', () => {
        if (window.App && window.App.createNoteFromAI) {
          window.App.createNoteFromAI('Resposta da IA âœ¨', text);
          btnSave.innerHTML = `<span class="material-symbols-outlined">check</span> Nota Criada!`;
          btnSave.disabled = true;
        }
      });
    }

    this.messagesArea.appendChild(msgEl);
    this.scrollToBottom();
    return msgEl;
  }

  appendLoadingMessage() {
    const msgEl = document.createElement('div');
    msgEl.className = 'chat-msg assistant';
    msgEl.innerHTML = `
      <div class="chat-avatar"><span class="material-symbols-outlined" style="font-size:18px;">auto_awesome</span></div>
      <div class="chat-bubble">
        <div style="display:flex; align-items:center; gap:8px; color: var(--text-muted); font-size: 13px;">
          <span class="material-symbols-outlined" style="animation: spin 1.2s linear infinite;">sync</span>
          Pensando e analisando suas notas...
        </div>
      </div>
    `;
    this.messagesArea.appendChild(msgEl);
    this.scrollToBottom();
    return msgEl;
  }

  scrollToBottom() {
    this.messagesArea.scrollTop = this.messagesArea.scrollHeight;
  }

  /* Formatador Markdown simples e seguro */
  formatMarkdown(text) {
    if (!text) return '';
    let html = this.escapeHtml(text);

    // Blocos de cÃ³digo ```code```
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // CÃ³digo inline `code`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Negrito **texto**
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // ItÃ¡lico *texto*
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Quebras de linha e parÃ¡grafos
    const lines = html.split('\n');
    let inList = false;
    let result = '';

    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        if (!inList) {
          result += '<ul>';
          inList = true;
        }
        result += `<li>${trimmed.substring(2)}</li>`;
      } else {
        if (inList) {
          result += '</ul>';
          inList = false;
        }
        if (trimmed.length > 0) {
          result += `<p>${line}</p>`;
        }
      }
    });

    if (inList) result += '</ul>';
    return result;
  }

  escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

// Estilo de rotaÃ§Ã£o para o Ã­cone de carregamento
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

window.AIService = AIService;

