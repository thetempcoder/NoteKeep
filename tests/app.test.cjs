const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

async function boot(t, fetchMock) {
  const dom = new JSDOM(read('index.html'), {
    url: 'http://localhost:8000', runScripts: 'outside-only', pretendToBeVisual: true
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  const errors = [];
  window.addEventListener('error', event => errors.push(event.error));
  t.after(() => assert.deepEqual(errors, [], 'No uncaught UI errors'));
  // jsdom does not implement visual scrolling.
  window.HTMLElement.prototype.scrollIntoView = function () {};
  await new Promise(resolve => window.addEventListener('load', resolve));
  window.fetch = fetchMock;
  window.AbortSignal = AbortSignal;
  window.localStorage.setItem('notekeep_sound_enabled', 'false');
  const context = dom.getInternalVMContext();
  vm.runInContext(read('ai.js'), context);
  vm.runInContext(read('app.js'), context);
  await vm.runInContext('window.App = new NoteKeepApp(); window.App.init()', context);
  return window;
}

test('static PHP response falls back to local storage and buttons work', async t => {
  const w = await boot(t, async () => new Response('<?php echo "source";', {
    headers: { 'Content-Type': 'application/octet-stream' }
  }));
  const app = w.App;
  const click = id => w.document.getElementById(id).click();
  assert.equal(app.storage.backendMode, 'local');
  assert.equal(app.notes.length, 3);
  click('btnToggleTheme');
  assert.equal(w.localStorage.getItem('keep_theme'), 'dark');
  assert.equal(w.document.body.classList.contains('theme-dark'), true);
  click('btnToggleView');
  assert.equal(app.othersGrid.classList.contains('list-view'), true);
  click('btnMenuToggle');
  assert.equal(app.sidebar.classList.contains('collapsed'), true);
  click('creatorCollapsed');
  assert.equal(app.creatorExpanded.classList.contains('hidden'), false);
  app.newNoteTitle.value = 'Teste de regressão';
  app.newNoteContent.value = 'Conteúdo salvo';
  click('btnCloseCreator');
  await tick();
  const note = app.notes.find(n => n.title === 'Teste de regressão');
  assert.ok(note);
  assert.ok(JSON.parse(w.localStorage.getItem('notekeep_notes')).some(n => n.id === note.id));
  w.document.querySelector(`[data-id="${note.id}"]`).click();
  assert.equal(app.editNoteModal.classList.contains('hidden'), false);
  app.modalNoteContent.value = 'Conteúdo editado';
  click('btnCloseModal');
  await tick();
  assert.equal((await app.storage.getNotes()).find(n => n.id === note.id).content, 'Conteúdo editado');
  app.searchInput.value = 'Teste de regressão';
  app.searchInput.dispatchEvent(new w.Event('input'));
  assert.equal(w.document.querySelectorAll('.note-card').length, 1);
  click('btnClearSearch');
  for (const [id, view] of [['navArchive', 'archive'], ['navTrash', 'trash'], ['navKanban', 'kanban'], ['navVault', 'vault'], ['navAi', 'ai'], ['navNotes', 'notes']]) {
    click(id);
    assert.equal(app.activeView, view);
  }
  click('btnOpenLabelsModal');
  app.newLabelInput.value = 'Teste';
  click('btnSaveNewLabel');
  assert.ok(app.labels.some(label => label.name === 'Teste'));
  click('btnCloseLabelsModal');
  click('btnOpenCommandPalette');
  assert.equal(app.commandPalette.modal.classList.contains('hidden'), false);
  app.commandPalette.close();
  click('btnOpenApiKeyModal');
  assert.equal(app.ai.apiKeyModal.classList.contains('hidden'), false);
  click('btnCloseApiKeyModal');
  click('btnQuickChecklist');
  app.newChecklistInput.value = 'Tarefa de teste';
  app.newChecklistInput.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter' }));
  click('btnCloseCreator');
  await tick();
  assert.ok((await app.storage.getNotes()).some(n => n.checklist_items.some(i => i.text === 'Tarefa de teste')));
});

test('valid JSON API is selected', async t => {
  const w = await boot(t, async () => new Response('[]', { headers: { 'Content-Type': 'application/json; charset=utf-8' } }));
  assert.equal(w.App.storage.backendMode, 'api');
  assert.equal(w.App.notes.length, 0);
});

for (const [name, response] of [
  ['network failure', () => { throw new TypeError('Failed to fetch'); }],
  ['HTTP error', () => new Response('Unavailable', { status: 500 })],
  ['invalid JSON', () => new Response('<?php', { headers: { 'Content-Type': 'application/json' } })],
  ['unexpected JSON shape', () => new Response('{}', { headers: { 'Content-Type': 'application/json' } })],
  ['timeout', () => { throw new DOMException('Timed out', 'TimeoutError'); }]
]) {
  test(`${name} keeps the local app usable`, async t => {
    const w = await boot(t, async () => response());
    assert.equal(w.App.storage.backendMode, 'local');
    w.document.getElementById('btnToggleTheme').click();
    assert.equal(w.App.theme, 'dark');
  });
}
