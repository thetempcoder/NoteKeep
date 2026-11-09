/**
 * ==========================================================
 * NOTEKEEP - RECURSOS EXTRAS
 * Estudo com IA (resumo + flashcards), lembretes com notificação,
 * compartilhamento por link/QR Code, exportação Markdown/PDF,
 * reordenação por arrastar e soltar, atalhos de teclado e animações.
 * ==========================================================
 */

const NK_ORDER_KEY = 'notekeep_order';
const NK_FIRED_KEY = 'notekeep_reminders_fired';
const NK_HINT_KEY = 'notekeep_shortcuts_hint_seen';
const NK_QR_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';

const NK_SHORTCUTS = [
  { group: 'Geral', items: [
    { keys: ['Ctrl', 'K'], desc: 'Paleta de comandos' },
    { keys: ['?'], desc: 'Mostrar estes atalhos' },
    { keys: ['/'], desc: 'Pesquisar notas' },
    { keys: ['T'], desc: 'Alternar tema (claro / escuro / automático)' },
    { keys: ['Esc'], desc: 'Fechar janela aberta' }
  ]},
  { group: 'Criar', items: [
    { keys: ['N'], desc: 'Nova nota' },
    { keys: ['L'], desc: 'Nova lista (checklist)' },
    { keys: ['E'], desc: 'Estudar com IA (resumo e flashcards)' }
  ]},
  { group: 'Navegar', items: [
    { keys: ['G', 'N'], desc: 'Ir para Notas' },
    { keys: ['G', 'K'], desc: 'Ir para o Quadro Kanban' },
    { keys: ['G', 'C'], desc: 'Ir para o Cofre Seguro' },
    { keys: ['G', 'L'], desc: 'Ir para Lembretes' },
    { keys: ['G', 'I'], desc: 'Ir para o Assistente IA' }
  ]},
  { group: 'Na nota aberta', items: [
    { keys: ['Ctrl', 'Enter'], desc: 'Salvar e fechar' },
    { keys: ['Ctrl', 'Shift', 'S'], desc: 'Compartilhar (link / QR Code)' },
    { keys: ['Ctrl', 'Shift', 'L'], desc: 'Adicionar lembrete' }
  ]},
  { group: 'Flashcards', items: [
    { keys: ['Espaço'], desc: 'Virar o cartão' },
    { keys: ['←', '→'], desc: 'Cartão anterior / próximo', sep: '/' }
  ]}
];

/* ---------- utilitários ---------- */

