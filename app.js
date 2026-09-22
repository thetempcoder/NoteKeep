/**
 * ==========================================================
 * NOTEKEEP - CORE APPLICATION ENGINE
 * ==========================================================
 */

const KEEP_COLORS = [
  { id: 'default', name: 'Padrão', light: '#ffffff', dark: '#202124' },
  { id: 'coral',   name: 'Coral',   light: '#faafa8', dark: '#77172e' },
  { id: 'peach',   name: 'Pêssego', light: '#f39f76', dark: '#692b17' },
  { id: 'sand',    name: 'Areia',   light: '#fff8b8', dark: '#7c4a03' },
  { id: 'mint',    name: 'Menta',   light: '#e2f6d3', dark: '#264d3b' },
  { id: 'sage',    name: 'Sálvia',  light: '#b4ddd3', dark: '#0c625d' },
  { id: 'fog',     name: 'Névoa',   light: '#d4e4ed', dark: '#256377' },
  { id: 'storm',   name: 'Tempestade', light: '#aeccdc', dark: '#284255' },
  { id: 'dusk',    name: 'Crepúsculo', light: '#d3bfdb', dark: '#472e5b' },
  { id: 'blossom', name: 'Flor',    light: '#f6e2dd', dark: '#6c394f' },
  { id: 'clay',    name: 'Argila',  light: '#e9e3d4', dark: '#4b443a' },
  { id: 'chalk',   name: 'Giz',     light: '#efeff1', dark: '#2d2f31' }
];

class StorageAdapter {
  constructor() {
    this.backendMode = 'detecting'; // 'api' ou 'local'
    this.localStorageKey = 'notekeep_notes';
    this.labelsStorageKey = 'notekeep_labels';
  }

