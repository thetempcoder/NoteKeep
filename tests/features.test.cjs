const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

async function boot(t, { url = 'http://localhost:8000', storage = {} } = {}) {
  const dom = new JSDOM(read('index.html'), { url, runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const { window } = dom;
  const errors = [];
  window.addEventListener('error', event => errors.push(event.error));
  t.after(() => assert.deepEqual(errors, [], 'No uncaught UI errors'));
  window.HTMLElement.prototype.scrollIntoView = function () {};
  await new Promise(resolve => window.addEventListener('load', resolve));
  window.fetch = async () => { throw new TypeError('offline'); };
  window.AbortSignal = AbortSignal;
  // jsdom não expõe estes globais do Node.
  window.TextEncoder = TextEncoder;
  window.TextDecoder = TextDecoder;
  window.localStorage.setItem('notekeep_sound_enabled', 'false');
  window.localStorage.setItem('notekeep_shortcuts_hint_seen', 'true');
  for (const [k, v] of Object.entries(storage)) window.localStorage.setItem(k, v);
  const context = dom.getInternalVMContext();
  vm.runInContext(read('ai.js'), context);
  vm.runInContext(read('app.js'), context);
  vm.runInContext(read('features.js'), context);
  await vm.runInContext('window.App = new NoteKeepApp(); window.App.init()', context);
  return window;
}

test('locked notes stay out of the home grid but show in the vault', async t => {
  const w = await boot(t);
  const app = w.App;
  const note = app.notes[0];
  note.is_locked = true;
  app.switchView('notes');
  assert.equal(w.document.querySelector(`#othersGrid [data-id="${note.id}"], #pinnedGrid [data-id="${note.id}"]`), null);
  app.switchView('vault');
  assert.ok(w.document.querySelector(`.note-card[data-id="${note.id}"]`));
});

test('saved custom order is applied to the grid', async t => {
  const w = await boot(t, { storage: { notekeep_order: JSON.stringify(['seed_3', 'seed_2', 'seed_1']) } });
  const app = w.App;
  app.notes.forEach(n => { n.is_pinned = false; });
  app.renderNotesGrid();
  assert.deepEqual([...w.document.querySelectorAll('#othersGrid .note-card')].map(c => c.dataset.id), ['seed_3', 'seed_2', 'seed_1']);
  assert.ok(w.document.querySelector('#othersGrid .note-card').draggable);
});

test('share link round-trips a note and can be saved', async t => {
  const w = await boot(t);
  const payload = { v: 1, t: 'Prova', c: 'Derivadas e integrais — revisão', y: 't', k: [], l: ['Estudos'], o: 'mint' };
  const code = await w.eval('nkEncodeShare')(payload);
  assert.equal(JSON.stringify(await w.eval('nkDecodeShare')(code)), JSON.stringify(payload));

  const w2 = await boot(t, { url: `http://localhost:8000/#nota=${code}` });
  await tick(20);
  assert.equal(w2.document.getElementById('incomingModal').classList.contains('hidden'), false);
  assert.match(w2.document.getElementById('incomingPreview').textContent, /Derivadas e integrais/);
  w2.document.getElementById('btnIncomingSave').click();
  assert.ok(w2.App.notes.some(n => n.title === 'Prova' && n.labels.includes('Estudos')));
  assert.equal(w2.location.hash, '');
});

test('reminders fire once and are not repeated', async t => {
  const w = await boot(t);
  const app = w.App;
  const note = app.notes.find(n => !n.is_pinned) || app.notes[0];
  note.reminder = new Date(Date.now() - 1000).toISOString();
  app.extras.checkReminders();
  assert.match(app.snackbarMessage.textContent, /Lembrete/);
  app.snackbarMessage.textContent = '';
  app.extras.checkReminders();
  assert.equal(app.snackbarMessage.textContent, '');
  assert.ok(JSON.parse(w.localStorage.getItem('notekeep_reminders_fired')).length >= 1);
});

test('reminder set in the modal is persisted immediately', async t => {
  const w = await boot(t);
  const app = w.App;
  const note = app.notes[0];
  app.openEditModal(note);
  app.extras.openReminderModal();
  const future = new Date(Date.now() + 60 * 60 * 1000);
  w.document.getElementById('reminderInput').value = w.eval('nkToLocalInput')(future);
  await app.extras.saveReminder();
  const stored = JSON.parse(w.localStorage.getItem('notekeep_notes')).find(n => n.id === note.id);
  assert.ok(stored.reminder);
  assert.equal(w.document.getElementById('modalReminderRow').classList.contains('hidden'), false);
});

test('markdown export includes checklist state and labels', async t => {
  const w = await boot(t);
  const md = w.App.extras.noteToMarkdown({
    title: 'Compras', type: 'checklist', labels: ['Casa'],
    checklist_items: [{ text: 'Café', completed: true }, { text: 'Pão', completed: false }]
  });
  assert.match(md, /^# Compras/);
  assert.match(md, /- \[x\] Café/);
  assert.match(md, /- \[ \] Pão/);
  assert.match(md, /Marcadores:\*\* Casa/);
});

test('flashcards parse from the AI JSON and study requests use the configured model', async t => {
  const w = await boot(t);
  const app = w.App;
  w.localStorage.setItem(app.ai.apiKeyStorageKey, 'test-key-placeholder');
  const requests = [];
  w.fetch = async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    const text = JSON.stringify([{ pergunta: 'O que é derivada?', resposta: 'Taxa de variação.' }]);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }));
  };
  app.extras.openStudyModal();
  app.extras.setAllStudyNotes(true);
  await app.extras.runStudy('flashcards');
  assert.equal(app.extras.flashcards.length, 1);
  assert.equal(w.document.getElementById('flashQ').textContent, 'O que é derivada?');
  assert.equal(new URL(requests[0].url).pathname, `/v1beta/models/${app.ai.modelName}:generateContent`);
  assert.equal(requests[0].body.generationConfig.responseMimeType, 'application/json');
});

test('keyboard shortcuts open the help, create notes and cycle the theme', async t => {
  const w = await boot(t);
  const app = w.App;
  const key = (k, extra = {}) => w.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...extra }));
  key('?');
  assert.equal(w.document.getElementById('shortcutsModal').classList.contains('hidden'), false);
  key('Escape');
  await tick(200);
  assert.equal(w.document.getElementById('shortcutsModal').classList.contains('hidden'), true);
  key('n');
  assert.equal(app.creatorExpanded.classList.contains('hidden'), false);
  app.saveAndCollapseNoteCreator();
  const before = app.theme;
  key('t');
  assert.notEqual(app.theme, before);
  key('g'); key('k');
  assert.equal(app.activeView, 'kanban');
});