function nkEscape(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function nkBytesToBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function nkBase64UrlToBytes(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function nkPipe(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** Codifica uma nota para caber num link (compacta com deflate quando o navegador suporta). */
async function nkEncodeShare(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  if (typeof CompressionStream !== 'undefined') {
    try {
      return 'z' + nkBytesToBase64Url(await nkPipe(bytes, new CompressionStream('deflate-raw')));
    } catch (e) { /* cai para o formato simples */ }
  }
  return 'p' + nkBytesToBase64Url(bytes);
}

async function nkDecodeShare(code) {
  const kind = code[0];
  let bytes = nkBase64UrlToBytes(code.slice(1));
  if (kind === 'z') bytes = await nkPipe(bytes, new DecompressionStream('deflate-raw'));
  else if (kind !== 'p') throw new Error('Formato de link desconhecido');
  return JSON.parse(new TextDecoder().decode(bytes));
}

function nkSlug(str) {
  return (str || 'nota').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'nota';
}

function nkFormatWhen(date) {
  const d = new Date(date);
  const now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `Hoje, ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Amanhã, ${time}`;
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}, ${time}`;
}

function nkToLocalInput(date) {
  const d = new Date(date);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nkReduceMotion() {
  return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/* ==========================================================
   CLASSE PRINCIPAL
   ========================================================== */
class NoteKeepExtras {
  constructor(app) {
    this.app = app;
    this.order = this.loadJson(NK_ORDER_KEY, []);
    this.fired = new Set(this.loadJson(NK_FIRED_KEY, []));
    this.renderedIds = new Set();
    this.lastRenderedView = null;
    this.drag = null;
    this.pendingG = false;
    this.flashcards = [];
    this.flashIndex = 0;
    this.studyBusy = false;
    this.lastSummary = '';
    this.shareMode = 'link';
    this.shareLink = '';
    this.shareText = '';

    this.injectDom();
    this.bindEvents();
    this.wrapSound();
    this.startReminderLoop();
    this.handleIncomingShare();
    this.showShortcutHintOnce();
  }

  loadJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (e) { return fallback; }
  }

  saveJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* armazenamento indisponível */ }
  }

  $(id) { return document.getElementById(id); }

  /* ---------- DOM ---------- */
  injectDom() {
    // Menu "mais opções" na barra do modal da nota
    const tools = document.querySelector('#editNoteModal .modal-tools');
    const aiBtn = this.$('btnModalAskAi');
    if (tools) {
      const wrap = document.createElement('div');
      wrap.className = 'popover-wrapper';
      wrap.innerHTML = `
        <button class="icon-btn tool-btn" id="btnModalMore" title="Mais opções (lembrete, compartilhar, exportar)">
          <span class="material-symbols-outlined">more_vert</span>
        </button>
        <div class="nk-menu hidden" id="modalMoreMenu" role="menu">
          <button class="nk-menu-item" data-action="reminder" role="menuitem">
            <span class="material-symbols-outlined">add_alert</span> Adicionar lembrete
            <kbd>Ctrl Shift L</kbd>
          </button>
          <button class="nk-menu-item" data-action="share" role="menuitem">
            <span class="material-symbols-outlined">qr_code_2</span> Compartilhar (link / QR)
            <kbd>Ctrl Shift S</kbd>
          </button>
          <div class="nk-menu-divider"></div>
          <button class="nk-menu-item" data-action="md" role="menuitem">
            <span class="material-symbols-outlined">description</span> Exportar Markdown (.md)
          </button>
          <button class="nk-menu-item" data-action="pdf" role="menuitem">
            <span class="material-symbols-outlined">picture_as_pdf</span> Exportar PDF
          </button>
        </div>`;
      tools.insertBefore(wrap, aiBtn ? aiBtn.nextSibling : null);
    }

    // Chip de lembrete dentro do modal da nota
    const labels = this.$('modalLabelsList');
    if (labels) {
      const chip = document.createElement('div');
      chip.id = 'modalReminderRow';
      chip.className = 'nk-reminder-row hidden';
      labels.parentNode.insertBefore(chip, labels.nextSibling);
    }

    // Botão "Estudar com IA" no cabeçalho do assistente
    const aiActions = document.querySelector('.ai-header-actions');
    if (aiActions) {
      const btn = document.createElement('button');
      btn.id = 'btnOpenStudy';
      btn.className = 'nk-study-cta';
      btn.title = 'Gerar resumo e flashcards das notas (atalho: E)';
      btn.innerHTML = `<span class="material-symbols-outlined">school</span> Estudar com IA`;
      aiActions.insertBefore(btn, aiActions.firstChild);
    }

    // Item "Estudar" na barra lateral
    const navAi = this.$('navAi');
    if (navAi) {
      const nav = document.createElement('button');
      nav.className = 'nav-item';
      nav.id = 'navStudy';
      nav.innerHTML = `
        <span class="material-symbols-outlined nav-icon">school</span>
        <span class="nav-label">Estudar com IA</span>`;
      navAi.parentNode.insertBefore(nav, navAi.nextSibling);
    }

    // Botão de atalhos na barra superior
    const themeBtn = this.$('btnToggleTheme');
    if (themeBtn) {
      const kb = document.createElement('button');
      kb.id = 'btnShortcuts';
      kb.className = 'icon-btn';
      kb.title = 'Atalhos de teclado (?)';
      kb.innerHTML = `<span class="material-symbols-outlined">keyboard</span>`;
      themeBtn.parentNode.insertBefore(kb, themeBtn.nextSibling);
    }

    const host = document.createElement('div');
    host.innerHTML = `
      <!-- Lembrete -->
      <div class="modal-backdrop hidden nk-modal" id="reminderModal">
        <div class="modal-dialog nk-dialog nk-dialog-sm" role="dialog" aria-labelledby="reminderTitle">
          <div class="nk-dialog-head">
            <span class="material-symbols-outlined nk-bell">notifications_active</span>
            <h3 id="reminderTitle">Lembrete</h3>
          </div>
          <p class="nk-muted">Você recebe uma notificação do navegador no horário escolhido — mesmo com o app em outra aba.</p>
          <div class="nk-chip-row" id="reminderQuick">
            <button class="btn-chip" data-min="1">Em 1 minuto</button>
            <button class="btn-chip" data-min="10">Em 10 min</button>
            <button class="btn-chip" data-preset="today18">Hoje 18:00</button>
            <button class="btn-chip" data-preset="tomorrow9">Amanhã 09:00</button>
          </div>
          <label class="nk-field">
            <span>Data e hora</span>
            <input type="datetime-local" id="reminderInput">
          </label>
          <p class="nk-warning hidden" id="reminderPermWarn"></p>
          <div class="nk-dialog-foot">
            <button class="btn-text-danger" id="btnReminderRemove">Remover</button>
            <span class="nk-spacer"></span>
            <button class="btn-flat" id="btnReminderCancel">Cancelar</button>
            <button class="btn-primary" id="btnReminderSave">Salvar</button>
          </div>
        </div>
      </div>

      <!-- Compartilhar -->
      <div class="modal-backdrop hidden nk-modal" id="shareModal">
        <div class="modal-dialog nk-dialog" role="dialog" aria-labelledby="shareTitle">
          <div class="nk-dialog-head">
            <span class="material-symbols-outlined">qr_code_2</span>
            <h3 id="shareTitle">Compartilhar nota</h3>
            <span class="nk-spacer"></span>
            <button class="icon-btn tool-btn" id="btnShareClose" title="Fechar"><span class="material-symbols-outlined">close</span></button>
          </div>
          <div class="nk-tabs" role="tablist">
            <button class="nk-tab active" data-mode="link" role="tab">Link</button>
            <button class="nk-tab" data-mode="text" role="tab">Texto</button>
            <span class="nk-tab-ink"></span>
          </div>
          <div class="nk-share-body">
            <div class="nk-qr-frame"><div class="nk-qr" id="shareQr"></div></div>
            <div class="nk-share-side">
              <p class="nk-muted" id="shareExplain"></p>
              <div class="nk-copy-row">
                <input type="text" id="shareLinkInput" readonly>
                <button class="btn-primary" id="btnShareCopy"><span class="material-symbols-outlined">content_copy</span>Copiar</button>
              </div>
              <button class="btn-flat nk-native-share hidden" id="btnShareNative">
                <span class="material-symbols-outlined">ios_share</span> Enviar pelo sistema…
              </button>
              <p class="nk-warning hidden" id="shareWarn"></p>
            </div>
          </div>
        </div>
      </div>

      <!-- Nota recebida por link -->
      <div class="modal-backdrop hidden nk-modal" id="incomingModal">
        <div class="modal-dialog nk-dialog nk-dialog-sm" role="dialog" aria-labelledby="incomingTitle">
          <div class="nk-dialog-head">
            <span class="material-symbols-outlined">mark_email_unread</span>
            <h3 id="incomingTitle">Alguém compartilhou uma nota com você</h3>
          </div>
          <div class="nk-incoming-card" id="incomingPreview"></div>
          <div class="nk-dialog-foot">
            <button class="btn-flat" id="btnIncomingDiscard">Descartar</button>
            <span class="nk-spacer"></span>
            <button class="btn-primary" id="btnIncomingSave"><span class="material-symbols-outlined">download</span>Salvar nas minhas notas</button>
          </div>
        </div>
      </div>

      <!-- Estudar com IA -->
      <div class="modal-backdrop hidden nk-modal" id="studyModal">
        <div class="modal-dialog nk-dialog nk-dialog-lg" role="dialog" aria-labelledby="studyTitle">
          <div class="nk-dialog-head">
            <span class="material-symbols-outlined nk-grad-icon">school</span>
            <h3 id="studyTitle">Estudar com IA</h3>
            <span class="model-badge">Gemini</span>
            <span class="nk-spacer"></span>
            <button class="icon-btn tool-btn" id="btnStudyClose" title="Fechar"><span class="material-symbols-outlined">close</span></button>
          </div>
          <div class="nk-study">
            <aside class="nk-study-notes">
              <div class="nk-study-notes-head">
                <strong>Notas</strong>
                <span class="nk-muted" id="studyCount">0 selecionadas</span>
              </div>
              <div class="nk-chip-row">
                <button class="btn-chip" id="btnStudyAll">Todas</button>
                <button class="btn-chip" id="btnStudyNone">Limpar</button>
              </div>
              <div class="nk-study-list" id="studyNotesList"></div>
            </aside>
            <section class="nk-study-main">
              <div class="nk-study-actions">
                <button class="nk-mode-btn" data-study="summary">
                  <span class="material-symbols-outlined">summarize</span>
                  <span><strong>Resumo</strong><small>Pontos-chave em tópicos</small></span>
                </button>
                <button class="nk-mode-btn" data-study="flashcards">
                  <span class="material-symbols-outlined">style</span>
                  <span><strong>Flashcards</strong><small>Perguntas para revisar</small></span>
                </button>
              </div>
              <div class="nk-study-output" id="studyOutput">
                <div class="nk-study-empty">
                  <span class="material-symbols-outlined">auto_stories</span>
                  <p>Escolha as notas ao lado e gere um <strong>resumo</strong> ou um baralho de <strong>flashcards</strong> para revisar.</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      <!-- Atalhos -->
      <div class="modal-backdrop hidden nk-modal" id="shortcutsModal">
        <div class="modal-dialog nk-dialog" role="dialog" aria-labelledby="shortcutsTitle">
          <div class="nk-dialog-head">
            <span class="material-symbols-outlined">keyboard</span>
            <h3 id="shortcutsTitle">Atalhos de teclado</h3>
            <span class="nk-spacer"></span>
            <button class="icon-btn tool-btn" id="btnShortcutsClose" title="Fechar"><span class="material-symbols-outlined">close</span></button>
          </div>
          <div class="nk-shortcuts" id="shortcutsList"></div>
        </div>
      </div>

      <iframe id="nkPrintFrame" class="nk-print-frame" title="Impressão" aria-hidden="true" tabindex="-1"></iframe>
      <div class="nk-confetti" id="nkConfetti" aria-hidden="true"></div>`;
    while (host.firstChild) document.body.appendChild(host.firstChild);

    this.renderShortcutsList();
  }

  /* ---------- eventos ---------- */
  bindEvents() {
    const moreBtn = this.$('btnModalMore');
    const menu = this.$('modalMoreMenu');
    if (moreBtn && menu) {
      moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('hidden');
      });
      menu.addEventListener('click', (e) => {
        const item = e.target.closest('.nk-menu-item');
        if (!item) return;
        menu.classList.add('hidden');
        const action = item.dataset.action;
        if (action === 'reminder') this.openReminderModal();
        if (action === 'share') this.openShareFromModal();
        if (action === 'md') this.exportMarkdown(this.currentModalNote());
        if (action === 'pdf') this.exportPdf(this.currentModalNote());
      });
      document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && !moreBtn.contains(e.target)) menu.classList.add('hidden');
      });
    }

    // Fechar modais clicando no fundo
    ['reminderModal', 'shareModal', 'studyModal', 'shortcutsModal'].forEach(id => {
      const m = this.$(id);
      m.addEventListener('click', (e) => { if (e.target === m) this.closeModal(m); });
    });

    // Lembrete
    this.$('reminderQuick').addEventListener('click', (e) => {
      const chip = e.target.closest('.btn-chip');
      if (!chip) return;
      const d = new Date();
      if (chip.dataset.min) {
        d.setMinutes(d.getMinutes() + Number(chip.dataset.min));
      } else if (chip.dataset.preset === 'today18') {
        d.setHours(18, 0, 0, 0);
        if (d < new Date()) d.setDate(d.getDate() + 1);
      } else {
        d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0);
      }
      this.$('reminderInput').value = nkToLocalInput(d);
      this.reminderExact = chip.dataset.min ? d : null;
      this.pulse(this.$('reminderInput'));
    });
    this.$('reminderInput').addEventListener('input', () => { this.reminderExact = null; });
    this.$('btnReminderSave').addEventListener('click', () => this.saveReminder());
    this.$('btnReminderRemove').addEventListener('click', () => this.saveReminder(true));
    this.$('btnReminderCancel').addEventListener('click', () => this.closeModal(this.$('reminderModal')));

    // Compartilhar
    this.$('btnShareClose').addEventListener('click', () => this.closeModal(this.$('shareModal')));
    document.querySelectorAll('#shareModal .nk-tab').forEach(tab => {
      tab.addEventListener('click', () => this.setShareMode(tab.dataset.mode));
    });
    this.$('btnShareCopy').addEventListener('click', () => this.copyShare());
    this.$('btnShareNative').addEventListener('click', () => {
      navigator.share({ title: this.shareTitle || 'Nota do NoteKeep', text: this.shareText, url: this.shareLink }).catch(() => {});
    });

    // Nota recebida
    this.$('btnIncomingDiscard').addEventListener('click', () => this.closeModal(this.$('incomingModal')));
    this.$('btnIncomingSave').addEventListener('click', () => this.saveIncoming());

    // Estudar
    const openStudy = () => this.openStudyModal();
    this.$('btnOpenStudy')?.addEventListener('click', openStudy);
    this.$('navStudy')?.addEventListener('click', openStudy);
    this.$('btnStudyClose').addEventListener('click', () => this.closeModal(this.$('studyModal')));
    this.$('btnStudyAll').addEventListener('click', () => this.setAllStudyNotes(true));
    this.$('btnStudyNone').addEventListener('click', () => this.setAllStudyNotes(false));
    document.querySelectorAll('#studyModal .nk-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => this.runStudy(btn.dataset.study));
    });

    // Atalhos
    this.$('btnShortcuts')?.addEventListener('click', () => this.openModal(this.$('shortcutsModal')));
    this.$('btnShortcutsClose').addEventListener('click', () => this.closeModal(this.$('shortcutsModal')));
    window.addEventListener('keydown', (e) => this.handleKeydown(e));

    // Lembrete pode disparar enquanto a aba volta ao foco
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.checkReminders(); });
  }

  openModal(modal) {
    modal.classList.remove('hidden', 'nk-closing');
  }

  closeModal(modal) {
    if (!modal || modal.classList.contains('hidden')) return;
    if (nkReduceMotion() || !modal.animate) { modal.classList.add('hidden'); return; }
    modal.classList.add('nk-closing');
    setTimeout(() => modal.classList.add('hidden'), 160);
    setTimeout(() => modal.classList.remove('nk-closing'), 170);
  }

  pulse(el) {
    if (!el || !el.animate || nkReduceMotion()) return;
    el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' });
  }

  /* ==========================================================
     ORDEM PERSONALIZADA + ARRASTAR E SOLTAR
     ========================================================== */
  applyOrder(list) {
    if (this.app.activeView === 'reminders') {
      return [...list].sort((a, b) => new Date(a.reminder) - new Date(b.reminder));
    }
    if (!this.order.length) return list;
    const pos = new Map(this.order.map((id, i) => [id, i]));
    // Notas novas (ainda sem posição) aparecem primeiro, na ordem original.
    return list
      .map((note, i) => ({ note, i, p: pos.has(note.id) ? pos.get(note.id) : -1 }))
      .sort((a, b) => (a.p - b.p) || (a.i - b.i))
      .map(x => x.note);
  }

  canDrag() {
    const v = this.app.activeView;
    return v !== 'trash' && v !== 'reminders' && v !== 'ai' && v !== 'kanban' && !this.app.searchQuery;
  }

  afterRenderGrid() {
    const grids = [this.app.pinnedGrid, this.app.othersGrid];
    const viewChanged = this.lastRenderedView !== this.app.activeView;
    const seen = new Set();
    let i = 0;
    const draggable = this.canDrag();

    grids.forEach(grid => {
      grid.querySelectorAll(':scope > .note-card').forEach(card => {
        const id = card.dataset.id;
        seen.add(id);
        if (viewChanged || !this.renderedIds.has(id)) {
          card.classList.add('nk-enter');
          card.style.setProperty('--i', Math.min(i++, 14));
          card.addEventListener('animationend', () => card.classList.remove('nk-enter'), { once: true });
        }
        if (draggable) this.makeDraggable(card, grid);
      });
    });

    this.renderedIds = seen;
    this.lastRenderedView = this.app.activeView;
  }

  makeDraggable(card, grid) {
    card.draggable = true;
    card.classList.add('nk-draggable');

    card.addEventListener('dragstart', (e) => {
      if (e.target.closest('input, textarea')) { e.preventDefault(); return; }
      this.drag = { card, grid, lastMove: 0 };
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/x-notekeep', card.dataset.id); } catch (err) { /* ok */ }
      requestAnimationFrame(() => card.classList.add('nk-dragging'));
      document.body.classList.add('nk-is-dragging');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('nk-dragging');
      document.body.classList.remove('nk-is-dragging');
      if (this.drag) this.commitOrder();
      this.drag = null;
    });

    card.addEventListener('dragover', (e) => {
      const d = this.drag;
      if (!d || d.grid !== grid || card === d.card) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const now = performance.now();
      if (now - d.lastMove < 140) return;
      const rect = card.getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height / 2;
      const ref = before ? card : card.nextSibling;
      if (ref === d.card || (ref && ref.previousSibling === d.card && before)) return;
      if (!before && card.nextSibling === d.card) return;
      d.lastMove = now;
      this.flip(grid, () => grid.insertBefore(d.card, ref));
    });

    card.addEventListener('drop', (e) => { if (this.drag) e.preventDefault(); });
  }

  /** Animação FLIP: os cartões deslizam até a nova posição. */
  flip(container, mutate) {
    const cards = [...container.children];
    const first = new Map(cards.map(c => [c, c.getBoundingClientRect()]));
    mutate();
    if (nkReduceMotion()) return;
    cards.forEach(c => {
      const a = first.get(c);
      const b = c.getBoundingClientRect();
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if ((dx || dy) && c.animate) {
        c.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
          { duration: 240, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
      }
    });
  }

  commitOrder() {
    const domIds = [this.app.pinnedGrid, this.app.othersGrid]
      .flatMap(g => [...g.querySelectorAll(':scope > .note-card')].map(c => c.dataset.id));
    const inDom = new Set(domIds);
    const before = this.order.join('|');
    this.order = [...domIds, ...this.order.filter(id => !inDom.has(id))];
    if (this.order.join('|') !== before) {
      this.saveJson(NK_ORDER_KEY, this.order);
      this.app.sound.playPop();
    }
  }

  /* ==========================================================
     CARTÕES: chip de lembrete, saída animada, confete
     ========================================================== */
  decorateCard(card, note) {
    if (!note.reminder || card.classList.contains('is-locked') || note.is_trashed) return;
    const due = new Date(note.reminder);
    if (isNaN(due)) return;
    const done = this.fired.has(this.firedKey(note)) || due <= new Date();
    const chip = document.createElement('div');
    chip.className = `nk-reminder-chip ${done ? 'done' : ''}`;
    chip.title = done ? 'Lembrete já disparado' : 'Lembrete agendado';
    chip.innerHTML = `<span class="material-symbols-outlined">${done ? 'notifications_off' : 'alarm'}</span>${nkEscape(nkFormatWhen(due))}`;
    const actions = card.querySelector('.note-card-actions');
    card.insertBefore(chip, actions);
  }

  animateOut(id, done) {
    const card = document.querySelector(`.note-card[data-id="${CSS.escape(id)}"]`);
    if (!card || !card.animate || nkReduceMotion()) { done(); return; }
    const anim = card.animate([
      { opacity: 1, transform: 'scale(1)' },
      { opacity: 0, transform: 'scale(0.85) translateY(8px)' }
    ], { duration: 200, easing: 'ease-in', fill: 'forwards' });
    anim.onfinish = done;
  }

  wrapSound() {
    const sound = this.app.sound;
    const original = sound.playChime.bind(sound);
    sound.playChime = (...args) => {
      original(...args);
      this.confetti();
    };
  }

  confetti(x = window.innerWidth / 2, y = window.innerHeight / 3) {
    if (nkReduceMotion()) return;
    const layer = this.$('nkConfetti');
    if (!layer || !layer.animate) return;
    const colors = ['#fbbc04', '#34a853', '#1a73e8', '#ea4335', '#c58af9', '#8ab4f8'];
    for (let i = 0; i < 46; i++) {
      const p = document.createElement('i');
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      p.style.background = colors[i % colors.length];
      if (i % 3 === 0) p.style.borderRadius = '50%';
      layer.appendChild(p);
      const angle = Math.random() * Math.PI * 2;
      const dist = 120 + Math.random() * 220;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist * 0.7 - 80;
      p.animate([
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy + 260}px) rotate(${Math.random() * 720 - 360}deg)`, opacity: 0 }
      ], { duration: 1100 + Math.random() * 600, easing: 'cubic-bezier(0.15, 0.6, 0.4, 1)' }).onfinish = () => p.remove();
    }
  }

  /* ==========================================================
     LEMBRETES COM NOTIFICAÇÃO
     ========================================================== */
  firedKey(note) { return `${note.id}|${note.reminder}`; }

  openReminderModal() {
    const note = this.app.editingNote;
    if (!note) return;
    const input = this.$('reminderInput');
    const base = note.reminder ? new Date(note.reminder) : (() => { const d = new Date(); d.setMinutes(d.getMinutes() + 1); return d; })();
    input.value = nkToLocalInput(base);
    input.min = nkToLocalInput(new Date());
    this.reminderExact = null;
    this.$('btnReminderRemove').classList.toggle('hidden', !note.reminder);
    this.updatePermissionWarning();
    this.openModal(this.$('reminderModal'));
  }

  updatePermissionWarning() {
    const warn = this.$('reminderPermWarn');
    if (!('Notification' in window)) {
      warn.textContent = 'Este navegador não suporta notificações — o lembrete aparecerá dentro do app.';
      warn.classList.remove('hidden');
    } else if (Notification.permission === 'denied') {
      warn.textContent = 'As notificações estão bloqueadas para este site. Libere no ícone de cadeado da barra de endereço; até lá, o lembrete aparece dentro do app.';
      warn.classList.remove('hidden');
    } else {
      warn.classList.add('hidden');
    }
  }

  async saveReminder(remove = false) {
    const note = this.app.editingNote;
    if (!note) return;
    if (remove) {
      note.reminder = null;
      this.showToastSafe('Lembrete removido');
    } else {
      const value = this.$('reminderInput').value;
      if (!value) return;
      const when = this.reminderExact || new Date(value);
      if (when <= new Date()) {
        this.$('reminderPermWarn').textContent = 'Escolha um horário no futuro.';
        this.$('reminderPermWarn').classList.remove('hidden');
        this.pulse(this.$('reminderInput'));
        return;
      }
      note.reminder = when.toISOString();
      if ('Notification' in window && Notification.permission === 'default') {
        try { await Notification.requestPermission(); } catch (e) { /* ignorado */ }
      }
      this.showToastSafe(`Lembrete definido para ${nkFormatWhen(when)}`);
    }
    this.persistReminder(note);
    this.renderModalReminder();
    this.closeModal(this.$('reminderModal'));
  }

  /** Salva o lembrete imediatamente, sem esperar o modal da nota fechar. */
  persistReminder(editing) {
    const stored = this.app.notes.find(n => n.id === editing.id);
    if (!stored) return;
    stored.reminder = editing.reminder;
    this.app.storage.saveNote({ ...stored });
  }

  renderModalReminder() {
    const row = this.$('modalReminderRow');
    const note = this.app.editingNote;
    if (!row) return;
    if (!note || !note.reminder) { row.classList.add('hidden'); row.innerHTML = ''; return; }
    const due = new Date(note.reminder);
    const past = due <= new Date();
    row.classList.remove('hidden');
    row.innerHTML = `
      <button class="nk-reminder-chip ${past ? 'done' : ''}" title="Editar lembrete">
        <span class="material-symbols-outlined">${past ? 'notifications_off' : 'alarm'}</span>${nkEscape(nkFormatWhen(due))}
      </button>`;
    row.querySelector('button').addEventListener('click', () => this.openReminderModal());
  }

  startReminderLoop() {
    this.checkReminders();
    this.reminderTimer = setInterval(() => this.checkReminders(), 5000);
  }

  checkReminders() {
    const now = Date.now();
    this.app.notes.forEach(note => {
      if (!note.reminder || note.is_trashed) return;
      const due = new Date(note.reminder).getTime();
      if (isNaN(due) || due > now) return;
      const key = this.firedKey(note);
      if (this.fired.has(key)) return;
      this.fired.add(key);
      this.saveJson(NK_FIRED_KEY, [...this.fired].slice(-300));
      // Lembretes muito antigos (ex.: app fechado por dias) não disparam de novo.
      if (now - due < 1000 * 60 * 60 * 12) this.fireReminder(note);
    });
  }

  fireReminder(note) {
    const locked = note.is_locked && !this.app.vault.sessionCache.has(note.id);
    const title = note.title || 'Lembrete do NoteKeep';
    let body = 'Você pediu para ser lembrado desta nota.';
    if (locked) body = 'Nota protegida no Cofre Seguro.';
    else if (note.type === 'checklist' && note.checklist_items?.length) {
      const open = note.checklist_items.filter(i => !i.completed).map(i => '• ' + i.text);
      body = open.slice(0, 4).join('\n') || 'Todos os itens concluídos!';
    } else if (note.content) body = note.content.slice(0, 140);

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const n = new Notification(`⏰ ${title}`, { body, icon: 'assets/icon.svg', tag: note.id, requireInteraction: true });
        n.onclick = () => { window.focus(); this.app.openEditModal(note); n.close(); };
      } catch (e) { /* alguns navegadores exigem service worker */ }
    }

    this.app.sound.playChime();
    this.showToastSafe(`⏰ Lembrete: ${title}`);
    const bell = this.$('navReminders');
    if (bell) {
      bell.classList.remove('nk-ringing');
      void bell.offsetWidth;
      bell.classList.add('nk-ringing');
    }
    if (document.title.indexOf('⏰') !== 0) {
      const original = document.title;
      document.title = `⏰ ${title}`;
      setTimeout(() => { document.title = original; }, 8000);
    }
    this.app.renderNotesGrid();
  }

  /* ==========================================================
     COMPARTILHAR (LINK + QR CODE)
     ========================================================== */
  currentModalNote() {
    const n = this.app.editingNote;
    if (!n) return null;
    return {
      ...n,
      title: this.app.modalNoteTitle.value.trim(),
      content: n.type === 'checklist' ? '' : this.app.modalNoteContent.value.trim(),
      checklist_items: n.checklist_items || []
    };
  }

  notePlainText(note) {
    let text = note.title ? `${note.title}\n\n` : '';
    if (note.type === 'checklist') {
      text += (note.checklist_items || []).map(i => `${i.completed ? '☑' : '☐'} ${i.text}`).join('\n');
    } else {
      text += note.content || '';
    }
    return text.trim();
  }

  async openShareFromModal() {
    const note = this.currentModalNote();
    if (!note) return;
    if (note.is_locked) {
      this.showToastSafe('Notas do Cofre Seguro não podem ser compartilhadas. Remova a proteção primeiro.');
      return;
    }
    if (!note.title && !note.content && !(note.checklist_items || []).length) {
      this.showToastSafe('A nota está vazia — escreva algo antes de compartilhar.');
      return;
    }
    const payload = {
      v: 1, t: note.title || '', c: note.content || '', y: note.type === 'checklist' ? 'c' : 't',
      k: (note.checklist_items || []).map(i => [i.text, i.completed ? 1 : 0]),
      l: note.labels || [], o: note.color || 'default'
    };
    const code = await nkEncodeShare(payload);
    this.shareLink = `${location.origin}${location.pathname}#nota=${code}`;
    this.shareText = this.notePlainText(note);
    this.shareTitle = note.title;

    const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:';
    this.$('btnShareNative').classList.toggle('hidden', !navigator.share);
    this.openModal(this.$('shareModal'));
    // No localhost o celular não alcança o link, então o modo Texto é o padrão.
    this.setShareMode(isLocal ? 'text' : 'link', isLocal);
  }

  async setShareMode(mode, isLocal = null) {
    this.shareMode = mode;
    if (isLocal === null) isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:';
    document.querySelectorAll('#shareModal .nk-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
    this.$('shareModal').querySelector('.nk-tabs').dataset.mode = mode;

    const input = this.$('shareLinkInput');
    const explain = this.$('shareExplain');
    const warn = this.$('shareWarn');
    warn.classList.add('hidden');

    if (mode === 'link') {
      input.value = this.shareLink;
      explain.innerHTML = 'Quem abrir o link vê a nota e pode salvá-la. <strong>Nada é enviado a servidores</strong>: o conteúdo vai compactado dentro do próprio link.';
      if (isLocal) {
        warn.innerHTML = `O app está em <code>${nkEscape(location.host || 'arquivo local')}</code>, que só existe neste computador. Para abrir no celular, use a aba <strong>Texto</strong> ou rode o app num endereço da rede.`;
        warn.classList.remove('hidden');
      }
    } else {
      input.value = this.shareText.replace(/\n/g, ' ⏎ ');
      explain.innerHTML = 'Aponte a câmera do celular: o <strong>texto da nota</strong> aparece na hora, sem internet e sem instalar nada.';
    }

    const qrText = mode === 'link' ? this.shareLink : this.shareText;
    await this.renderQr(qrText);
  }

  loadQrLib() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    if (this.qrLibPromise) return this.qrLibPromise;
    this.qrLibPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = NK_QR_LIB;
      s.onload = () => (window.qrcode ? resolve(window.qrcode) : reject(new Error('QR indisponível')));
      s.onerror = () => { this.qrLibPromise = null; reject(new Error('Sem conexão para carregar o gerador de QR Code')); };
      document.head.appendChild(s);
    });
    return this.qrLibPromise;
  }

  async renderQr(text) {
    const box = this.$('shareQr');
    box.classList.remove('nk-qr-in');
    box.innerHTML = '<div class="nk-qr-loading"><span class="material-symbols-outlined">progress_activity</span></div>';
    try {
      const qrcode = await this.loadQrLib();
      if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) {
        qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
      }
      const qr = qrcode(0, 'M');
      qr.addData(text, 'Byte');
      qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
      void box.offsetWidth;
      box.classList.add('nk-qr-in');
    } catch (e) {
      const tooLong = /overflow|length/i.test(e.message || '');
      box.innerHTML = `<div class="nk-qr-error"><span class="material-symbols-outlined">${tooLong ? 'text_increase' : 'cloud_off'}</span>
        ${tooLong ? 'Nota longa demais para um QR Code. Use o link copiado.' : nkEscape(e.message)}</div>`;
    }
  }

  async copyShare() {
    const value = this.shareMode === 'link' ? this.shareLink : this.shareText;
    try {
      await navigator.clipboard.writeText(value);
    } catch (e) {
      const input = this.$('shareLinkInput');
      input.select();
      document.execCommand && document.execCommand('copy');
    }
    const btn = this.$('btnShareCopy');
    btn.innerHTML = '<span class="material-symbols-outlined">check</span>Copiado!';
    btn.classList.add('nk-copied');
    setTimeout(() => {
      btn.innerHTML = '<span class="material-symbols-outlined">content_copy</span>Copiar';
      btn.classList.remove('nk-copied');
    }, 1600);
  }

  async handleIncomingShare() {
    const match = location.hash.match(/^#nota=([\w-]+)$/);
    if (!match) return;
    history.replaceState(null, '', location.pathname + location.search);
    try {
      const p = await nkDecodeShare(match[1]);
      this.incoming = {
        title: String(p.t || ''), content: String(p.c || ''),
        type: p.y === 'c' ? 'checklist' : 'text',
        checklist: Array.isArray(p.k) ? p.k.map(([text, done]) => ({ text: String(text), completed: Boolean(done) })) : [],
        labels: Array.isArray(p.l) ? p.l.map(String) : [],
        color: /^[a-z]+$/.test(p.o || '') ? p.o : 'default'
      };
    } catch (e) {
      this.showToastSafe('Não foi possível abrir a nota compartilhada: link incompleto ou corrompido.');
      return;
    }
    const n = this.incoming;
    const body = n.type === 'checklist'
      ? `<ul class="nk-incoming-list">${n.checklist.map(i => `<li class="${i.completed ? 'done' : ''}">${nkEscape(i.text)}</li>`).join('')}</ul>`
      : `<p>${nkEscape(n.content).replace(/\n/g, '<br>')}</p>`;
    const preview = this.$('incomingPreview');
    preview.className = `nk-incoming-card note-card color-${n.color}`;
    preview.innerHTML = `${n.title ? `<div class="note-card-title">${nkEscape(n.title)}</div>` : ''}${body}
      ${n.labels.length ? `<div class="card-labels-container">${n.labels.map(l => `<span class="label-chip">${nkEscape(l)}</span>`).join('')}</div>` : ''}`;
    this.openModal(this.$('incomingModal'));
  }

  saveIncoming() {
    const n = this.incoming;
    if (!n) return;
    const now = new Date().toISOString();
    const note = {
      id: 'note_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      title: n.title, content: n.content, type: n.type,
      checklist_items: n.checklist.map((i, idx) => ({ id: `chk_${Date.now()}_${idx}`, ...i })),
      color: n.color, is_pinned: false, is_archived: false, is_trashed: false, is_locked: false,
      labels: n.labels, created_at: now, updated_at: now
    };
    this.app.notes.unshift(note);
    this.app.storage.saveNote(note);
    this.incoming = null;
    this.closeModal(this.$('incomingModal'));
    this.app.switchView('notes');
    this.app.sound.playPop();
    this.showToastSafe('Nota compartilhada salva!');
  }

  /* ==========================================================
     EXPORTAR (MARKDOWN / PDF)
     ========================================================== */
  noteToMarkdown(note) {
    const lines = [`# ${note.title || 'Nota sem título'}`, ''];
    if (note.type === 'checklist') {
      (note.checklist_items || []).forEach(i => lines.push(`- [${i.completed ? 'x' : ' '}] ${i.text}`));
    } else if (note.content) {
      lines.push(note.content);
    }
    const meta = [];
    if (note.labels?.length) meta.push(`**Marcadores:** ${note.labels.join(', ')}`);
    if (note.reminder) meta.push(`**Lembrete:** ${new Date(note.reminder).toLocaleString('pt-BR')}`);
    if (note.updated_at) meta.push(`**Atualizada em:** ${new Date(note.updated_at).toLocaleString('pt-BR')}`);
    if (meta.length) lines.push('', '---', '', ...meta.map(m => m + '  '));
    return lines.join('\n') + '\n';
  }

  download(filename, text, type = 'text/markdown;charset=utf-8') {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  exportMarkdown(note) {
    if (!note) return;
    this.download(`${nkSlug(note.title)}.md`, this.noteToMarkdown(note));
    this.showToastSafe('Nota exportada em Markdown');
  }

  exportAllMarkdown() {
    const notes = this.app.notes.filter(n => !n.is_trashed && !n.is_locked);
    if (!notes.length) { this.showToastSafe('Nenhuma nota para exportar'); return; }
    const header = `# NoteKeep — exportação de ${new Date().toLocaleDateString('pt-BR')}\n\n${notes.length} notas (notas do Cofre não são incluídas).\n\n`;
    const body = notes.map(n => this.noteToMarkdown(n).replace(/^# /, '## ')).join('\n\n');
    this.download(`notekeep-${new Date().toISOString().slice(0, 10)}.md`, header + body);
    this.showToastSafe(`${notes.length} notas exportadas em Markdown`);
  }

  exportPdf(note) {
    if (!note) return;
    const color = (window.KEEP_COLORS || (typeof KEEP_COLORS !== 'undefined' ? KEEP_COLORS : []))
      .find(c => c.id === note.color);
    const accent = color && color.id !== 'default' ? color.light : '#fbbc04';
    const body = note.type === 'checklist'
      ? `<ul class="check">${(note.checklist_items || []).map(i => `<li class="${i.completed ? 'done' : ''}"><span class="box">${i.completed ? '✓' : ''}</span>${nkEscape(i.text)}</li>`).join('')}</ul>`
      : `<div class="content">${nkEscape(note.content || '').replace(/\n/g, '<br>')}</div>`;
    const img = note.image ? `<img src="${note.image}" alt="">` : '';
    const labels = (note.labels || []).map(l => `<span class="chip">${nkEscape(l)}</span>`).join('');
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${nkEscape(note.title || 'Nota')}</title>
      <style>
        @page { margin: 22mm 18mm; }
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Roboto, Arial, sans-serif; color: #202124; margin: 0; }
        header { display:flex; align-items:center; gap:10px; border-bottom: 3px solid ${accent}; padding-bottom: 10px; margin-bottom: 22px; color:#5f6368; font-size: 12px; }
        header b { color:#202124; font-size: 14px; }
        h1 { font-size: 26px; margin: 0 0 14px; line-height: 1.25; }
        .content { font-size: 14px; line-height: 1.65; white-space: normal; }
        ul.check { list-style: none; padding: 0; margin: 0; font-size: 14px; }
        ul.check li { display:flex; gap:10px; align-items:center; padding: 6px 0; border-bottom: 1px solid #eee; }
        ul.check .box { width:16px; height:16px; border:1.5px solid #5f6368; border-radius:3px; display:inline-flex; align-items:center; justify-content:center; font-size:12px; }
        ul.check li.done { color:#80868b; text-decoration: line-through; }
        img { max-width: 100%; border-radius: 8px; margin: 0 0 16px; }
        .chips { margin-top: 22px; }
        .chip { display:inline-block; background:#f1f3f4; border-radius: 99px; padding: 3px 10px; font-size: 11px; margin-right: 6px; }
        footer { margin-top: 30px; color:#80868b; font-size: 11px; }
      </style></head><body>
      <header><b>NoteKeep</b> · exportado em ${new Date().toLocaleString('pt-BR')}</header>
      <h1>${nkEscape(note.title || 'Nota sem título')}</h1>
      ${img}${body}
      ${labels ? `<div class="chips">${labels}</div>` : ''}
      <footer>${note.updated_at ? 'Última edição: ' + new Date(note.updated_at).toLocaleString('pt-BR') : ''}</footer>
      </body></html>`;

    const frame = this.$('nkPrintFrame');
    frame.onload = () => {
      setTimeout(() => {
        try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (e) { this.showToastSafe('Não foi possível abrir a impressão'); }
      }, 150);
    };
    frame.srcdoc = html;
    this.showToastSafe('Escolha "Salvar como PDF" na janela de impressão');
  }

  /* ==========================================================
     ESTUDAR COM IA (RESUMO + FLASHCARDS)
     ========================================================== */
  studyableNotes() {
    return this.app.notes.filter(n => !n.is_trashed && (!n.is_locked || this.app.vault.sessionCache.has(n.id)));
  }

  readableNote(note) {
    if (note.is_locked && this.app.vault.sessionCache.has(note.id)) {
      return { ...note, ...this.app.vault.sessionCache.get(note.id) };
    }
    return note;
  }

  openStudyModal() {
    const list = this.$('studyNotesList');
    const notes = this.studyableNotes();
    const preselected = this.app.ai?.selectedNoteIds?.size ? this.app.ai.selectedNoteIds : null;
    list.innerHTML = '';
    if (!notes.length) {
      list.innerHTML = '<p class="nk-muted">Nenhuma nota disponível.</p>';
    }
    notes.forEach((note, i) => {
      const n = this.readableNote(note);
      const row = document.createElement('label');
      row.className = `nk-study-item color-${note.color || 'default'}`;
      row.style.setProperty('--i', Math.min(i, 12));
      const checked = preselected ? preselected.has(note.id) : (note.labels || []).some(l => /estud/i.test(l));
      const snippet = n.type === 'checklist'
        ? (n.checklist_items || []).map(x => x.text).join(', ')
        : (n.content || '');
      row.innerHTML = `
        <input type="checkbox" class="check-box-input" value="${nkEscape(note.id)}" ${checked ? 'checked' : ''}>
        <span><strong>${nkEscape(n.title || 'Sem título')}</strong><small>${nkEscape(snippet.slice(0, 70))}</small></span>`;
      list.appendChild(row);
    });
    list.onchange = () => this.updateStudyCount();
    this.updateStudyCount();
    this.openModal(this.$('studyModal'));
  }

  selectedStudyNotes() {
    const ids = new Set([...document.querySelectorAll('#studyNotesList input:checked')].map(i => i.value));
    return this.studyableNotes().filter(n => ids.has(n.id)).map(n => this.readableNote(n));
  }

  setAllStudyNotes(value) {
    document.querySelectorAll('#studyNotesList input').forEach(i => { i.checked = value; });
    this.updateStudyCount();
  }

  updateStudyCount() {
    const count = document.querySelectorAll('#studyNotesList input:checked').length;
    this.$('studyCount').textContent = `${count} ${count === 1 ? 'selecionada' : 'selecionadas'}`;
  }

  buildStudyContext(notes) {
    return notes.map((n, i) => {
      let body = n.type === 'checklist'
        ? (n.checklist_items || []).map(x => `- [${x.completed ? 'x' : ' '}] ${x.text}`).join('\n')
        : (n.content || '');
      return `### Nota ${i + 1}: ${n.title || 'Sem título'}\n${body}`;
    }).join('\n\n');
  }

  async callGemini(prompt, json = false) {
    const ai = this.app.ai;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${ai.modelName}:generateContent?key=${ai.getApiKey()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: json
          ? { temperature: 0.4, responseMimeType: 'application/json' }
          : { temperature: 0.5, maxOutputTokens: 2048 }
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Erro HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  setStudyLoading(mode) {
    const label = mode === 'summary' ? 'Lendo suas notas e resumindo…' : 'Criando perguntas e respostas…';
    this.$('studyOutput').innerHTML = `
      <div class="nk-study-loading">
        <div class="nk-orbit"><i></i><i></i><i></i></div>
        <p>${label}</p>
        <div class="nk-skeleton"></div><div class="nk-skeleton short"></div><div class="nk-skeleton"></div>
      </div>`;
  }

  async runStudy(mode) {
    if (this.studyBusy) return;
    const notes = this.selectedStudyNotes();
    if (!notes.length) {
      this.showToastSafe('Selecione pelo menos uma nota');
      this.pulse(this.$('studyNotesList'));
      return;
    }
    if (!this.app.ai.hasApiKey()) {
      this.closeModal(this.$('studyModal'));
      this.app.ai.openApiKeyModal();
      this.showToastSafe('Configure a chave do AI Studio para usar o estudo com IA');
      return;
    }

    this.studyBusy = true;
    document.querySelectorAll('#studyModal .nk-mode-btn').forEach(b => {
      b.disabled = true;
      b.classList.toggle('active', b.dataset.study === mode);
    });
    this.setStudyLoading(mode);
    const context = this.buildStudyContext(notes);

    try {
      if (mode === 'summary') {
        const text = await this.callGemini(
          `Você é um tutor. Faça um resumo de estudo em português das anotações abaixo.\n` +
          `Formato: uma frase de visão geral, depois tópicos com "- " usando **negrito** nos conceitos-chave, ` +
          `e no fim uma linha "**Para revisar:**" com 2 ou 3 perguntas. Seja direto (até 250 palavras).\n\n${context}`);
        this.renderSummary(text, notes);
      } else {
        const raw = await this.callGemini(
          `Crie entre 6 e 10 flashcards de estudo em português a partir das anotações abaixo.\n` +
          `Responda APENAS um array JSON: [{"pergunta": "...", "resposta": "..."}]. ` +
          `Perguntas curtas e objetivas; respostas com no máximo 2 frases.\n\n${context}`, true);
        const cards = this.parseFlashcards(raw);
        if (!cards.length) throw new Error('A IA não retornou flashcards válidos. Tente novamente.');
        this.flashcards = cards;
        this.flashIndex = 0;
        this.renderFlashcards();
      }
    } catch (e) {
      this.$('studyOutput').innerHTML = `
        <div class="nk-study-empty nk-error">
          <span class="material-symbols-outlined">error</span>
          <p><strong>Não deu certo.</strong><br>${nkEscape(e.message)}</p>
        </div>`;
    } finally {
      this.studyBusy = false;
      document.querySelectorAll('#studyModal .nk-mode-btn').forEach(b => { b.disabled = false; });
    }
  }

  parseFlashcards(raw) {
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      const m = raw.match(/\[[\s\S]*\]/);
      data = m ? JSON.parse(m[0]) : [];
    }
    if (!Array.isArray(data)) data = data.flashcards || data.cards || [];
    return data
      .map(c => ({ q: String(c.pergunta || c.question || c.q || '').trim(), a: String(c.resposta || c.answer || c.a || '').trim() }))
      .filter(c => c.q && c.a)
      .slice(0, 12);
  }

  renderSummary(text, notes) {
    this.lastSummary = text;
    const out = this.$('studyOutput');
    out.innerHTML = `
      <article class="nk-summary nk-rise">
        <div class="nk-summary-head">
          <span class="material-symbols-outlined">summarize</span>
          <strong>Resumo de ${notes.length} ${notes.length === 1 ? 'nota' : 'notas'}</strong>
        </div>
        <div class="nk-summary-body">${this.app.ai.formatMarkdown(text)}</div>
        <div class="nk-summary-foot">
          <button class="btn-flat" id="btnSummaryCopy"><span class="material-symbols-outlined">content_copy</span> Copiar</button>
          <button class="btn-primary" id="btnSummarySave"><span class="material-symbols-outlined">note_add</span> Salvar como nota</button>
        </div>
      </article>`;
    out.querySelectorAll('.nk-summary-body > *').forEach((el, i) => {
      el.style.setProperty('--i', Math.min(i, 14));
      el.classList.add('nk-line-in');
    });
    this.$('btnSummaryCopy').addEventListener('click', () => {
      navigator.clipboard?.writeText(text).then(() => this.showToastSafe('Resumo copiado'));
    });
    this.$('btnSummarySave').addEventListener('click', () => {
      const title = `Resumo: ${notes.map(n => n.title).filter(Boolean).slice(0, 2).join(', ') || 'minhas notas'}`;
      this.app.createNoteFromAI(title.slice(0, 80), text);
      this.app.renderNotesGrid();
      this.confetti();
    });
  }

  renderFlashcards() {
    const out = this.$('studyOutput');
    const total = this.flashcards.length;
    out.innerHTML = `
      <div class="nk-deck nk-rise">
        <div class="nk-deck-progress"><span id="flashBar"></span></div>
        <div class="nk-deck-stage">
          <button class="icon-btn nk-deck-nav" id="btnFlashPrev" title="Anterior (←)"><span class="material-symbols-outlined">chevron_left</span></button>
          <div class="nk-flashcard" id="flashCard" tabindex="0" role="button" aria-label="Virar cartão">
            <div class="nk-flash-face nk-flash-front">
              <span class="nk-flash-tag">Pergunta</span>
              <p id="flashQ"></p>
              <small>Clique ou aperte espaço para ver a resposta</small>
            </div>
            <div class="nk-flash-face nk-flash-back">
              <span class="nk-flash-tag">Resposta</span>
              <p id="flashA"></p>
            </div>
          </div>
          <button class="icon-btn nk-deck-nav" id="btnFlashNext" title="Próximo (→)"><span class="material-symbols-outlined">chevron_right</span></button>
        </div>
        <div class="nk-deck-foot">
          <span class="nk-muted" id="flashCounter"></span>
          <span class="nk-spacer"></span>
          <button class="btn-flat" id="btnFlashShuffle"><span class="material-symbols-outlined">shuffle</span> Embaralhar</button>
          <button class="btn-primary" id="btnFlashSave"><span class="material-symbols-outlined">note_add</span> Salvar baralho</button>
        </div>
      </div>`;

    const card = this.$('flashCard');
    card.addEventListener('click', () => this.flipFlashcard());
    this.$('btnFlashPrev').addEventListener('click', () => this.moveFlashcard(-1));
    this.$('btnFlashNext').addEventListener('click', () => this.moveFlashcard(1));
    this.$('btnFlashShuffle').addEventListener('click', () => {
      for (let i = this.flashcards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.flashcards[i], this.flashcards[j]] = [this.flashcards[j], this.flashcards[i]];
      }
      this.flashIndex = 0;
      this.showFlashcard(1);
    });
    this.$('btnFlashSave').addEventListener('click', () => {
      const content = this.flashcards.map((c, i) => `${i + 1}. ${c.q}\n→ ${c.a}`).join('\n\n');
      this.app.createNoteFromAI(`Flashcards (${total})`, content);
      this.app.renderNotesGrid();
      this.confetti();
    });
    this.showFlashcard(0);
  }

  showFlashcard(direction) {
    const c = this.flashcards[this.flashIndex];
    const card = this.$('flashCard');
    if (!c || !card) return;
    card.classList.remove('flipped');
    const apply = () => {
      this.$('flashQ').textContent = c.q;
      this.$('flashA').textContent = c.a;
      this.$('flashCounter').textContent = `Cartão ${this.flashIndex + 1} de ${this.flashcards.length}`;
      this.$('flashBar').style.width = `${((this.flashIndex + 1) / this.flashcards.length) * 100}%`;
    };
    if (!direction || !card.animate || nkReduceMotion()) { apply(); return; }
    card.animate([
      { transform: 'translateX(0) rotate(0)', opacity: 1 },
      { transform: `translateX(${-direction * 60}px) rotate(${-direction * 4}deg)`, opacity: 0 }
    ], { duration: 140, easing: 'ease-in' }).onfinish = () => {
      apply();
      card.animate([
        { transform: `translateX(${direction * 60}px) rotate(${direction * 4}deg)`, opacity: 0 },
        { transform: 'translateX(0) rotate(0)', opacity: 1 }
      ], { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
    };
  }

  flipFlashcard() {
    const card = this.$('flashCard');
    if (!card) return;
    card.classList.toggle('flipped');
    this.app.sound.playPop();
  }

  moveFlashcard(step) {
    if (!this.flashcards.length) return;
    const next = this.flashIndex + step;
    if (next >= this.flashcards.length) {
      this.confetti();
      this.showToastSafe('Baralho concluído! 🎉');
      this.flashIndex = 0;
    } else {
      this.flashIndex = (next + this.flashcards.length) % this.flashcards.length;
    }
    this.showFlashcard(step);
  }

  /* ==========================================================
     ATALHOS DE TECLADO
     ========================================================== */
  renderShortcutsList() {
    const list = this.$('shortcutsList');
    let i = 0;
    list.innerHTML = NK_SHORTCUTS.map(g => `
      <section class="nk-shortcut-group">
        <h4>${g.group}</h4>
        ${g.items.map(it => `
          <div class="nk-shortcut" style="--i:${Math.min(i++, 20)}">
            <span>${it.desc}</span>
            <span class="nk-keys">${it.keys.map(k => `<kbd>${k}</kbd>`).join(it.sep ? `<em>${it.sep}</em>` : (it.keys[0] === 'G' ? '<em>depois</em>' : '+'))}</span>
          </div>`).join('')}
      </section>`).join('');
  }

  isTyping(target) {
    return target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
  }

  openOverlay() {
    return [...document.querySelectorAll('.modal-backdrop, .command-palette-backdrop')]
      .find(m => !m.classList.contains('hidden'));
  }

  handleKeydown(e) {
    const app = this.app;
    const editOpen = !app.editNoteModal.classList.contains('hidden');
    const studyOpen = !this.$('studyModal').classList.contains('hidden');

    // Atalhos dentro do modal da nota
    if (editOpen && (e.ctrlKey || e.metaKey)) {
      if (e.key === 'Enter') { e.preventDefault(); app.closeEditModal(true); return; }
      if (e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); this.openShareFromModal(); return; }
      if (e.shiftKey && e.key.toLowerCase() === 'l') { e.preventDefault(); this.openReminderModal(); return; }
    }

    if (e.key === 'Escape') {
      const order = ['incomingModal', 'reminderModal', 'shareModal', 'shortcutsModal', 'studyModal'];
      for (const id of order) {
        const m = this.$(id);
        if (!m.classList.contains('hidden')) { this.closeModal(m); return; }
      }
      if (editOpen && !document.querySelector('.slash-menu:not(.hidden)')) { app.closeEditModal(true); return; }
      return;
    }

    // Navegação dos flashcards
    if (studyOpen && this.flashcards.length && this.$('flashCard') && !this.isTyping(e.target)) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.flipFlashcard(); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); this.moveFlashcard(1); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); this.moveFlashcard(-1); return; }
    }

    if (e.ctrlKey || e.metaKey || e.altKey || this.isTyping(e.target) || this.openOverlay()) return;

    const key = e.key.toLowerCase();

    if (this.pendingG) {
      this.pendingG = false;
      clearTimeout(this.pendingGTimer);
      const views = { n: 'notes', k: 'kanban', c: 'vault', l: 'reminders', i: 'ai', a: 'archive' };
      if (views[key]) { e.preventDefault(); app.switchView(views[key]); }
      return;
    }

    switch (key) {
      case '?':
        e.preventDefault(); this.openModal(this.$('shortcutsModal')); break;
      case '/':
        e.preventDefault(); app.searchInput.focus(); app.searchInput.select(); break;
      case 'n':
        e.preventDefault(); app.switchView('notes'); app.expandNoteCreator(false); break;
      case 'l':
        e.preventDefault(); app.switchView('notes'); app.expandNoteCreator(true); break;
      case 't':
        e.preventDefault(); app.cycleTheme(); break;
      case 'e':
        e.preventDefault(); this.openStudyModal(); break;
      case 'g':
        this.pendingG = true;
        this.pendingGTimer = setTimeout(() => { this.pendingG = false; }, 1200);
        break;
      default:
        break;
    }
  }

  showShortcutHintOnce() {
    if (this.loadJson(NK_HINT_KEY, false)) return;
    this.saveJson(NK_HINT_KEY, true);
    setTimeout(() => this.showToastSafe('Dica: aperte ? para ver todos os atalhos de teclado'), 1800);
  }

  showToastSafe(msg) {
    if (this.app.snackbar) this.app.showToast(msg);
  }

  /* ---------- comandos extras para a paleta Ctrl+K ---------- */
  extraCommands() {
    return [
      { id: 'study_ai', type: 'action', icon: 'school', title: 'Estudar com IA (Resumo / Flashcards)',
        desc: 'Gera resumo ou baralho de flashcards das notas selecionadas', action: () => this.openStudyModal() },
      { id: 'export_all', type: 'action', icon: 'download', title: 'Exportar todas as notas (.md)',
        desc: 'Baixa um arquivo Markdown com todas as notas', action: () => this.exportAllMarkdown() },
      { id: 'reminders', type: 'action', icon: 'notifications', title: 'Ver Lembretes',
        desc: 'Notas com lembrete agendado, em ordem de horário', action: () => this.app.switchView('reminders') },
      { id: 'shortcuts', type: 'action', icon: 'keyboard', title: 'Atalhos de teclado',
        desc: 'Ver a lista completa de atalhos (?)', action: () => this.openModal(this.$('shortcutsModal')) }
    ];
  }
}

/* ==========================================================
   INTEGRAÇÃO COM O APP (sem alterar o fluxo original)
   ========================================================== */
(function installExtras() {
  if (typeof NoteKeepApp === 'undefined') return;
  const proto = NoteKeepApp.prototype;

  const origInit = proto.init;
  proto.init = async function (...args) {
    await origInit.apply(this, args);
    this.extras = new NoteKeepExtras(this);
    this.renderNotesGrid();
  };

  const origFiltered = proto.getFilteredNotes;
  proto.getFilteredNotes = function (...args) {
    const list = origFiltered.apply(this, args);
    return this.extras ? this.extras.applyOrder(list) : list;
  };

  const origRenderGrid = proto.renderNotesGrid;
  proto.renderNotesGrid = function (...args) {
    const result = origRenderGrid.apply(this, args);
    if (this.extras) this.extras.afterRenderGrid();
    return result;
  };

  const origCard = proto.createNoteCardElement;
  proto.createNoteCardElement = function (note) {
    const card = origCard.call(this, note);
    if (this.extras) this.extras.decorateCard(card, note);
    return card;
  };

  const origOpen = proto.openEditModal;
  proto.openEditModal = function (note) {
    origOpen.call(this, note);
    if (this.extras && this.editingNote) this.extras.renderModalReminder();
  };

  const origDelete = proto.deleteNote;
  proto.deleteNote = function (noteId) {
    if (!this.extras) return origDelete.call(this, noteId);
    this.extras.animateOut(noteId, () => origDelete.call(this, noteId));
  };

  if (typeof CommandPalette !== 'undefined') {
    const origCmds = CommandPalette.prototype.getDefaultCommands;
    CommandPalette.prototype.getDefaultCommands = function () {
      const cmds = origCmds.call(this);
      return this.app.extras ? cmds.concat(this.app.extras.extraCommands()) : cmds;
    };
  }
})();

window.NoteKeepExtras = NoteKeepExtras;