  async init() {
    try {
      const res = await fetch('api/notes.php', {
        method: 'GET', cache: 'no-store', signal: AbortSignal.timeout(5000)
      });
      // Servidores estáticos também retornam 200 para o código-fonte PHP.
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json') && Array.isArray(await res.json())) {
        this.backendMode = 'api';
        console.log('Conectado ao Backend PHP com SQLite');
      } else {
        throw new Error('API indisponível');
      }
    } catch (e) {
      this.backendMode = 'local';
      console.log('Utilizando Armazenamento Local (Navegador)');
    }
  }

  async getNotes() {
    if (this.backendMode === 'api') {
      try {
        const res = await fetch('api/notes.php');
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn('Fallback para LocalStorage devido a falha de conexão na API');
      }
    }

    const data = localStorage.getItem(this.localStorageKey);
    return data ? JSON.parse(data) : this.getDefaultSeedNotes();
  }

  async saveNote(note) {
    if (this.backendMode === 'api') {
      try {
        const existing = await fetch(`api/notes.php?id=${note.id}`);
        if (existing.ok) {
          const res = await fetch(`api/notes.php?id=${note.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(note)
          });
          if (res.ok) return await res.json();
        } else {
          const res = await fetch('api/notes.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(note)
          });
          if (res.ok) return await res.json();
        }
      } catch (e) {
        console.warn('Erro na API ao salvar nota, usando LocalStorage');
      }
    }

    // Salvar no LocalStorage
    let notes = await this.getNotes();
    const index = notes.findIndex(n => n.id === note.id);
    note.updated_at = new Date().toISOString();
    if (index >= 0) {
      notes[index] = note;
    } else {
      note.created_at = note.created_at || new Date().toISOString();
      notes.unshift(note);
    }
    localStorage.setItem(this.localStorageKey, JSON.stringify(notes));
    return note;
  }

  async deleteNote(id, permanent = false) {
    if (this.backendMode === 'api') {
      try {
        const url = `api/notes.php?id=${id}${permanent ? '&permanent=1' : ''}`;
        await fetch(url, { method: 'DELETE' });
        return;
      } catch (e) {
        console.warn('Erro na API ao deletar nota');
      }
    }

    let notes = await this.getNotes();
    if (permanent) {
      notes = notes.filter(n => n.id !== id);
    } else {
      const target = notes.find(n => n.id === id);
      if (target) {
        target.is_trashed = true;
        target.is_pinned = false;
        target.updated_at = new Date().toISOString();
      }
    }
    localStorage.setItem(this.localStorageKey, JSON.stringify(notes));
  }

  async emptyTrash() {
    if (this.backendMode === 'api') {
      try {
        await fetch('api/notes.php?action=empty_trash', { method: 'POST' });
        return;
      } catch (e) {}
    }
    let notes = await this.getNotes();
    notes = notes.filter(n => !n.is_trashed);
    localStorage.setItem(this.localStorageKey, JSON.stringify(notes));
  }

  async getLabels() {
    if (this.backendMode === 'api') {
      try {
        const res = await fetch('api/labels.php');
        if (res.ok) return await res.json();
      } catch (e) {}
    }
    const data = localStorage.getItem(this.labelsStorageKey);
    return data ? JSON.parse(data) : [
      { id: 'lbl_trabalho', name: 'Trabalho' },
      { id: 'lbl_ideias', name: 'Ideias' },
      { id: 'lbl_estudos', name: 'Estudos' }
    ];
  }

  async saveLabels(labels) {
    if (this.backendMode === 'api') {
      // Sincronizar via API se necessário
    }
    localStorage.setItem(this.labelsStorageKey, JSON.stringify(labels));
  }

  getDefaultSeedNotes() {
    const defaultNotes = [
      {
        id: 'seed_1',
        title: 'Primeiros passos',
        content: 'Use o NoteKeep para organizar suas anotações:\n\n• Crie notas de texto ou listas com caixas de seleção.\n• Alterne entre temas Claro e Escuro.\n• Escolha entre as 11 cores originais.\n• Use a busca em tempo real no topo.\n• Fixe notas importantes para ficarem sempre visíveis.',
        type: 'text',
        checklist_items: [],
        color: 'sand',
        is_pinned: true,
        is_archived: false,
        is_trashed: false,
        labels: ['Ideias'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'seed_2',
        title: 'Assistente de IA',
        content: 'Você pode selecionar qualquer uma das suas notas e conversar com a inteligência artificial pelo AI Studio!\n\n1. Clique na aba "IA" no menu lateral.\n2. Insira sua chave de API gratuita do AI Studio.\n3. Peça resumos, planos de ação ou novas ideias.\n4. Salve a resposta diretamente como uma nova nota no NoteKeep!',
        type: 'text',
        checklist_items: [],
        color: 'dusk',
        is_pinned: true,
        is_archived: false,
        is_trashed: false,
        labels: ['Estudos'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'seed_3',
        title: 'Tarefas da Semana',
        content: '',
        type: 'checklist',
        checklist_items: [
          { id: 'c1', text: 'Testar criação de notas coloridas', completed: true },
          { id: 'c2', text: 'Experimentar o modo escuro no topo direito', completed: true },
          { id: 'c3', text: 'Adicionar marcadores personalizados', completed: false },
          { id: 'c4', text: 'Conversar com a IA sobre as tarefas', completed: false }
        ],
        color: 'mint',
        is_pinned: false,
        is_archived: false,
        is_trashed: false,
        labels: ['Trabalho'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
    localStorage.setItem(this.localStorageKey, JSON.stringify(defaultNotes));
    return defaultNotes;
  }
}

/**
 * ==========================================================
 * EFEITOS SONOROS
 * ==========================================================
 */
class SoundFXService {
  constructor() {
    this.enabled = localStorage.getItem('notekeep_sound_enabled') !== 'false';
    this.ctx = null;
  }

  initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('notekeep_sound_enabled', this.enabled ? 'true' : 'false');
    if (this.enabled) this.playCheck();
    return this.enabled;
  }

  playPop() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.07);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {}
  }

  playCheck() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch (e) {}
  }

  playLock() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(700, now);
      osc.frequency.setValueAtTime(350, now + 0.06);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {}
  }

  playSwoosh() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.12);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } catch (e) {}
  }

  playChime() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const freqs = [523.25, 659.25, 783.99, 1046.5];
      const now = this.ctx.currentTime;
      freqs.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const start = now + idx * 0.07;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.15, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + 0.3);
      });
    } catch (e) {}
  }
}

/**
 * ==========================================================
 * CRIPTOGRAFIA DE NOTAS COM AES-GCM
 * ==========================================================
 */
class VaultCryptoService {
  constructor() {
    this.sessionCache = new Map();
    this.masterPasswordCache = '';
  }

  async deriveKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  buf2hex(buf) {
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  hex2buf(hex) {
    const tokens = hex.match(/.{1,2}/g) || [];
    return new Uint8Array(tokens.map(t => parseInt(t, 16)));
  }

  async encryptPayload(payloadObj, password) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveKey(password, salt);
    const enc = new TextEncoder();
    const encoded = enc.encode(JSON.stringify(payloadObj));
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encoded
    );

    return JSON.stringify({
      v: 1,
      salt: this.buf2hex(salt),
      iv: this.buf2hex(iv),
      cipher: this.buf2hex(ciphertext)
    });
  }

  async decryptPayload(encryptedJsonString, password) {
    const pkg = JSON.parse(encryptedJsonString);
    const salt = this.hex2buf(pkg.salt);
    const iv = this.hex2buf(pkg.iv);
    const ciphertext = this.hex2buf(pkg.cipher);
    const key = await this.deriveKey(password, salt);

    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      ciphertext
    );
    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decrypted));
  }
}

/**
 * ==========================================================
 * PALETA DE COMANDOS (Ctrl + K)
 * ==========================================================
 */
class CommandPalette {
  constructor(app) {
    this.app = app;
    this.modal = document.getElementById('commandPaletteModal');
    this.input = document.getElementById('commandPaletteInput');
    this.results = document.getElementById('commandPaletteResults');
    this.btnOpen = document.getElementById('btnOpenCommandPalette');
    this.selectedIndex = 0;
    this.filteredItems = [];

    this.bindEvents();
  }

  bindEvents() {
    if (this.btnOpen) {
      this.btnOpen.addEventListener('click', (e) => {
        e.stopPropagation();
        this.open();
      });
    }

    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.toggle();
      }
    });

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    this.input.addEventListener('input', () => this.filterResults());
    this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
  }

  toggle() {
    if (this.modal.classList.contains('hidden')) {
      this.open();
    } else {
      this.close();
    }
  }

  open() {
    this.modal.classList.remove('hidden');
    this.input.value = '';
    this.input.focus();
    this.filterResults();
  }

  close() {
    this.modal.classList.add('hidden');
  }

  getDefaultCommands() {
    return [
      {
        id: 'new_note',
        type: 'action',
        icon: 'edit_note',
        title: 'Criar Nova Nota',
        desc: 'Abre o editor para adicionar uma nota rápida',
        action: () => {
          this.app.switchView('notes');
          this.app.expandNoteCreator(false);
        }
      },
      {
        id: 'new_checklist',
        type: 'action',
        icon: 'checklist',
        title: 'Criar Nova Lista / Checklist',
        desc: 'Adicione itens e caixas de seleção',
        action: () => {
          this.app.switchView('notes');
          this.app.expandNoteCreator(true);
        }
      },
      {
        id: 'open_kanban',
        type: 'action',
        icon: 'view_kanban',
        title: 'Abrir Quadro Kanban Ágil',
        desc: 'Organize suas tarefas no fluxo A Fazer / Em Andamento / Concluído',
        action: () => {
          this.app.switchView('kanban');
        }
      },
      {
        id: 'open_vault',
        type: 'action',
        icon: 'lock',
        title: 'Acessar Cofre Seguro (AES-256)',
        desc: 'Visualizar notas protegidas com criptografia de ponta',
        action: () => {
          this.app.switchView('vault');
        }
      },
      {
        id: 'open_ai',
        type: 'action',
        icon: 'auto_awesome',
        title: 'Abrir Assistente de IA',
        desc: 'Converse com a inteligência artificial sobre suas anotações',
        action: () => {
          this.app.switchView('ai');
        }
      },
      {
        id: 'toggle_theme',
        type: 'action',
        icon: 'dark_mode',
        title: 'Alternar Tema Claro / Escuro',
        desc: 'Muda a aparência de toda a aplicação',
        action: () => {
          this.app.theme = this.app.theme === 'light' ? 'dark' : 'light';
          this.app.applyTheme(this.app.theme);
        }
      },
      {
        id: 'toggle_sound',
        type: 'action',
        icon: 'volume_up',
        title: 'Alternar Efeitos Sonoros Táteis',
        desc: this.app.sound.enabled ? 'Desativar sons' : 'Ativar sons táteis',
        action: () => {
          this.app.toggleSound();
        }
      },
      {
        id: 'view_archive',
        type: 'action',
        icon: 'archive',
        title: 'Ver Notas Arquivadas',
        desc: 'Ir para o arquivo de notas',
        action: () => {
          this.app.switchView('archive');
        }
      },
      {
        id: 'view_trash',
        type: 'action',
        icon: 'delete',
        title: 'Ver Lixeira',
        desc: 'Gerenciar notas apagadas',
        action: () => {
          this.app.switchView('trash');
        }
      }
    ];
  }

  filterResults() {
    const query = this.input.value.toLowerCase().trim();
    const defaultCmds = this.getDefaultCommands();
    let items = [];

    if (!query) {
      items = [...defaultCmds];
      const recentNotes = this.app.notes.filter(n => !n.is_trashed).slice(0, 5);
      recentNotes.forEach(note => {
        items.push({
          id: `note_${note.id}`,
          type: 'note',
          icon: note.is_locked ? 'lock' : (note.type === 'checklist' ? 'checklist' : 'description'),
          title: note.title || (note.content ? note.content.slice(0, 40) : 'Nota sem título'),
          desc: note.is_locked ? '🔒 Protegida por criptografia AES-256' : (note.content ? note.content.slice(0, 60) : 'Checklist'),
          action: () => {
            this.app.openEditModal(note);
          }
        });
      });
    } else {
      const matchedCmds = defaultCmds.filter(c =>
        c.title.toLowerCase().includes(query) || c.desc.toLowerCase().includes(query)
      );
      items.push(...matchedCmds);

      const matchedNotes = this.app.notes.filter(n => !n.is_trashed && (
        (n.title && n.title.toLowerCase().includes(query)) ||
        (n.content && n.content.toLowerCase().includes(query)) ||
        (n.labels && n.labels.some(l => l.toLowerCase().includes(query)))
      )).slice(0, 8);

      matchedNotes.forEach(note => {
        items.push({
          id: `note_${note.id}`,
          type: 'note',
          icon: note.is_locked ? 'lock' : (note.type === 'checklist' ? 'checklist' : 'description'),
          title: note.title || 'Nota sem título',
          desc: note.is_locked ? '🔒 Protegida' : (note.content ? note.content.slice(0, 60) : 'Checklist'),
          action: () => {
            this.app.openEditModal(note);
          }
        });
      });

      const matchedLabels = this.app.labels.filter(l => l.name.toLowerCase().includes(query));
      matchedLabels.forEach(lbl => {
        items.push({
          id: `label_${lbl.id}`,
          type: 'label',
          icon: 'label',
          title: `Marcador: ${lbl.name}`,
          desc: 'Filtrar notas por este marcador',
          action: () => {
            this.app.switchView(`label:${lbl.name}`);
          }
        });
      });
    }

    this.filteredItems = items;
    this.selectedIndex = 0;
    this.renderResults();
  }

  renderResults() {
    this.results.innerHTML = '';
    if (this.filteredItems.length === 0) {
      this.results.innerHTML = `
        <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 14px;">
          Nenhum comando ou nota encontrada para sua busca.
        </div>
      `;
      return;
    }

    let lastType = '';
    this.filteredItems.forEach((item, index) => {
      if (item.type !== lastType) {
        lastType = item.type;
        const groupTitle = document.createElement('div');
        groupTitle.className = 'palette-group-title';
        groupTitle.textContent = item.type === 'action' ? 'Ações Rápidas' : (item.type === 'note' ? 'Suas Notas' : 'Marcadores');
        this.results.appendChild(groupTitle);
      }

      const row = document.createElement('div');
      row.className = `palette-item ${index === this.selectedIndex ? 'active' : ''}`;
      row.innerHTML = `
        <div class="palette-item-icon">
          <span class="material-symbols-outlined">${item.icon}</span>
        </div>
        <div class="palette-item-content">
          <span class="palette-item-title">${this.app.escapeHtml(item.title)}</span>
          <span class="palette-item-desc">${this.app.escapeHtml(item.desc)}</span>
        </div>
        <span class="palette-item-badge">${item.type === 'action' ? 'Ação' : 'Nota'}</span>
      `;

      row.addEventListener('click', () => {
        this.close();
        item.action();
      });

      this.results.appendChild(row);
    });

    const activeEl = this.results.querySelector('.palette-item.active');
    if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
  }

  handleKeydown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (this.filteredItems.length > 0) {
        this.selectedIndex = (this.selectedIndex + 1) % this.filteredItems.length;
        this.renderResults();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (this.filteredItems.length > 0) {
        this.selectedIndex = (this.selectedIndex - 1 + this.filteredItems.length) % this.filteredItems.length;
        this.renderResults();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (this.filteredItems[this.selectedIndex]) {
        const item = this.filteredItems[this.selectedIndex];
        this.close();
        item.action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
    }
  }
}

/**
 * ==========================================================
 * ENTRADA POR VOZ
 * ==========================================================
 */
class VoiceInputService {
  constructor(app) {
    this.app = app;
    this.modal = document.getElementById('voiceToastModal');
    this.statusText = document.getElementById('voiceStatusText');
    this.btnStop = document.getElementById('btnStopVoiceModal');
    this.btnCancel = document.getElementById('btnCancelVoiceModal');
    this.recognition = null;
    this.isRecording = false;
    this.currentTarget = 'creator';
    this.finalTranscript = '';

    this.init();
  }

  init() {
    const SpeechClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechClass) {
      this.recognition = new SpeechClass();
      this.recognition.lang = 'pt-BR';
      this.recognition.continuous = true;
      this.recognition.interimResults = true;

      this.recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            this.finalTranscript += event.results[i][0].transcript + ' ';
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        this.statusText.textContent = (this.finalTranscript + interim).trim() || 'Ouvindo... Fale agora';
      };

      this.recognition.onerror = (event) => {
        console.warn('Erro no reconhecimento de voz:', event.error);
        this.stop(false);
      };

      this.recognition.onend = () => {
        if (this.isRecording) {
          this.stop(true);
        }
      };
    }

    if (this.btnStop) {
      this.btnStop.addEventListener('click', () => this.stop(true));
    }
    if (this.btnCancel) {
      this.btnCancel.addEventListener('click', () => this.stop(false));
    }
  }

  start(target = 'creator') {
    if (!this.recognition) {
      this.app.showToast('Reconhecimento de fala não suportado neste navegador.');
      return;
    }
    this.currentTarget = target;
    this.finalTranscript = '';
    this.isRecording = true;
    this.statusText.textContent = 'Ouvindo... Fale agora';
    this.modal.classList.remove('hidden');

    try {
      this.recognition.start();
      this.app.sound.playPop();
    } catch (e) {}
  }

  async stop(save = true) {
    if (!this.isRecording) return;
    this.isRecording = false;
    this.modal.classList.add('hidden');
    try {
      this.recognition.stop();
    } catch (e) {}

    const text = this.finalTranscript.trim();
    if (save && text) {
      this.app.sound.playCheck();

      if (this.app.ai && this.app.ai.hasApiKey()) {
        this.app.showToast('Estruturando áudio com inteligência artificial...');
        const structured = await this.app.ai.structureVoiceTranscript(text);

        if (this.currentTarget === 'creator') {
          this.app.expandNoteCreator(structured.type === 'checklist');
          if (structured.title) this.app.newNoteTitle.value = structured.title;
          if (structured.type === 'checklist' && structured.checklist_items.length > 0) {
            this.app.newNoteState.checklistItems = structured.checklist_items;
            this.app.renderCreatorChecklistItems();
          } else {
            this.app.newNoteContent.value = (this.app.newNoteContent.value ? this.app.newNoteContent.value + '\n\n' : '') + structured.content;
          }
        } else if (this.currentTarget === 'modal' && this.app.editingNote) {
          if (structured.title && !this.app.modalNoteTitle.value) this.app.modalNoteTitle.value = structured.title;
          if (structured.type === 'checklist') {
            this.app.editingNote.type = 'checklist';
            this.app.editingNote.checklist_items = this.app.editingNote.checklist_items || [];
            this.app.editingNote.checklist_items.push(...structured.checklist_items);
            this.app.renderModalChecklistItems();
            this.app.modalTextBody.classList.add('hidden');
            this.app.modalChecklistBody.classList.remove('hidden');
          } else {
            this.app.modalNoteContent.value = (this.app.modalNoteContent.value ? this.app.modalNoteContent.value + '\n\n' : '') + structured.content;
          }
        }
        this.app.showToast('Nota preenchida com sucesso pela IA!');
      } else {
        if (this.currentTarget === 'creator') {
          this.app.expandNoteCreator(false);
          this.app.newNoteContent.value = (this.app.newNoteContent.value ? this.app.newNoteContent.value + '\n\n' : '') + text;
        } else if (this.currentTarget === 'modal') {
          this.app.modalNoteContent.value = (this.app.modalNoteContent.value ? this.app.modalNoteContent.value + '\n\n' : '') + text;
        }
        this.app.showToast('Áudio transcrito com sucesso!');
      }
    }
  }
}

/**
 * ==========================================================
 * COMANDOS DO EDITOR
 * ==========================================================
 */
class SlashCommandsService {
  constructor(app) {
    this.app = app;
    this.popover = document.getElementById('slashMenuPopover');
    this.activeTextarea = null;
    this.target = 'creator';
    this.bindEvents();
  }

  bindEvents() {
    this.popover.addEventListener('click', (e) => {
      const item = e.target.closest('.slash-item');
      if (item) {
        const action = item.dataset.action;
        this.executeCommand(action);
      }
    });

    document.addEventListener('click', (e) => {
      if (!this.popover.contains(e.target) && e.target !== this.activeTextarea) {
        this.hide();
      }
    });
  }

  attachTo(textarea, target = 'creator') {
    textarea.addEventListener('keyup', (e) => {
      if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) {
        if (!this.popover.classList.contains('hidden')) {
          if (e.key === 'Escape') {
            this.hide();
          }
          return;
        }
      }

      const val = textarea.value;
      const cursorPos = textarea.selectionStart;
      const textBefore = val.slice(0, cursorPos);
      const lastLine = textBefore.split('\n').pop();

      if (lastLine.trim() === '/') {
        this.show(textarea, target);
      } else {
        this.hide();
      }
    });
  }

  show(textarea, target) {
    this.activeTextarea = textarea;
    this.target = target;
    const rect = textarea.getBoundingClientRect();
    this.popover.style.top = `${rect.bottom + window.scrollY + 6}px`;
    this.popover.style.left = `${rect.left + window.scrollX + 16}px`;
    this.popover.classList.remove('hidden');
    this.app.sound.playPop();
  }

  hide() {
    this.popover.classList.add('hidden');
    this.activeTextarea = null;
  }

  executeCommand(action) {
    if (!this.activeTextarea) return;
    const textarea = this.activeTextarea;
    const val = textarea.value;
    const cursorPos = textarea.selectionStart;
    const textBefore = val.slice(0, cursorPos);
    const textAfter = val.slice(cursorPos);
    const lastSlashIdx = textBefore.lastIndexOf('/');
    const cleanBefore = lastSlashIdx >= 0 ? textBefore.slice(0, lastSlashIdx) : textBefore;

    this.hide();

    if (action === 'todo') {
      if (this.target === 'creator') {
        this.app.toggleCreatorChecklistMode(true);
      } else {
        this.app.toggleModalChecklistMode();
      }
      this.app.sound.playCheck();
      return;
    }

    let insertText = '';
    if (action === 'h1') insertText = '# Título Principal\n';
    else if (action === 'h2') insertText = '## Subtítulo\n';
    else if (action === 'code') insertText = '```javascript\n// seu código aqui\n```\n';
    else if (action === 'quote') insertText = '> Citação ou destaque...\n';
    else if (action === 'ai') {
      this.app.showToast('Use a aba IA no menu lateral para análises avançadas.');
      insertText = '[Ideia a ser expandida pela IA]: ';
    }

    textarea.value = cleanBefore + insertText + textAfter;
    textarea.focus();
    this.app.sound.playPop();
  }
}

class NoteKeepApp {
  constructor() {
    this.storage = new StorageAdapter();
    this.sound = new SoundFXService();
    this.vault = new VaultCryptoService();
    this.notes = [];
    this.labels = [];
    this.activeView = 'notes';
    this.searchQuery = '';
    this.viewMode = 'grid';
    this.theme = localStorage.getItem('keep_theme') || 'light';
    this.lastDeletedNote = null;

    // Estado do criador de nota
    this.newNoteState = {
      isChecklist: false,
      color: 'default',
      isPinned: false,
      isArchived: false,
      labels: [],
      checklistItems: [],
      image: null,
      imageMime: null
    };

    // Estado do modal de edição
    this.editingNote = null;

    // Estado de desbloqueio pendente
    this.pendingUnlockNote = null;
    this.pendingUnlockCallback = null;
  }

  async init() {
    this.cacheDom();
    this.applyTheme(this.theme);
    await this.storage.init();
    this.notes = await this.storage.getNotes();
    this.labels = await this.storage.getLabels();

    this.ai = new AIService();

    this.updateSoundUI();

    this.commandPalette = new CommandPalette(this);
    this.voiceInput = new VoiceInputService(this);
    this.slashCommands = new SlashCommandsService(this);
    this.slashCommands.attachTo(this.newNoteContent, 'creator');
    this.slashCommands.attachTo(this.modalNoteContent, 'modal');

    this.bindEvents();
    this.setupMediaAndDragDrop();
    this.render();
  }

  cacheDom() {
    // Top bar
    this.btnMenuToggle = document.getElementById('btnMenuToggle');
    this.sidebar = document.getElementById('sidebar');
    this.searchInput = document.getElementById('searchInput');
    this.btnClearSearch = document.getElementById('btnClearSearch');
    this.btnToggleView = document.getElementById('btnToggleView');
    this.viewModeIcon = document.getElementById('viewModeIcon');
    this.btnToggleTheme = document.getElementById('btnToggleTheme');
    this.themeIcon = document.getElementById('themeIcon');
    this.btnRefresh = document.getElementById('btnRefresh');
    this.btnAiHeader = document.getElementById('btnAiHeader');
    this.logoApp = document.getElementById('logoApp');

    // Sidebar
    this.navNotes = document.getElementById('navNotes');
    this.navReminders = document.getElementById('navReminders');
    this.navArchive = document.getElementById('navArchive');
    this.navTrash = document.getElementById('navTrash');
    this.navAi = document.getElementById('navAi');
    this.sidebarLabelsList = document.getElementById('sidebarLabelsList');
    this.btnOpenLabelsModal = document.getElementById('btnOpenLabelsModal');

    // Content Views
    this.notesView = document.getElementById('notesView');
    this.aiView = document.getElementById('aiView');
    this.trashBanner = document.getElementById('trashBanner');
    this.btnEmptyTrash = document.getElementById('btnEmptyTrash');
    this.archiveBanner = document.getElementById('archiveBanner');

    // Note Creator
    this.noteCreatorWrapper = document.getElementById('noteCreatorWrapper');
    this.noteCreatorCard = document.getElementById('noteCreatorCard');
    this.creatorCollapsed = document.getElementById('creatorCollapsed');
    this.creatorExpanded = document.getElementById('creatorExpanded');
    this.newNoteTitle = document.getElementById('newNoteTitle');
    this.newNoteContent = document.getElementById('newNoteContent');
    this.btnNewNotePin = document.getElementById('btnNewNotePin');
    this.btnQuickChecklist = document.getElementById('btnQuickChecklist');
    this.creatorTextContentArea = document.getElementById('creatorTextContentArea');
    this.creatorChecklistArea = document.getElementById('creatorChecklistArea');
    this.newNoteChecklistItems = document.getElementById('newNoteChecklistItems');
    this.newChecklistInput = document.getElementById('newChecklistInput');
    this.newNoteLabelsList = document.getElementById('newNoteLabelsList');
    this.btnNewNoteColor = document.getElementById('btnNewNoteColor');
    this.newNoteColorPalette = document.getElementById('newNoteColorPalette');
    this.btnNewNoteLabel = document.getElementById('btnNewNoteLabel');
    this.newNoteLabelPicker = document.getElementById('newNoteLabelPicker');
    this.btnToggleChecklistMode = document.getElementById('btnToggleChecklistMode');
    this.btnNewNoteArchive = document.getElementById('btnNewNoteArchive');
    this.btnCloseCreator = document.getElementById('btnCloseCreator');

    // Grids
    this.pinnedSection = document.getElementById('pinnedSection');
    this.pinnedGrid = document.getElementById('pinnedGrid');
    this.othersSection = document.getElementById('othersSection');
    this.othersTitle = document.getElementById('othersTitle');
    this.othersGrid = document.getElementById('othersGrid');
    this.emptyState = document.getElementById('emptyState');
    this.emptyIcon = document.getElementById('emptyIcon');
    this.emptyTitle = document.getElementById('emptyTitle');
    this.emptySubtitle = document.getElementById('emptySubtitle');

    // Modals
    this.editNoteModal = document.getElementById('editNoteModal');
    this.modalCard = document.getElementById('modalCard');
    this.modalNoteTitle = document.getElementById('modalNoteTitle');
    this.modalNoteContent = document.getElementById('modalNoteContent');
    this.modalTextBody = document.getElementById('modalTextBody');
    this.modalChecklistBody = document.getElementById('modalChecklistBody');
    this.modalChecklistItems = document.getElementById('modalChecklistItems');
    this.modalNewChecklistInput = document.getElementById('modalNewChecklistInput');
    this.modalLabelsList = document.getElementById('modalLabelsList');
    this.btnModalPin = document.getElementById('btnModalPin');
    this.btnModalColor = document.getElementById('btnModalColor');
    this.modalColorPalette = document.getElementById('modalColorPalette');
    this.btnModalLabel = document.getElementById('btnModalLabel');
    this.modalLabelPicker = document.getElementById('modalLabelPicker');
    this.btnModalToggleChecklist = document.getElementById('btnModalToggleChecklist');
    this.btnModalArchive = document.getElementById('btnModalArchive');
    this.btnModalDelete = document.getElementById('btnModalDelete');
    this.btnModalAskAi = document.getElementById('btnModalAskAi');
    this.btnCloseModal = document.getElementById('btnCloseModal');

    // Labels Modal
    this.labelsModal = document.getElementById('labelsModal');
    this.newLabelInput = document.getElementById('newLabelInput');
    this.btnSaveNewLabel = document.getElementById('btnSaveNewLabel');
    this.btnClearNewLabel = document.getElementById('btnClearNewLabel');
    this.existingLabelsList = document.getElementById('existingLabelsList');
    this.btnCloseLabelsModal = document.getElementById('btnCloseLabelsModal');

    // Toast
    this.snackbar = document.getElementById('snackbar');
    this.snackbarMessage = document.getElementById('snackbarMessage');
    this.snackbarAction = document.getElementById('snackbarAction');

    // Top Bar & Navigation novos
    this.btnToggleSound = document.getElementById('btnToggleSound');
    this.soundIcon = document.getElementById('soundIcon');
    this.btnToggleKanban = document.getElementById('btnToggleKanban');
    this.kanbanIcon = document.getElementById('kanbanIcon');
    this.navKanban = document.getElementById('navKanban');
    this.navVault = document.getElementById('navVault');

    // Seção Kanban
    this.kanbanView = document.getElementById('kanbanView');
    this.btnNewKanbanNote = document.getElementById('btnNewKanbanNote');
    this.kanbanCardsTodo = document.getElementById('kanbanCardsTodo');
    this.kanbanCardsInProgress = document.getElementById('kanbanCardsInProgress');
    this.kanbanCardsDone = document.getElementById('kanbanCardsDone');
    this.kanbanCountTodo = document.getElementById('kanbanCountTodo');
    this.kanbanCountInProgress = document.getElementById('kanbanCountInProgress');
    this.kanbanCountDone = document.getElementById('kanbanCountDone');

    // Criador de nota - Voice & Image
    this.btnQuickVoice = document.getElementById('btnQuickVoice');
    this.btnVoiceInput = document.getElementById('btnVoiceInput');
    this.btnAttachImage = document.getElementById('btnAttachImage');
    this.creatorImageInput = document.getElementById('creatorImageInput');
    this.creatorImagePreviewContainer = document.getElementById('creatorImagePreviewContainer');

    // Modal de nota - Voice & Image & Lock
    this.btnModalVoiceInput = document.getElementById('btnModalVoiceInput');
    this.btnModalAttachImage = document.getElementById('btnModalAttachImage');
    this.modalImageInput = document.getElementById('modalImageInput');
    this.modalImagePreviewContainer = document.getElementById('modalImagePreviewContainer');
    this.btnModalLockNote = document.getElementById('btnModalLockNote');
    this.modalLockIcon = document.getElementById('modalLockIcon');

    // Modal de Senha do Cofre
    this.vaultPasswordModal = document.getElementById('vaultPasswordModal');
    this.vaultPasswordInput = document.getElementById('vaultPasswordInput');
    this.btnConfirmVaultModal = document.getElementById('btnConfirmVaultModal');
    this.btnCancelVaultModal = document.getElementById('btnCancelVaultModal');
    this.vaultErrorMsg = document.getElementById('vaultErrorMsg');
    this.btnToggleVaultPassVisibility = document.getElementById('btnToggleVaultPassVisibility');
    this.vaultPassEyeIcon = document.getElementById('vaultPassEyeIcon');
  }

  bindEvents() {
    // Menu lateral toggle
    this.btnMenuToggle.addEventListener('click', () => {
      this.sidebar.classList.toggle('collapsed');
    });

    this.logoApp.addEventListener('click', () => this.switchView('notes'));

    // Alternar tema
    this.btnToggleTheme.addEventListener('click', () => {
      this.theme = this.theme === 'light' ? 'dark' : 'light';
      this.applyTheme(this.theme);
    });

    // Alternar exibição lista / grade
    this.btnToggleView.addEventListener('click', () => {
      this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
      this.updateViewModeUI();
    });

    // Atualizar
    this.btnRefresh.addEventListener('click', async () => {
      this.notes = await this.storage.getNotes();
      this.renderNotesGrid();
      this.showToast('Notas atualizadas');
    });

    // Pesquisa
    this.searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.btnClearSearch.classList.toggle('hidden', !this.searchQuery);
      this.renderNotesGrid();
    });

    this.btnClearSearch.addEventListener('click', () => {
      this.searchInput.value = '';
      this.searchQuery = '';
      this.btnClearSearch.classList.add('hidden');
      this.renderNotesGrid();
    });

    // Navegação Sidebar
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const view = item.dataset.view;
        if (view) this.switchView(view);
      });
    });

    if (this.btnAiHeader) {
      this.btnAiHeader.addEventListener('click', () => this.switchView('ai'));
    }

    // Lixeira esvaziar
    this.btnEmptyTrash.addEventListener('click', async () => {
      if (confirm('Tem certeza que deseja esvaziar a lixeira? Todas as notas serão excluídas permanentemente.')) {
        await this.storage.emptyTrash();
        this.notes = this.notes.filter(n => !n.is_trashed);
        this.renderNotesGrid();
        this.showToast('Lixeira esvaziada');
      }
    });

    // Criador de nota
    this.creatorCollapsed.addEventListener('click', () => this.expandNoteCreator());
    this.btnQuickChecklist.addEventListener('click', (e) => {
      e.stopPropagation();
      this.expandNoteCreator(true);
    });
    this.btnCloseCreator.addEventListener('click', () => this.saveAndCollapseNoteCreator());

    this.btnNewNotePin.addEventListener('click', () => {
      this.newNoteState.isPinned = !this.newNoteState.isPinned;
      this.btnNewNotePin.classList.toggle('pinned', this.newNoteState.isPinned);
      this.btnNewNotePin.querySelector('.material-symbols-outlined').textContent =
        this.newNoteState.isPinned ? 'push_pin' : 'push_pin';
    });

    this.btnToggleChecklistMode.addEventListener('click', () => this.toggleCreatorChecklistMode());
    this.newChecklistInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.value.trim()) {
        e.preventDefault();
        this.addCreatorChecklistItem(e.target.value.trim());
        e.target.value = '';
      }
    });

    // Paleta de cores do criador
    this.renderColorPalette(this.newNoteColorPalette, (colorId) => {
      this.setCreatorColor(colorId);
    });
    this.btnNewNoteColor.addEventListener('click', (e) => {
      e.stopPropagation();
      this.newNoteColorPalette.classList.toggle('hidden');
      this.newNoteLabelPicker.classList.add('hidden');
    });

    // Marcadores do criador
    this.btnNewNoteLabel.addEventListener('click', (e) => {
      e.stopPropagation();
      this.renderLabelPicker(this.newNoteLabelPicker, this.newNoteState.labels, (labelName) => {
        if (this.newNoteState.labels.includes(labelName)) {
          this.newNoteState.labels = this.newNoteState.labels.filter(l => l !== labelName);
        } else {
          this.newNoteState.labels.push(labelName);
        }
        this.renderCreatorLabels();
      });
      this.newNoteLabelPicker.classList.toggle('hidden');
      this.newNoteColorPalette.classList.add('hidden');
    });

    this.btnNewNoteArchive.addEventListener('click', () => {
      this.newNoteState.isArchived = !this.newNoteState.isArchived;
      this.showToast(this.newNoteState.isArchived ? 'Nota será arquivada ao salvar' : 'Nota desmarcada para arquivo');
    });

    // Fechar criador se clicar fora
    document.addEventListener('click', (e) => {
      if (!this.noteCreatorCard.contains(e.target) && !this.creatorExpanded.classList.contains('hidden')) {
        this.saveAndCollapseNoteCreator();
      }
      if (!this.btnNewNoteColor.contains(e.target) && !this.newNoteColorPalette.contains(e.target)) {
        this.newNoteColorPalette.classList.add('hidden');
      }
      if (!this.btnNewNoteLabel.contains(e.target) && !this.newNoteLabelPicker.contains(e.target)) {
        this.newNoteLabelPicker.classList.add('hidden');
      }
      if (!this.btnModalColor.contains(e.target) && !this.modalColorPalette.contains(e.target)) {
        this.modalColorPalette.classList.add('hidden');
      }
      if (!this.btnModalLabel.contains(e.target) && !this.modalLabelPicker.contains(e.target)) {
        this.modalLabelPicker.classList.add('hidden');
      }
    });

    // Modal de Edição
    this.btnCloseModal.addEventListener('click', () => this.closeEditModal(true));
    this.editNoteModal.addEventListener('click', (e) => {
      if (e.target === this.editNoteModal) this.closeEditModal(true);
    });

    this.btnModalPin.addEventListener('click', () => {
      if (!this.editingNote) return;
      this.editingNote.is_pinned = !this.editingNote.is_pinned;
      this.btnModalPin.classList.toggle('pinned', this.editingNote.is_pinned);
    });

    this.btnModalArchive.addEventListener('click', () => {
      if (!this.editingNote) return;
      this.editingNote.is_archived = !this.editingNote.is_archived;
      this.showToast(this.editingNote.is_archived ? 'Nota arquivada' : 'Nota desarquivada');
      this.closeEditModal(true);
    });

    this.btnModalDelete.addEventListener('click', () => {
      if (!this.editingNote) return;
      this.deleteNote(this.editingNote.id);
      this.closeEditModal(false);
    });

    this.btnModalAskAi.addEventListener('click', () => {
      if (!this.editingNote) return;
      const id = this.editingNote.id;
      this.closeEditModal(true);
      this.ai.selectSingleNote(id);
      this.switchView('ai');
    });

    this.renderColorPalette(this.modalColorPalette, (colorId) => {
      if (!this.editingNote) return;
      this.editingNote.color = colorId;
      this.modalCard.className = `modal-dialog note-modal-card color-${colorId}`;
    });

    this.btnModalColor.addEventListener('click', (e) => {
      e.stopPropagation();
      this.modalColorPalette.classList.toggle('hidden');
      this.modalLabelPicker.classList.add('hidden');
    });

    this.btnModalLabel.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.editingNote) return;
      this.renderLabelPicker(this.modalLabelPicker, this.editingNote.labels || [], (labelName) => {
        this.editingNote.labels = this.editingNote.labels || [];
        if (this.editingNote.labels.includes(labelName)) {
          this.editingNote.labels = this.editingNote.labels.filter(l => l !== labelName);
        } else {
          this.editingNote.labels.push(labelName);
        }
        this.renderModalLabels();
      });
      this.modalLabelPicker.classList.toggle('hidden');
      this.modalColorPalette.classList.add('hidden');
    });

    this.btnModalToggleChecklist.addEventListener('click', () => this.toggleModalChecklistMode());
    this.modalNewChecklistInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.value.trim()) {
        e.preventDefault();
        this.addModalChecklistItem(e.target.value.trim());
        e.target.value = '';
      }
    });

    // Marcadores Modal
    this.btnOpenLabelsModal.addEventListener('click', () => this.openLabelsModal());
    this.btnCloseLabelsModal.addEventListener('click', () => this.closeLabelsModal());
    this.labelsModal.addEventListener('click', (e) => {
      if (e.target === this.labelsModal) this.closeLabelsModal();
    });

    this.btnSaveNewLabel.addEventListener('click', () => this.saveNewLabelFromModal());
    this.newLabelInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.saveNewLabelFromModal();
    });
    this.btnClearNewLabel.addEventListener('click', () => {
      this.newLabelInput.value = '';
    });

    // Snackbar Desfazer
    this.snackbarAction.addEventListener('click', () => {
      if (this.lastDeletedNote) {
        this.lastDeletedNote.is_trashed = false;
        this.storage.saveNote(this.lastDeletedNote);
        this.notes.unshift(this.lastDeletedNote);
        this.lastDeletedNote = null;
        this.renderNotesGrid();
        this.snackbar.classList.add('hidden');
      }
    });

    // Alternar Efeitos Sonoros
    if (this.btnToggleSound) {
      this.btnToggleSound.addEventListener('click', () => this.toggleSound());
    }

    // Alternar Kanban
    if (this.btnToggleKanban) {
      this.btnToggleKanban.addEventListener('click', () => {
        this.switchView(this.activeView === 'kanban' ? 'notes' : 'kanban');
      });
    }

    if (this.btnNewKanbanNote) {
      this.btnNewKanbanNote.addEventListener('click', () => {
        this.switchView('notes');
        this.expandNoteCreator();
      });
    }

    // Voice Input triggers
    if (this.btnQuickVoice) {
      this.btnQuickVoice.addEventListener('click', (e) => {
        e.stopPropagation();
        this.voiceInput.start('creator');
      });
    }
    if (this.btnVoiceInput) {
      this.btnVoiceInput.addEventListener('click', () => this.voiceInput.start('creator'));
    }
    if (this.btnModalVoiceInput) {
      this.btnModalVoiceInput.addEventListener('click', () => this.voiceInput.start('modal'));
    }

    // Image Input triggers
    if (this.btnAttachImage) {
      this.btnAttachImage.addEventListener('click', () => this.creatorImageInput.click());
    }
    if (this.btnModalAttachImage) {
      this.btnModalAttachImage.addEventListener('click', () => this.modalImageInput.click());
    }

    // Vault lock toggle in modal
    if (this.btnModalLockNote) {
      this.btnModalLockNote.addEventListener('click', () => this.toggleNoteLockInModal());
    }

    // Vault Password Modal events
    if (this.btnConfirmVaultModal) {
      this.btnConfirmVaultModal.addEventListener('click', () => this.confirmVaultUnlock());
    }
    if (this.btnCancelVaultModal) {
      this.btnCancelVaultModal.addEventListener('click', () => {
        this.vaultPasswordModal.classList.add('hidden');
        this.pendingUnlockNote = null;
        this.pendingUnlockCallback = null;
      });
    }
    if (this.vaultPasswordInput) {
      this.vaultPasswordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.confirmVaultUnlock();
      });
    }
    if (this.btnToggleVaultPassVisibility) {
      this.btnToggleVaultPassVisibility.addEventListener('click', () => {
        const isPass = this.vaultPasswordInput.type === 'password';
        this.vaultPasswordInput.type = isPass ? 'text' : 'password';
        this.vaultPassEyeIcon.textContent = isPass ? 'visibility_off' : 'visibility';
      });
    }
  }

  /* Sons Táteis */
  toggleSound() {
    const enabled = this.sound.toggle();
    this.updateSoundUI();
    this.showToast(enabled ? 'Efeitos sonoros ativados' : 'Efeitos sonoros desativados');
  }

  updateSoundUI() {
    if (this.soundIcon) {
      this.soundIcon.textContent = this.sound.enabled ? 'volume_up' : 'volume_off';
      this.btnToggleSound.title = this.sound.enabled ? 'Efeitos sonoros (Ativado)' : 'Efeitos sonoros (Desativado)';
    }
  }

  /* Upload de Imagens & OCR */
  setupMediaAndDragDrop() {
    if (this.creatorImageInput) {
      this.creatorImageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) this.handleImageFile(file, 'creator');
      });
    }

    if (this.modalImageInput) {
      this.modalImageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) this.handleImageFile(file, 'modal');
      });
    }

    if (this.noteCreatorCard) {
      this.noteCreatorCard.addEventListener('dragover', (e) => {
        e.preventDefault();
        this.noteCreatorCard.style.borderColor = 'var(--ai-primary)';
      });
      this.noteCreatorCard.addEventListener('dragleave', () => {
        this.noteCreatorCard.style.borderColor = '';
      });
      this.noteCreatorCard.addEventListener('drop', (e) => {
        e.preventDefault();
        this.noteCreatorCard.style.borderColor = '';
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.expandNoteCreator();
          this.handleImageFile(e.dataTransfer.files[0], 'creator');
        }
      });
    }

    window.addEventListener('paste', (e) => {
      const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          if (this.editingNote) {
            this.handleImageFile(blob, 'modal');
          } else {
            this.expandNoteCreator();
            this.handleImageFile(blob, 'creator');
          }
          break;
        }
      }
    });
  }

  handleImageFile(file, target = 'creator') {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const mimeType = file.type || 'image/jpeg';
      if (target === 'creator') {
        this.newNoteState.image = dataUrl;
        this.newNoteState.imageMime = mimeType;
        this.renderCreatorImagePreview(dataUrl, mimeType);
      } else if (target === 'modal' && this.editingNote) {
        this.editingNote.image = dataUrl;
        this.editingNote.imageMime = mimeType;
        this.renderModalImagePreview(dataUrl, mimeType);
      }
      this.sound.playPop();
    };
    reader.readAsDataURL(file);
  }

  renderCreatorImagePreview(dataUrl, mimeType) {
    this.creatorImagePreviewContainer.innerHTML = `
      <div class="note-image-preview-container">
        <img src="${dataUrl}" class="note-image-preview" alt="Preview da imagem">
        <button class="note-image-remove-btn" title="Remover imagem">
          <span class="material-symbols-outlined" style="font-size:16px;">close</span>
        </button>
        <button class="note-image-ocr-btn" title="Extrair texto da imagem com IA">
          <span class="material-symbols-outlined" style="font-size:16px;">auto_awesome</span>
          Extrair Texto (OCR)
        </button>
      </div>
    `;
    this.creatorImagePreviewContainer.classList.remove('hidden');

    this.creatorImagePreviewContainer.querySelector('.note-image-remove-btn').addEventListener('click', () => {
      this.newNoteState.image = null;
      this.creatorImagePreviewContainer.innerHTML = '';
      this.creatorImagePreviewContainer.classList.add('hidden');
    });

    this.creatorImagePreviewContainer.querySelector('.note-image-ocr-btn').addEventListener('click', async () => {
      await this.runOCR(dataUrl, mimeType, 'creator');
    });
  }

  renderModalImagePreview(dataUrl, mimeType) {
    this.modalImagePreviewContainer.innerHTML = `
      <div class="note-image-preview-container">
        <img src="${dataUrl}" class="note-image-preview" alt="Preview da imagem">
        <button class="note-image-remove-btn" title="Remover imagem">
          <span class="material-symbols-outlined" style="font-size:16px;">close</span>
        </button>
        <button class="note-image-ocr-btn" title="Extrair texto da imagem com IA">
          <span class="material-symbols-outlined" style="font-size:16px;">auto_awesome</span>
          Extrair Texto (OCR)
        </button>
      </div>
    `;
    this.modalImagePreviewContainer.classList.remove('hidden');

    this.modalImagePreviewContainer.querySelector('.note-image-remove-btn').addEventListener('click', () => {
      if (this.editingNote) this.editingNote.image = null;
      this.modalImagePreviewContainer.innerHTML = '';
      this.modalImagePreviewContainer.classList.add('hidden');
    });

    this.modalImagePreviewContainer.querySelector('.note-image-ocr-btn').addEventListener('click', async () => {
      await this.runOCR(dataUrl, mimeType, 'modal');
    });
  }

  async runOCR(dataUrl, mimeType, target) {
    if (!this.ai.hasApiKey()) {
      this.ai.openApiKeyModal();
      this.showToast('Configure sua chave de API para rodar o OCR com IA.');
      return;
    }

    const btn = target === 'creator'
      ? this.creatorImagePreviewContainer.querySelector('.note-image-ocr-btn')
      : this.modalImagePreviewContainer.querySelector('.note-image-ocr-btn');

    if (btn) {
      btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px; animation: spin 1s linear infinite;">sync</span> Extraindo...`;
      btn.disabled = true;
    }

    try {
      this.showToast('Lendo e extraindo texto da imagem com Gemini Vision...');
      const extractedText = await this.ai.performOCR(dataUrl, mimeType);

      if (target === 'creator') {
        this.newNoteContent.value = (this.newNoteContent.value ? this.newNoteContent.value + '\n\n' : '') + extractedText;
      } else if (target === 'modal') {
        this.modalNoteContent.value = (this.modalNoteContent.value ? this.modalNoteContent.value + '\n\n' : '') + extractedText;
      }

      this.sound.playCheck();
      this.showToast('Texto extraído com sucesso pela IA!');
    } catch (err) {
      this.showToast('Erro no OCR: ' + err.message);
    } finally {
      if (btn) {
        btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;">auto_awesome</span> Extrair Texto (OCR)`;
        btn.disabled = false;
      }
    }
  }

  /* Cofre Criptografado (AES-GCM 256) */
  promptUnlockVault(note, onSuccess = null) {
    this.vaultPasswordModal.classList.remove('hidden');
    this.vaultPasswordInput.value = '';
    this.vaultErrorMsg.classList.remove('visible');
    this.vaultPasswordInput.focus();

    this.pendingUnlockNote = note;
    this.pendingUnlockCallback = onSuccess;
  }

  async confirmVaultUnlock() {
    if (!this.pendingUnlockNote) return;
    const password = this.vaultPasswordInput.value.trim();
    if (!password) {
      this.vaultErrorMsg.textContent = 'Por favor, insira a senha mestre.';
      this.vaultErrorMsg.classList.add('visible');
      return;
    }

    try {
      if (this.pendingUnlockNote.encrypted_data) {
        const decrypted = await this.vault.decryptPayload(this.pendingUnlockNote.encrypted_data, password);
        this.vault.sessionCache.set(this.pendingUnlockNote.id, decrypted);
        this.vault.masterPasswordCache = password;
      }
      this.sound.playLock();
      this.vaultPasswordModal.classList.add('hidden');
      this.showToast('Nota descriptografada com sucesso!');

      const callback = this.pendingUnlockCallback;
      const note = this.pendingUnlockNote;
      this.pendingUnlockNote = null;
      this.pendingUnlockCallback = null;

      this.renderNotesGrid();
      if (this.activeView === 'kanban') this.renderKanbanBoard();

      if (callback) {
        callback();
      } else {
        this.openEditModal(note);
      }
    } catch (err) {
      this.vaultErrorMsg.textContent = 'Senha incorreta. Tente novamente.';
      this.vaultErrorMsg.classList.add('visible');
    }
  }

  async toggleNoteLockInModal() {
    if (!this.editingNote) return;

    if (this.editingNote.is_locked) {
      if (confirm('Deseja remover a criptografia e destrancar esta nota?')) {
        this.editingNote.is_locked = false;
        this.editingNote.encrypted_data = null;
        this.vault.sessionCache.delete(this.editingNote.id);
        this.modalLockIcon.textContent = 'lock_open';
        this.modalLockIcon.style.color = '';
        this.btnModalLockNote.title = 'Proteger com Cofre Criptografado (AES-256)';
        this.sound.playLock();
        this.showToast('Proteção por criptografia removida desta nota.');
      }
    } else {
      const pass = prompt('Defina uma senha mestre para criptografar esta nota (AES-GCM 256 bits):', this.vault.masterPasswordCache || '');
      if (!pass || !pass.trim()) return;
      this.vault.masterPasswordCache = pass.trim();
      this.editingNote.is_locked = true;

      const payload = {
        title: this.modalNoteTitle.value.trim(),
        content: this.modalNoteContent.value.trim(),
        checklist_items: this.editingNote.checklist_items || [],
        image: this.editingNote.image || null
      };
      this.editingNote.encrypted_data = await this.vault.encryptPayload(payload, pass.trim());
      this.vault.sessionCache.set(this.editingNote.id, payload);

      this.modalLockIcon.textContent = 'lock';
      this.modalLockIcon.style.color = '#f5a518';
      this.btnModalLockNote.title = 'Nota Criptografada (Clique para remover)';
      this.sound.playLock();
      this.showToast('Nota protegida com criptografia militar AES-256!');
    }
  }

  /* Quadro Kanban Ágil */
  renderKanbanBoard() {
    if (!this.kanbanCardsTodo || !this.kanbanCardsInProgress || !this.kanbanCardsDone) return;
    this.kanbanCardsTodo.innerHTML = '';
    this.kanbanCardsInProgress.innerHTML = '';
    this.kanbanCardsDone.innerHTML = '';

    const activeNotes = this.notes.filter(n => !n.is_trashed);
    let todoNotes = [];
    let inProgressNotes = [];
    let doneNotes = [];

    activeNotes.forEach(note => {
      if (note.is_archived) {
        doneNotes.push(note);
      } else if (note.type === 'checklist' && Array.isArray(note.checklist_items) && note.checklist_items.length > 0) {
        const completed = note.checklist_items.filter(i => i.completed).length;
        const total = note.checklist_items.length;
        if (completed === total) {
          doneNotes.push(note);
        } else if (completed > 0) {
          inProgressNotes.push(note);
        } else {
          todoNotes.push(note);
        }
      } else {
        if (note.labels && note.labels.some(l => l.toLowerCase().includes('concluido') || l.toLowerCase().includes('feito'))) {
          doneNotes.push(note);
        } else if (note.labels && note.labels.some(l => l.toLowerCase().includes('andamento') || l.toLowerCase().includes('progresso'))) {
          inProgressNotes.push(note);
        } else {
          todoNotes.push(note);
        }
      }
    });

    this.kanbanCountTodo.textContent = todoNotes.length;
    this.kanbanCountInProgress.textContent = inProgressNotes.length;
    this.kanbanCountDone.textContent = doneNotes.length;

    const renderColumnCards = (container, list, colKey) => {
      if (list.length === 0) {
        container.innerHTML = `<div class="kanban-column-empty">Nenhuma nota nesta etapa</div>`;
        return;
      }
      list.forEach(note => {
        const card = this.createNoteCardElement(note);
        const navRow = document.createElement('div');
        navRow.style.display = 'flex';
        navRow.style.justifyContent = 'space-between';
        navRow.style.alignItems = 'center';
        navRow.style.padding = '8px 12px';
        navRow.style.borderTop = '1px solid rgba(0,0,0,0.06)';
        navRow.style.fontSize = '12px';

        let moveHtml = '';
        if (colKey === 'todo') {
          moveHtml = `<span></span><button class="btn-kanban-next" style="cursor:pointer; display:flex; align-items:center; gap:4px; color:var(--ai-primary); font-weight:600;">Avançar →</button>`;
        } else if (colKey === 'inprogress') {
          moveHtml = `<button class="btn-kanban-prev" style="cursor:pointer; display:flex; align-items:center; gap:4px; color:var(--text-muted);">← Voltar</button><button class="btn-kanban-next" style="cursor:pointer; display:flex; align-items:center; gap:4px; color:#34a853; font-weight:600;">Concluir ✓</button>`;
        } else {
          moveHtml = `<button class="btn-kanban-prev" style="cursor:pointer; display:flex; align-items:center; gap:4px; color:var(--text-muted);">← Reabrir</button><span></span>`;
        }
        navRow.innerHTML = moveHtml;

        const btnNext = navRow.querySelector('.btn-kanban-next');
        const btnPrev = navRow.querySelector('.btn-kanban-prev');

        if (btnNext) {
          btnNext.addEventListener('click', (e) => {
            e.stopPropagation();
            if (colKey === 'todo') {
              if (note.type === 'checklist' && note.checklist_items.length > 0) {
                note.checklist_items[0].completed = true;
              } else {
                note.labels = note.labels || [];
                note.labels = note.labels.filter(l => !l.toLowerCase().includes('a fazer'));
                note.labels.push('Em Andamento');
              }
            } else if (colKey === 'inprogress') {
              if (note.type === 'checklist') {
                note.checklist_items.forEach(i => i.completed = true);
              } else {
                note.labels = note.labels || [];
                note.labels = note.labels.filter(l => !l.toLowerCase().includes('andamento'));
                note.labels.push('Concluído');
              }
              this.sound.playChime();
            }
            this.storage.saveNote(note);
            this.renderKanbanBoard();
            this.sound.playPop();
          });
        }

        if (btnPrev) {
          btnPrev.addEventListener('click', (e) => {
            e.stopPropagation();
            if (colKey === 'inprogress') {
              if (note.type === 'checklist') {
                note.checklist_items.forEach(i => i.completed = false);
              } else {
                note.labels = note.labels || [];
                note.labels = note.labels.filter(l => !l.toLowerCase().includes('andamento'));
              }
            } else if (colKey === 'done') {
              if (note.type === 'checklist' && note.checklist_items.length > 0) {
                note.checklist_items[0].completed = false;
              }
              note.is_archived = false;
              note.labels = (note.labels || []).filter(l => !l.toLowerCase().includes('conclu'));
            }
            this.storage.saveNote(note);
            this.renderKanbanBoard();
            this.sound.playPop();
          });
        }

        card.appendChild(navRow);
        container.appendChild(card);
      });
    };

    renderColumnCards(this.kanbanCardsTodo, todoNotes, 'todo');
    renderColumnCards(this.kanbanCardsInProgress, inProgressNotes, 'inprogress');
    renderColumnCards(this.kanbanCardsDone, doneNotes, 'done');
  }

  applyTheme(theme) {
    document.body.classList.toggle('theme-dark', theme === 'dark');
    document.body.classList.toggle('theme-light', theme !== 'dark');
    localStorage.setItem('keep_theme', theme);
    this.themeIcon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
  }

  updateViewModeUI() {
    const isList = this.viewMode === 'list';
    this.pinnedGrid.classList.toggle('list-view', isList);
    this.othersGrid.classList.toggle('list-view', isList);
    this.viewModeIcon.textContent = isList ? 'grid_view' : 'view_agenda';
    this.btnToggleView.title = isList ? 'Alternar para exibição em grade' : 'Alternar para exibição em lista';
  }

  switchView(view) {
    this.activeView = view;

    document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
      if (btn.dataset.view === view) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (view === 'ai') {
      this.notesView.classList.add('hidden');
      this.kanbanView.classList.add('hidden');
      this.aiView.classList.remove('hidden');
      this.ai.refreshNotesSelector(this.notes);
    } else if (view === 'kanban') {
      this.notesView.classList.add('hidden');
      this.aiView.classList.add('hidden');
      this.kanbanView.classList.remove('hidden');
      this.renderKanbanBoard();
    } else {
      this.aiView.classList.add('hidden');
      this.kanbanView.classList.add('hidden');
      this.notesView.classList.remove('hidden');

      this.noteCreatorWrapper.classList.toggle('hidden', view === 'trash');
      this.trashBanner.classList.toggle('hidden', view !== 'trash');
      this.archiveBanner.classList.toggle('hidden', view !== 'archive');

      this.renderNotesGrid();
    }
  }

  render() {
    this.renderSidebarLabels();
    this.renderNotesGrid();
    this.updateViewModeUI();
  }

  renderSidebarLabels() {
    this.sidebarLabelsList.innerHTML = '';
    this.labels.forEach(label => {
      const btn = document.createElement('button');
      btn.className = `nav-item ${this.activeView === `label:${label.name}` ? 'active' : ''}`;
      btn.dataset.view = `label:${label.name}`;
      btn.innerHTML = `
        <span class="material-symbols-outlined nav-icon">label</span>
        <span class="nav-label">${this.escapeHtml(label.name)}</span>
      `;
      btn.addEventListener('click', () => this.switchView(`label:${label.name}`));
      this.sidebarLabelsList.appendChild(btn);
    });
  }

  getFilteredNotes() {
    let filtered = [...this.notes];

    // Filtro da View ativa
    if (this.activeView === 'notes') {
      filtered = filtered.filter(n => !n.is_trashed && !n.is_archived);
    } else if (this.activeView === 'vault') {
      filtered = filtered.filter(n => !n.is_trashed && n.is_locked);
    } else if (this.activeView === 'reminders') {
      filtered = filtered.filter(n => !n.is_trashed && !n.is_archived && Boolean(n.reminder));
    } else if (this.activeView === 'archive') {
      filtered = filtered.filter(n => !n.is_trashed && n.is_archived);
    } else if (this.activeView === 'trash') {
      filtered = filtered.filter(n => n.is_trashed);
    } else if (this.activeView.startsWith('label:')) {
      const labelName = this.activeView.replace('label:', '');
      filtered = filtered.filter(n => !n.is_trashed && n.labels && n.labels.includes(labelName));
    }

    // Filtro de Busca por texto
    if (this.searchQuery) {
      filtered = filtered.filter(n => {
        const titleMatch = (n.title || '').toLowerCase().includes(this.searchQuery);
        const contentMatch = (n.content || '').toLowerCase().includes(this.searchQuery);
        const checklistMatch = (n.checklist_items || []).some(i => (i.text || '').toLowerCase().includes(this.searchQuery));
        const labelsMatch = (n.labels || []).some(l => l.toLowerCase().includes(this.searchQuery));
        return titleMatch || contentMatch || checklistMatch || labelsMatch;
      });
    }

    return filtered;
  }

  renderNotesGrid() {
    const notesToDisplay = this.getFilteredNotes();
    this.pinnedGrid.innerHTML = '';
    this.othersGrid.innerHTML = '';

    if (notesToDisplay.length === 0) {
      this.pinnedSection.classList.add('hidden');
      this.othersSection.classList.add('hidden');
      this.emptyState.classList.remove('hidden');

      if (this.activeView === 'trash') {
        this.emptyIcon.textContent = 'delete';
        this.emptyTitle.textContent = 'Nenhuma nota na lixeira';
        this.emptySubtitle.textContent = 'As notas apagadas aparecerão aqui.';
      } else if (this.activeView === 'archive') {
        this.emptyIcon.textContent = 'archive';
        this.emptyTitle.textContent = 'Nenhuma nota arquivada';
        this.emptySubtitle.textContent = 'As notas que você arquivar aparecem aqui.';
      } else if (this.activeView === 'vault') {
        this.emptyIcon.textContent = 'lock';
        this.emptyTitle.textContent = 'Nenhuma nota protegida no cofre';
        this.emptySubtitle.textContent = 'Abra qualquer nota e clique no cadeado para trancá-la com AES-256.';
      } else if (this.searchQuery) {
        this.emptyIcon.textContent = 'search_off';
        this.emptyTitle.textContent = 'Nenhum resultado encontrado';
        this.emptySubtitle.textContent = `Nenhuma nota corresponde à busca "${this.searchQuery}".`;
      } else {
        this.emptyIcon.textContent = 'lightbulb';
        this.emptyTitle.textContent = 'As notas adicionadas são exibidas aqui';
        this.emptySubtitle.textContent = 'Crie sua primeira nota acima!';
      }
      return;
    }

    this.emptyState.classList.add('hidden');
    this.othersSection.classList.remove('hidden');

    const pinnedNotes = notesToDisplay.filter(n => n.is_pinned);
    const otherNotes = notesToDisplay.filter(n => !n.is_pinned);

    if (pinnedNotes.length > 0 && this.activeView === 'notes') {
      this.pinnedSection.classList.remove('hidden');
      this.othersTitle.classList.remove('hidden');
      pinnedNotes.forEach(note => this.pinnedGrid.appendChild(this.createNoteCardElement(note)));
    } else {
      this.pinnedSection.classList.add('hidden');
      this.othersTitle.classList.add('hidden');
    }

    const regularList = (pinnedNotes.length > 0 && this.activeView === 'notes') ? otherNotes : notesToDisplay;
    regularList.forEach(note => this.othersGrid.appendChild(this.createNoteCardElement(note)));
  }

  createNoteCardElement(note) {
    const card = document.createElement('div');
    card.className = `note-card color-${note.color || 'default'}`;
    card.dataset.id = note.id;

    // Se for nota bloqueada e não desbloqueada na sessão atual
    if (note.is_locked && !this.vault.sessionCache.has(note.id)) {
      card.classList.add('is-locked');

      const lockedBanner = document.createElement('div');
      lockedBanner.className = 'locked-card-banner';
      lockedBanner.innerHTML = `
        <div class="locked-icon-shield">
          <span class="material-symbols-outlined">lock</span>
        </div>
        <div class="locked-badge-title">${this.escapeHtml(note.title || 'Nota Protegida')}</div>
        <div class="locked-badge-subtitle">Criptografia Militar AES-256 GCM</div>
        <button class="btn-unlock-card" title="Desbloquear com senha">
          <span class="material-symbols-outlined" style="font-size:16px;">key</span> Desbloquear
        </button>
      `;

      lockedBanner.querySelector('.btn-unlock-card').addEventListener('click', (e) => {
        e.stopPropagation();
        this.promptUnlockVault(note);
      });

      card.appendChild(lockedBanner);
      card.addEventListener('click', () => this.promptUnlockVault(note));
      return card;
    }

    // Dados descriptografados se estiver no cache
    let displayTitle = note.title;
    let displayContent = note.content;
    let displayChecklist = note.checklist_items || [];
    let displayImage = note.image;

    if (note.is_locked && this.vault.sessionCache.has(note.id)) {
      const dec = this.vault.sessionCache.get(note.id);
      displayTitle = dec.title || note.title;
      displayContent = dec.content || '';
      displayChecklist = dec.checklist_items || [];
      displayImage = dec.image || null;
    }

    // Pin Button
    const pinBtn = document.createElement('button');
    pinBtn.className = `icon-btn note-card-pin ${note.is_pinned ? 'pinned' : ''}`;
    pinBtn.title = note.is_pinned ? 'Desafixar nota' : 'Fixar nota';
    pinBtn.innerHTML = `<span class="material-symbols-outlined">push_pin</span>`;
    pinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      note.is_pinned = !note.is_pinned;
      this.sound.playPop();
      this.storage.saveNote(note);
      this.renderNotesGrid();
    });
    card.appendChild(pinBtn);

    // Preview de Imagem no Card
    if (displayImage) {
      const imgContainer = document.createElement('div');
      imgContainer.className = 'note-image-preview-container';
      imgContainer.style.margin = '0 0 8px 0';
      imgContainer.innerHTML = `<img src="${displayImage}" class="note-image-preview" alt="Imagem">`;
      card.appendChild(imgContainer);
    }

    // Título
    if (displayTitle || note.is_locked) {
      const titleEl = document.createElement('div');
      titleEl.className = 'note-card-title';
      titleEl.textContent = displayTitle || 'Nota sem título';
      if (note.is_locked) {
        titleEl.innerHTML += `<span class="material-symbols-outlined" style="font-size:16px; color:#f5a518; vertical-align:middle; margin-left:6px;" title="Protegida por AES-256 (Desbloqueada)">lock_open</span>`;
      }
      card.appendChild(titleEl);
    }

    // Conteúdo (Texto ou Checklist)
    if (note.type === 'checklist' && Array.isArray(displayChecklist) && displayChecklist.length > 0) {
      const checklistContainer = document.createElement('div');
      checklistContainer.className = 'note-card-checklist';

      const uncompleted = displayChecklist.filter(i => !i.completed);
      const completed = displayChecklist.filter(i => i.completed);

      uncompleted.slice(0, 8).forEach(item => {
        const itemRow = document.createElement('div');
        itemRow.className = 'card-check-item';
        itemRow.innerHTML = `
          <input type="checkbox" class="check-box-input">
          <span>${this.escapeHtml(item.text)}</span>
        `;
        const cb = itemRow.querySelector('input');
        cb.addEventListener('click', (e) => {
          e.stopPropagation();
          item.completed = true;
          this.sound.playCheck();
          const allDone = displayChecklist.every(i => i.completed);
          if (allDone) this.sound.playChime();
          this.storage.saveNote(note);
          this.renderNotesGrid();
          if (this.activeView === 'kanban') this.renderKanbanBoard();
        });
        checklistContainer.appendChild(itemRow);
      });

      if (completed.length > 0) {
        const doneBadge = document.createElement('div');
        doneBadge.className = 'completed-badge-count';
        doneBadge.textContent = `+ ${completed.length} ${completed.length === 1 ? 'item marcado' : 'itens marcados'}`;
        checklistContainer.appendChild(doneBadge);
      }

      card.appendChild(checklistContainer);
    } else if (displayContent) {
      const contentEl = document.createElement('div');
      contentEl.className = 'note-card-content';
      contentEl.textContent = displayContent;
      card.appendChild(contentEl);
    }

    // Tags / Marcadores
    if (Array.isArray(note.labels) && note.labels.length > 0) {
      const labelsContainer = document.createElement('div');
      labelsContainer.className = 'card-labels-container';
      note.labels.forEach(lbl => {
        const chip = document.createElement('span');
        chip.className = 'label-chip';
        chip.textContent = lbl;
        labelsContainer.appendChild(chip);
      });
      card.appendChild(labelsContainer);
    }

    // Barra de ações do card
    const actionsBar = document.createElement('div');
    actionsBar.className = 'note-card-actions';

    if (this.activeView === 'trash') {
      actionsBar.innerHTML = `
        <button class="icon-btn card-action-btn btn-restore-note" title="Restaurar nota">
          <span class="material-symbols-outlined">restore_from_trash</span>
        </button>
        <button class="icon-btn card-action-btn btn-perm-delete" title="Excluir definitivamente">
          <span class="material-symbols-outlined">delete_forever</span>
        </button>
      `;

      actionsBar.querySelector('.btn-restore-note').addEventListener('click', (e) => {
        e.stopPropagation();
        note.is_trashed = false;
        this.sound.playPop();
        this.storage.saveNote(note);
        this.renderNotesGrid();
        this.showToast('Nota restaurada');
      });

      actionsBar.querySelector('.btn-perm-delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Excluir esta nota permanentemente?')) {
          this.sound.playSwoosh();
          await this.storage.deleteNote(note.id, true);
          this.notes = this.notes.filter(n => n.id !== note.id);
          this.renderNotesGrid();
          this.showToast('Nota excluída permanentemente');
        }
      });
    } else {
      actionsBar.innerHTML = `
        <div class="popover-wrapper">
          <button class="icon-btn card-action-btn btn-card-color" title="Plano de fundo">
            <span class="material-symbols-outlined">palette</span>
          </button>
          <div class="color-palette-popover hidden"></div>
        </div>

        <button class="icon-btn card-action-btn btn-card-archive" title="${note.is_archived ? 'Desarquivar' : 'Arquivar'}">
          <span class="material-symbols-outlined">${note.is_archived ? 'unarchive' : 'archive'}</span>
        </button>

        <button class="icon-btn card-action-btn btn-card-ai" title="Perguntar à IA sobre esta nota">
          <span class="material-symbols-outlined" style="color:#1a73e8; font-size:18px;">auto_awesome</span>
        </button>

        <button class="icon-btn card-action-btn btn-card-delete" title="Excluir nota">
          <span class="material-symbols-outlined">delete</span>
        </button>
      `;

      const btnColor = actionsBar.querySelector('.btn-card-color');
      const palette = actionsBar.querySelector('.color-palette-popover');
      this.renderColorPalette(palette, (colorId) => {
        note.color = colorId;
        card.className = `note-card color-${colorId}`;
        this.sound.playPop();
        this.storage.saveNote(note);
        palette.classList.add('hidden');
      });

      btnColor.addEventListener('click', (e) => {
        e.stopPropagation();
        palette.classList.toggle('hidden');
      });

      actionsBar.querySelector('.btn-card-archive').addEventListener('click', (e) => {
        e.stopPropagation();
        note.is_archived = !note.is_archived;
        this.sound.playSwoosh();
        this.storage.saveNote(note);
        this.renderNotesGrid();
        this.showToast(note.is_archived ? 'Nota arquivada' : 'Nota desarquivada');
      });

      actionsBar.querySelector('.btn-card-ai').addEventListener('click', (e) => {
        e.stopPropagation();
        this.ai.selectSingleNote(note.id);
        this.switchView('ai');
      });

      actionsBar.querySelector('.btn-card-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteNote(note.id);
      });
    }

    card.appendChild(actionsBar);

    if (this.activeView !== 'trash') {
      card.addEventListener('click', (e) => {
        if (!e.target.closest('button') && !e.target.closest('input')) {
          this.openEditModal(note);
        }
      });
    }

    return card;
  }

  /* Criador de Nota */
  expandNoteCreator(asChecklist = false) {
    this.creatorCollapsed.classList.add('hidden');
    this.creatorExpanded.classList.remove('hidden');
    this.noteCreatorCard.classList.add('expanded');

    if (asChecklist) {
      this.toggleCreatorChecklistMode(true);
      this.newChecklistInput.focus();
    } else {
      this.newNoteContent.focus();
    }
  }

  saveAndCollapseNoteCreator() {
    const title = this.newNoteTitle.value.trim();
    const content = this.newNoteContent.value.trim();
    const hasChecklist = this.newNoteState.isChecklist && this.newNoteState.checklistItems.length > 0;
    const hasImage = Boolean(this.newNoteState.image);

    if (title || content || hasChecklist || hasImage) {
      const newNote = {
        id: 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        title: title,
        content: content,
        type: this.newNoteState.isChecklist ? 'checklist' : 'text',
        checklist_items: this.newNoteState.checklistItems,
        image: this.newNoteState.image || null,
        imageMime: this.newNoteState.imageMime || null,
        color: this.newNoteState.color,
        is_pinned: this.newNoteState.isPinned,
        is_archived: this.newNoteState.isArchived,
        is_trashed: false,
        is_locked: false,
        labels: [...this.newNoteState.labels],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      this.sound.playPop();
      this.notes.unshift(newNote);
      this.storage.saveNote(newNote);
      this.renderNotesGrid();
      if (this.activeView === 'kanban') this.renderKanbanBoard();
    }

    // Resetar campos
    this.newNoteTitle.value = '';
    this.newNoteContent.value = '';
    this.newNoteState = {
      isChecklist: false,
      color: 'default',
      isPinned: false,
      isArchived: false,
      labels: [],
      checklistItems: [],
      image: null,
      imageMime: null
    };
    this.creatorImagePreviewContainer.innerHTML = '';
    this.creatorImagePreviewContainer.classList.add('hidden');
    this.setCreatorColor('default');
    this.toggleCreatorChecklistMode(false);
    this.btnNewNotePin.classList.remove('pinned');
    this.newNoteLabelsList.innerHTML = '';

    this.creatorExpanded.classList.add('hidden');
    this.creatorCollapsed.classList.remove('hidden');
    this.noteCreatorCard.classList.remove('expanded');
  }

  toggleCreatorChecklistMode(forceChecklist = null) {
    this.newNoteState.isChecklist = forceChecklist !== null ? forceChecklist : !this.newNoteState.isChecklist;
    this.creatorTextContentArea.classList.toggle('hidden', this.newNoteState.isChecklist);
    this.creatorChecklistArea.classList.toggle('hidden', !this.newNoteState.isChecklist);
  }

  addCreatorChecklistItem(text) {
    const item = {
      id: 'chk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      text: text,
      completed: false
    };
    this.newNoteState.checklistItems.push(item);
    this.renderCreatorChecklistItems();
    this.sound.playPop();
  }

  renderCreatorChecklistItems() {
    this.newNoteChecklistItems.innerHTML = '';
    this.newNoteState.checklistItems.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'checklist-item-row';
      row.innerHTML = `
        <input type="checkbox" class="check-box-input" ${item.completed ? 'checked' : ''}>
        <span class="checklist-text ${item.completed ? 'completed' : ''}">${this.escapeHtml(item.text)}</span>
        <button class="icon-btn checklist-remove-btn" title="Remover item">
          <span class="material-symbols-outlined" style="font-size:18px;">close</span>
        </button>
      `;

      row.querySelector('input').addEventListener('change', (e) => {
        item.completed = e.target.checked;
        this.sound.playCheck();
        this.renderCreatorChecklistItems();
      });

      row.querySelector('.checklist-remove-btn').addEventListener('click', () => {
        this.newNoteState.checklistItems.splice(index, 1);
        this.renderCreatorChecklistItems();
      });

      this.newNoteChecklistItems.appendChild(row);
    });
  }

  setCreatorColor(colorId) {
    this.newNoteState.color = colorId;
    this.noteCreatorCard.className = `note-creator-card expanded color-${colorId}`;
  }

  renderCreatorLabels() {
    this.newNoteLabelsList.innerHTML = '';
    this.newNoteState.labels.forEach(lbl => {
      const chip = document.createElement('span');
      chip.className = 'label-chip';
      chip.innerHTML = `
        ${this.escapeHtml(lbl)}
        <span class="material-symbols-outlined label-chip-remove">close</span>
      `;
      chip.querySelector('.label-chip-remove').addEventListener('click', () => {
        this.newNoteState.labels = this.newNoteState.labels.filter(l => l !== lbl);
        this.renderCreatorLabels();
      });
      this.newNoteLabelsList.appendChild(chip);
    });
  }

  /* Modal de Edição */
  openEditModal(note) {
    if (note.is_locked && !this.vault.sessionCache.has(note.id)) {
      this.promptUnlockVault(note, () => this.openEditModal(note));
      return;
    }

    this.editingNote = { ...note };

    let displayTitle = note.title || '';
    let displayContent = note.content || '';
    let displayChecklist = note.checklist_items || [];
    let displayImage = note.image || null;

    if (note.is_locked && this.vault.sessionCache.has(note.id)) {
      const dec = this.vault.sessionCache.get(note.id);
      displayTitle = dec.title || note.title || '';
      displayContent = dec.content || '';
      displayChecklist = dec.checklist_items || [];
      displayImage = dec.image || null;
    }

    this.modalNoteTitle.value = displayTitle;
    this.modalNoteContent.value = displayContent;
    this.editingNote.checklist_items = displayChecklist;
    this.editingNote.image = displayImage;

    this.btnModalPin.classList.toggle('pinned', Boolean(note.is_pinned));
    this.modalCard.className = `modal-dialog note-modal-card color-${note.color || 'default'}`;

    // Atualizar ícone de bloqueio
    if (this.modalLockIcon) {
      this.modalLockIcon.textContent = note.is_locked ? 'lock' : 'lock_open';
      this.modalLockIcon.style.color = note.is_locked ? '#f5a518' : '';
      this.btnModalLockNote.title = note.is_locked ? 'Nota Criptografada (Clique para remover proteção)' : 'Proteger com Cofre Criptografado (AES-256)';
    }

    // Preview de Imagem
    if (displayImage) {
      this.renderModalImagePreview(displayImage, note.imageMime || 'image/jpeg');
    } else {
      this.modalImagePreviewContainer.innerHTML = '';
      this.modalImagePreviewContainer.classList.add('hidden');
    }

    const isChecklist = note.type === 'checklist';
    this.modalTextBody.classList.toggle('hidden', isChecklist);
    this.modalChecklistBody.classList.toggle('hidden', !isChecklist);

    if (isChecklist) {
      this.renderModalChecklistItems();
    }

    this.renderModalLabels();
    this.editNoteModal.classList.remove('hidden');
  }

  async closeEditModal(save = true) {
    if (save && this.editingNote) {
      this.editingNote.title = this.modalNoteTitle.value.trim();
      if (this.editingNote.type !== 'checklist') {
        this.editingNote.content = this.modalNoteContent.value.trim();
      }

      // Se for uma nota protegida pelo cofre, re-criptografa antes de salvar
      if (this.editingNote.is_locked) {
        const pass = this.vault.masterPasswordCache || 'notekeep_vault';
        const payload = {
          title: this.editingNote.title,
          content: this.editingNote.content,
          checklist_items: this.editingNote.checklist_items || [],
          image: this.editingNote.image || null
        };
        this.editingNote.encrypted_data = await this.vault.encryptPayload(payload, pass);
        this.vault.sessionCache.set(this.editingNote.id, payload);

        // Oculta corpo e checklist puros para não persistir texto legível
        this.editingNote.content = '';
        this.editingNote.checklist_items = [];
        this.editingNote.image = null;
      }

      this.editingNote.updated_at = new Date().toISOString();
      const index = this.notes.findIndex(n => n.id === this.editingNote.id);
      if (index >= 0) {
        this.notes[index] = { ...this.editingNote };
        this.storage.saveNote(this.editingNote);
        this.renderNotesGrid();
        if (this.activeView === 'kanban') this.renderKanbanBoard();
      }
    }
    this.editingNote = null;
    this.editNoteModal.classList.add('hidden');
  }

  toggleModalChecklistMode() {
    if (!this.editingNote) return;
    const isNowChecklist = this.editingNote.type !== 'checklist';
    this.editingNote.type = isNowChecklist ? 'checklist' : 'text';

    if (isNowChecklist) {
      const lines = (this.modalNoteContent.value || '').split('\n').filter(l => l.trim());
      this.editingNote.checklist_items = lines.map(text => ({
        id: 'chk_' + Math.random().toString(36).substr(2, 4),
        text: text,
        completed: false
      }));
      this.renderModalChecklistItems();
    }

    this.modalTextBody.classList.toggle('hidden', isNowChecklist);
    this.modalChecklistBody.classList.toggle('hidden', !isNowChecklist);
  }

  addModalChecklistItem(text) {
    if (!this.editingNote) return;
    this.editingNote.checklist_items = this.editingNote.checklist_items || [];
    this.editingNote.checklist_items.push({
      id: 'chk_' + Date.now(),
      text: text,
      completed: false
    });
    this.renderModalChecklistItems();
  }

  renderModalChecklistItems() {
    this.modalChecklistItems.innerHTML = '';
    (this.editingNote.checklist_items || []).forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'checklist-item-row';
      row.innerHTML = `
        <input type="checkbox" class="check-box-input" ${item.completed ? 'checked' : ''}>
        <span class="checklist-text ${item.completed ? 'completed' : ''}">${this.escapeHtml(item.text)}</span>
        <button class="icon-btn checklist-remove-btn">
          <span class="material-symbols-outlined" style="font-size:18px;">close</span>
        </button>
      `;

      row.querySelector('input').addEventListener('change', (e) => {
        item.completed = e.target.checked;
        this.renderModalChecklistItems();
      });

      row.querySelector('.checklist-remove-btn').addEventListener('click', () => {
        this.editingNote.checklist_items.splice(index, 1);
        this.renderModalChecklistItems();
      });

      this.modalChecklistItems.appendChild(row);
    });
  }

  renderModalLabels() {
    this.modalLabelsList.innerHTML = '';
    (this.editingNote.labels || []).forEach(lbl => {
      const chip = document.createElement('span');
      chip.className = 'label-chip';
      chip.innerHTML = `
        ${this.escapeHtml(lbl)}
        <span class="material-symbols-outlined label-chip-remove">close</span>
      `;
      chip.querySelector('.label-chip-remove').addEventListener('click', () => {
        this.editingNote.labels = this.editingNote.labels.filter(l => l !== lbl);
        this.renderModalLabels();
      });
      this.modalLabelsList.appendChild(chip);
    });
  }

  /* Excluir Nota */
  deleteNote(noteId) {
    const note = this.notes.find(n => n.id === noteId);
    if (!note) return;

    this.lastDeletedNote = { ...note };
    note.is_trashed = true;
    note.is_pinned = false;
    this.storage.deleteNote(noteId, false);
    this.renderNotesGrid();
    this.showToast('Nota movida para a lixeira', true);
  }

  /* Criar Nota a partir da resposta da IA */
  createNoteFromAI(title, content) {
    const newNote = {
      id: 'ai_note_' + Date.now(),
      title: title,
      content: content,
      type: 'text',
      checklist_items: [],
      color: 'dusk',
      is_pinned: false,
      is_archived: false,
      is_trashed: false,
      labels: ['Ideias'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.notes.unshift(newNote);
    this.storage.saveNote(newNote);
    this.showToast('Nota criada pela IA salva no NoteKeep!');
  }

  /* Paleta de Cores Helper */
  renderColorPalette(container, onSelect) {
    container.innerHTML = '';
    KEEP_COLORS.forEach(c => {
      const swatch = document.createElement('div');
      swatch.className = `color-swatch color-${c.id}`;
      swatch.title = c.name;
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelect(c.id);
      });
      container.appendChild(swatch);
    });
  }

  /* Seletor de Marcadores Helper */
  renderLabelPicker(container, selectedLabels, onToggle) {
    container.innerHTML = '';
    if (this.labels.length === 0) {
      container.innerHTML = '<div style="font-size:12px; color:var(--text-muted);">Nenhum marcador criado.</div>';
      return;
    }
    this.labels.forEach(lbl => {
      const item = document.createElement('div');
      item.className = 'label-picker-item';
      const isChecked = selectedLabels.includes(lbl.name);
      item.innerHTML = `
        <input type="checkbox" class="check-box-input" ${isChecked ? 'checked' : ''}>
        <span>${this.escapeHtml(lbl.name)}</span>
      `;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        onToggle(lbl.name);
      });
      container.appendChild(item);
    });
  }

  /* Modal de Marcadores */
  openLabelsModal() {
    this.renderExistingLabelsList();
    this.labelsModal.classList.remove('hidden');
    this.newLabelInput.focus();
  }

  closeLabelsModal() {
    this.labelsModal.classList.add('hidden');
    this.renderSidebarLabels();
    this.renderNotesGrid();
  }

  saveNewLabelFromModal() {
    const name = this.newLabelInput.value.trim();
    if (!name) return;

    if (this.labels.some(l => l.name.toLowerCase() === name.toLowerCase())) {
      alert('Marcador com este nome já existe!');
      return;
    }

    const newLbl = { id: 'lbl_' + Date.now(), name: name };
    this.labels.push(newLbl);
    this.storage.saveLabels(this.labels);
    this.newLabelInput.value = '';
    this.renderExistingLabelsList();
    this.renderSidebarLabels();
  }

  renderExistingLabelsList() {
    this.existingLabelsList.innerHTML = '';
    this.labels.forEach(lbl => {
      const row = document.createElement('div');
      row.className = 'label-manage-item';
      row.innerHTML = `
        <button class="icon-btn delete-lbl-btn" title="Excluir marcador">
          <span class="material-symbols-outlined" style="font-size:18px;">delete</span>
        </button>
        <input type="text" value="${this.escapeHtml(lbl.name)}">
        <button class="icon-btn save-lbl-btn" title="Renomear marcador">
          <span class="material-symbols-outlined" style="font-size:18px;">check</span>
        </button>
      `;

      const input = row.querySelector('input');
      row.querySelector('.save-lbl-btn').addEventListener('click', () => {
        const val = input.value.trim();
        if (val && val !== lbl.name) {
          const oldName = lbl.name;
          lbl.name = val;
          // Atualizar nas notas
          this.notes.forEach(n => {
            if (n.labels && n.labels.includes(oldName)) {
              n.labels = n.labels.map(l => l === oldName ? val : l);
              this.storage.saveNote(n);
            }
          });
          this.storage.saveLabels(this.labels);
          this.renderSidebarLabels();
          this.showToast('Marcador atualizado');
        }
      });

      row.querySelector('.delete-lbl-btn').addEventListener('click', () => {
        this.labels = this.labels.filter(l => l.id !== lbl.id);
        this.storage.saveLabels(this.labels);
        this.renderExistingLabelsList();
        this.renderSidebarLabels();
      });

      this.existingLabelsList.appendChild(row);
    });
  }

  /* Snackbar Toast */
  showToast(message, canUndo = false) {
    this.snackbarMessage.textContent = message;
    this.snackbarAction.classList.toggle('hidden', !canUndo);
    this.snackbar.classList.remove('hidden');

    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.snackbar.classList.add('hidden');
    }, 4500);
  }

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

// Inicializar aplicação
window.addEventListener('DOMContentLoaded', () => {
  window.App = new NoteKeepApp();
  window.App.init();
});
