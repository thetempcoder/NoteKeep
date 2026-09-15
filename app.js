/**
 * ==========================================================
 * NOTEKEEP - CORE APPLICATION ENGINE
 * ==========================================================
 */

const KEEP_COLORS = [
  { id: 'default', name: 'PadrÃ£o', light: '#ffffff', dark: '#202124' },
  { id: 'coral',   name: 'Coral',   light: '#faafa8', dark: '#77172e' },
  { id: 'peach',   name: 'PÃªssego', light: '#f39f76', dark: '#692b17' },
  { id: 'sand',    name: 'Areia',   light: '#fff8b8', dark: '#7c4a03' },
  { id: 'mint',    name: 'Menta',   light: '#e2f6d3', dark: '#264d3b' },
  { id: 'sage',    name: 'SÃ¡lvia',  light: '#b4ddd3', dark: '#0c625d' },
  { id: 'fog',     name: 'NÃ©voa',   light: '#d4e4ed', dark: '#256377' },
  { id: 'storm',   name: 'Tempestade', light: '#aeccdc', dark: '#284255' },
  { id: 'dusk',    name: 'CrepÃºsculo', light: '#d3bfdb', dark: '#472e5b' },
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
      const res = await fetch('api/notes.php', { method: 'GET', cache: 'no-store' });
      if (res.ok) {
        this.backendMode = 'api';
        console.log('âœ… Conectado ao Backend PHP com SQLite');
      } else {
        throw new Error('API indisponÃ­vel');
      }
    } catch (e) {
      this.backendMode = 'local';
      console.log('âš¡ Utilizando Armazenamento Local (Navegador)');
    }
  }

  async getNotes() {
    if (this.backendMode === 'api') {
      try {
        const res = await fetch('api/notes.php');
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn('Fallback para LocalStorage devido a falha de conexÃ£o na API');
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
      // Sincronizar via API se necessÃ¡rio
    }
    localStorage.setItem(this.labelsStorageKey, JSON.stringify(labels));
  }

  getDefaultSeedNotes() {
    const defaultNotes = [
      {
        id: 'seed_1',
        title: 'Bem-vindo ao seu NoteKeep! ðŸ’¡',
        content: 'Este aplicativo foi desenvolvido com alta fidelidade visual:\n\nâ€¢ Crie notas de texto ou listas com caixas de seleÃ§Ã£o.\nâ€¢ Alterne entre temas Claro e Escuro.\nâ€¢ Escolha entre as 11 cores originais.\nâ€¢ Use a busca em tempo real no topo.\nâ€¢ Fixe notas importantes para ficarem sempre visÃ­veis.',
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
        title: 'Assistente de IA Integrado âœ¨',
        content: 'VocÃª pode selecionar qualquer uma das suas notas e conversar com a inteligÃªncia artificial pelo AI Studio!\n\n1. Clique na aba "IA" no menu lateral.\n2. Insira sua chave de API gratuita do AI Studio.\n3. PeÃ§a resumos, planos de aÃ§Ã£o ou novas ideias.\n4. Salve a resposta diretamente como uma nova nota no NoteKeep!',
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
          { id: 'c1', text: 'Testar criaÃ§Ã£o de notas coloridas', completed: true },
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

class NoteKeepApp {
  constructor() {
    this.storage = new StorageAdapter();
    this.notes = [];
    this.labels = [];
    this.activeView = 'notes'; // 'notes', 'reminders', 'archive', 'trash', 'ai', 'label:<name>'
    this.searchQuery = '';
    this.viewMode = 'grid'; // 'grid' | 'list'
    this.theme = localStorage.getItem('keep_theme') || 'light';
    this.lastDeletedNote = null;

    // Estado do criador de nota
    this.newNoteState = {
      isChecklist: false,
      color: 'default',
      isPinned: false,
      isArchived: false,
      labels: [],
      checklistItems: []
    };

    // Estado do modal de ediÃ§Ã£o
    this.editingNote = null;
  }

  async init() {
    this.applyTheme(this.theme);
    await this.storage.init();
    this.notes = await this.storage.getNotes();
    this.labels = await this.storage.getLabels();

    this.ai = new AIService();

    this.cacheDom();
    this.bindEvents();
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

    // Alternar exibiÃ§Ã£o lista / grade
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

    // NavegaÃ§Ã£o Sidebar
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
      if (confirm('Tem certeza que deseja esvaziar a lixeira? Todas as notas serÃ£o excluÃ­das permanentemente.')) {
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
      this.showToast(this.newNoteState.isArchived ? 'Nota serÃ¡ arquivada ao salvar' : 'Nota desmarcada para arquivo');
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

    // Modal de EdiÃ§Ã£o
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
  }

  applyTheme(theme) {
    document.body.className = theme === 'dark' ? 'theme-dark' : 'theme-light';
    localStorage.setItem('keep_theme', theme);
    if (this.themeIcon) {
      this.themeIcon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
    }
  }

  updateViewModeUI() {
    this.pinnedGrid.className = `notes-grid ${this.viewMode === 'list' ? 'list-view' : ''}`;
    this.othersGrid.className = `notes-grid ${this.viewMode === 'list' ? 'list-view' : ''}`;
    this.viewModeIcon.textContent = this.viewMode === 'list' ? 'grid_view' : 'view_agenda';
    this.btnToggleView.title = this.viewMode === 'list' ? 'Alternar para exibiÃ§Ã£o em grade' : 'Alternar para exibiÃ§Ã£o em lista';
  }

  switchView(view) {
    this.activeView = view;

    // Atualizar classe active nos itens da sidebar
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
      if (btn.dataset.view === view) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (view === 'ai') {
      this.notesView.classList.add('hidden');
      this.aiView.classList.remove('hidden');
      this.ai.refreshNotesSelector(this.notes);
    } else {
      this.aiView.classList.add('hidden');
      this.notesView.classList.remove('hidden');

      // Ocultar/Exibir barra do criador de nota na Lixeira ou Arquivo
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

      // Atualizar mensagens de empty state dependendo da view
      if (this.activeView === 'trash') {
        this.emptyIcon.textContent = 'delete';
        this.emptyTitle.textContent = 'Nenhuma nota na lixeira';
        this.emptySubtitle.textContent = 'As notas apagadas aparecerÃ£o aqui.';
      } else if (this.activeView === 'archive') {
        this.emptyIcon.textContent = 'archive';
        this.emptyTitle.textContent = 'Nenhuma nota arquivada';
        this.emptySubtitle.textContent = 'As notas que vocÃª arquivar aparecem aqui.';
      } else if (this.searchQuery) {
        this.emptyIcon.textContent = 'search_off';
        this.emptyTitle.textContent = 'Nenhum resultado encontrado';
        this.emptySubtitle.textContent = `Nenhuma nota corresponde Ã  busca "${this.searchQuery}".`;
      } else {
        this.emptyIcon.textContent = 'lightbulb';
        this.emptyTitle.textContent = 'As notas adicionadas sÃ£o exibidas aqui';
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

    // Pin Button
    const pinBtn = document.createElement('button');
    pinBtn.className = `icon-btn note-card-pin ${note.is_pinned ? 'pinned' : ''}`;
    pinBtn.title = note.is_pinned ? 'Desafixar nota' : 'Fixar nota';
    pinBtn.innerHTML = `<span class="material-symbols-outlined">push_pin</span>`;
    pinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      note.is_pinned = !note.is_pinned;
      this.storage.saveNote(note);
      this.renderNotesGrid();
    });
    card.appendChild(pinBtn);

    // TÃ­tulo
    if (note.title) {
      const titleEl = document.createElement('div');
      titleEl.className = 'note-card-title';
      titleEl.textContent = note.title;
      card.appendChild(titleEl);
    }

    // ConteÃºdo (Texto ou Checklist)
    if (note.type === 'checklist' && Array.isArray(note.checklist_items) && note.checklist_items.length > 0) {
      const checklistContainer = document.createElement('div');
      checklistContainer.className = 'note-card-checklist';

      const uncompleted = note.checklist_items.filter(i => !i.completed);
      const completed = note.checklist_items.filter(i => i.completed);

      // Mostrar itens nÃ£o marcados
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
          this.storage.saveNote(note);
          this.renderNotesGrid();
        });
        checklistContainer.appendChild(itemRow);
      });

      // Contagem de concluÃ­dos
      if (completed.length > 0) {
        const doneBadge = document.createElement('div');
        doneBadge.className = 'completed-badge-count';
        doneBadge.textContent = `+ ${completed.length} ${completed.length === 1 ? 'item marcado' : 'itens marcados'}`;
        checklistContainer.appendChild(doneBadge);
      }

      card.appendChild(checklistContainer);
    } else if (note.content) {
      const contentEl = document.createElement('div');
      contentEl.className = 'note-card-content';
      contentEl.textContent = note.content;
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

    // Barra de aÃ§Ãµes do card
    const actionsBar = document.createElement('div');
    actionsBar.className = 'note-card-actions';

    if (this.activeView === 'trash') {
      // AÃ§Ãµes na Lixeira: Restaurar ou Excluir Definitivamente
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
        this.storage.saveNote(note);
        this.renderNotesGrid();
        this.showToast('Nota restaurada');
      });

      actionsBar.querySelector('.btn-perm-delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Excluir esta nota permanentemente?')) {
          await this.storage.deleteNote(note.id, true);
          this.notes = this.notes.filter(n => n.id !== note.id);
          this.renderNotesGrid();
          this.showToast('Nota excluÃ­da permanentemente');
        }
      });
    } else {
      // AÃ§Ãµes normais de nota
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

      // Popover de cores do card
      const btnColor = actionsBar.querySelector('.btn-card-color');
      const palette = actionsBar.querySelector('.color-palette-popover');
      this.renderColorPalette(palette, (colorId) => {
        note.color = colorId;
        card.className = `note-card color-${colorId}`;
        this.storage.saveNote(note);
        palette.classList.add('hidden');
      });

      btnColor.addEventListener('click', (e) => {
        e.stopPropagation();
        palette.classList.toggle('hidden');
      });

      // Arquivar / Desarquivar
      actionsBar.querySelector('.btn-card-archive').addEventListener('click', (e) => {
        e.stopPropagation();
        note.is_archived = !note.is_archived;
        this.storage.saveNote(note);
        this.renderNotesGrid();
        this.showToast(note.is_archived ? 'Nota arquivada' : 'Nota desarquivada');
      });

      // IA direto desta nota
      actionsBar.querySelector('.btn-card-ai').addEventListener('click', (e) => {
        e.stopPropagation();
        this.ai.selectSingleNote(note.id);
        this.switchView('ai');
      });

      // Deletar (Lixeira)
      actionsBar.querySelector('.btn-card-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteNote(note.id);
      });
    }

    card.appendChild(actionsBar);

    // Clicar no cartÃ£o abre o modal de ediÃ§Ã£o (exceto na lixeira)
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

    if (title || content || hasChecklist) {
      const newNote = {
        id: 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        title: title,
        content: content,
        type: this.newNoteState.isChecklist ? 'checklist' : 'text',
        checklist_items: this.newNoteState.checklistItems,
        color: this.newNoteState.color,
        is_pinned: this.newNoteState.isPinned,
        is_archived: this.newNoteState.isArchived,
        is_trashed: false,
        labels: [...this.newNoteState.labels],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      this.notes.unshift(newNote);
      this.storage.saveNote(newNote);
      this.renderNotesGrid();
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
      checklistItems: []
    };
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

  /* Modal de EdiÃ§Ã£o */
  openEditModal(note) {
    this.editingNote = { ...note };
    this.modalNoteTitle.value = note.title || '';
    this.modalNoteContent.value = note.content || '';
    this.btnModalPin.classList.toggle('pinned', Boolean(note.is_pinned));
    this.modalCard.className = `modal-dialog note-modal-card color-${note.color || 'default'}`;

    const isChecklist = note.type === 'checklist';
    this.modalTextBody.classList.toggle('hidden', isChecklist);
    this.modalChecklistBody.classList.toggle('hidden', !isChecklist);

    if (isChecklist) {
      this.renderModalChecklistItems();
    }

    this.renderModalLabels();
    this.editNoteModal.classList.remove('hidden');
  }

  closeEditModal(save = true) {
    if (save && this.editingNote) {
      this.editingNote.title = this.modalNoteTitle.value.trim();
      if (this.editingNote.type !== 'checklist') {
        this.editingNote.content = this.modalNoteContent.value.trim();
      }

      this.editingNote.updated_at = new Date().toISOString();
      const index = this.notes.findIndex(n => n.id === this.editingNote.id);
      if (index >= 0) {
        this.notes[index] = { ...this.editingNote };
        this.storage.saveNote(this.editingNote);
        this.renderNotesGrid();
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
    this.showToast('Nota criada pela IA salva no NoteKeep! ✨');
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
      alert('Marcador com este nome jÃ¡ existe!');
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

// Inicializar aplicaÃ§Ã£o
window.addEventListener('DOMContentLoaded', () => {
  window.App = new NoteKeepApp();
  window.App.init();
});


