'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.join(__dirname);
const sandbox = {window: {}};
vm.runInNewContext(fs.readFileSync(path.join(root, 'group-model.js'), 'utf8'), sandbox, {filename: 'group-model.js'});
vm.runInNewContext(fs.readFileSync(path.join(root, 'checklist-model.js'), 'utf8'), sandbox, {filename: 'checklist-model.js'});
const Model = sandbox.window.ChecklistModel;
const Group = sandbox.window.GroupModel;
const seedFile = JSON.parse(fs.readFileSync(path.join(root, 'checklist.json'), 'utf8'));
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('PASS ' + name); }
  catch (error) { failed += 1; console.error('FAIL ' + name + '\n' + error.stack); }
}
function seed() { return Model.fromSeed(seedFile); }
function plain(value) { return JSON.parse(JSON.stringify(value)); }
test('starting list keeps the two workstreams and the exact questions', () => {
  const state = seed();
  assert.deepEqual(plain(state.workstreams.map((row) => row.title)), [
    'Local Authority 10-year Lease Agreements',
    'Assembling A Portfolio'
  ]);
  assert.deepEqual(plain(state.workstreams[0].items.map((row) => row.text)), [
    'Understand what is on offer?',
    'Do we want to engage with it?',
    'How do we engage?',
    'How do we complete an engagement and activate deal flow?'
  ]);
  assert.deepEqual(plain(state.workstreams[1].items.map((row) => row.text)), [
    'Is Manchester a good market for you?',
    'What type of property is needed to fulfil this requirement?',
    'Can we realistically access a sufficient volume?',
    'Can we be competitive at a level that meets our acquisition gates?',
    'What specific pathways will we use to identify stock?'
  ]);
});
test('Manchester is already answered Yes and counted as done', () => {
  const state = seed();
  const item = state.workstreams[1].items[0];
  assert.equal(item.id, 'manchester');
  assert.equal(item.done, true);
  assert.equal(item.notes, 'Yes');
  assert.equal(item.status, 'done');
  const summary = Model.summarise(state);
  assert.equal(summary.done, 1);
  assert.equal(summary.total, 9);
  assert.deepEqual(plain(summary.streams.map((row) => [row.done, row.total])), [[0, 4], [1, 5]]);
});
test('seed links point at Manchester evidence, the Market Screen and the acquisition gates', () => {
  const state = seed();
  const byId = (ws, id) => state.workstreams.find((row) => row.id === ws).items.find((row) => row.id === id);
  assert.ok(byId('portfolio', 'manchester').links.some((link) => link.hash === 'analysis/regions'));
  assert.ok(byId('portfolio', 'manchester').links.some((link) => link.hash === 'analysis/lha'));
  assert.ok(byId('portfolio', 'gates').links.some((link) => link.hash === 'analysis/opportunities'));
  assert.ok(byId('portfolio', 'gates').links.some((link) => link.hash === 'market'));
  assert.ok(byId('la-lease', 'offer').links.some((link) => link.hash === 'mack/manchester-long-term-ta'));
  assert.ok(byId('la-lease', 'engage-decision').links.some((link) => link.hash === 'market'));
  assert.equal(byId('portfolio', 'pathways').links.find((link) => link.href).href, 'https://pgraham974.github.io/ecosystem-deals/');
});
test('checklist copy has no semicolon or dash', () => {
  assert.equal(Group.scanCopy(seedFile).length, 0);
});
test('tick and untick stay in step with status', () => {
  let state = seed();
  state = Model.setDone(state, 'la-lease', 'offer', true);
  assert.equal(state.workstreams[0].items[0].done, true);
  assert.equal(state.workstreams[0].items[0].status, 'done');
  assert.equal(Model.summarise(state).done, 2);
  state = Model.setDone(state, 'portfolio', 'manchester', false);
  const manchester = state.workstreams[1].items[0];
  assert.equal(manchester.done, false);
  assert.equal(manchester.status, 'not-started');
  assert.equal(manchester.notes, 'Yes');
  state = Model.setStatus(state, 'la-lease', 'how-engage', 'in-progress');
  const engage = state.workstreams[0].items[2];
  assert.equal(engage.status, 'in-progress');
  assert.equal(engage.done, false);
  state = Model.setStatus(state, 'la-lease', 'how-engage', 'done');
  assert.equal(state.workstreams[0].items[2].done, true);
});
test('notes and owner survive a save and load', () => {
  let state = seed();
  state = Model.setField(state, 'portfolio', 'property-type', 'notes', '1 and 2 bed flats');
  state = Model.setField(state, 'portfolio', 'property-type', 'owner', 'Liza');
  const again = Model.parseImport(Model.serialise(state));
  assert.equal(again.error, undefined);
  const item = again.state.workstreams[1].items[1];
  assert.equal(item.notes, '1 and 2 bed flats');
  assert.equal(item.owner, 'Liza');
  assert.equal(item.text, 'What type of property is needed to fulfil this requirement?');
});
test('items and workstreams can be added and deleted', () => {
  let state = seed();
  let added = Model.addItem(state, 'la-lease', '  Who signs the lease?  ');
  assert.equal(added.error, '');
  assert.equal(added.state.workstreams[0].items.length, 5);
  assert.equal(added.state.workstreams[0].items[4].text, 'Who signs the lease?');
  assert.equal(added.state.workstreams[0].items[4].status, 'not-started');
  const blank = Model.addItem(state, 'la-lease', '   ');
  assert.equal(blank.error, 'Add the item text first.');
  assert.equal(blank.state.workstreams[0].items.length, 4);
  state = Model.deleteItem(added.state, 'la-lease', 'offer').state;
  assert.equal(state.workstreams[0].items.some((row) => row.id === 'offer'), false);
  const stream = Model.addWorkstream(state, 'Funding');
  assert.equal(stream.error, '');
  assert.equal(stream.state.workstreams.length, 3);
  assert.equal(stream.state.workstreams[2].title, 'Funding');
  assert.deepEqual(plain(stream.state.workstreams[2].items), []);
  const unnamed = Model.addWorkstream(state, ' ');
  assert.equal(unnamed.error, 'Add a workstream name first.');
  state = Model.deleteWorkstream(stream.state, 'portfolio').state;
  assert.deepEqual(plain(state.workstreams.map((row) => row.id)), ['la-lease', stream.state.workstreams[2].id]);
});
test('import rejects a file that is not a checklist and drops an unsafe link', () => {
  assert.equal(Model.parseImport('{').error, 'That file is not valid JSON.');
  assert.equal(Model.parseImport('[]').error, 'The file needs a workstreams list.');
  const parsed = Model.parseImport({
    workstreams: [{
      id: 'one',
      title: 'One',
      items: [{
        id: 'a',
        text: 'Question?',
        done: true,
        status: 'not-started',
        links: [
          {label: 'Bad', href: 'javascript:alert(1)'},
          {label: 'Site', href: 'https://pgraham974.github.io/ecosystem-deals/'}
        ]
      }]
    }]
  });
  assert.equal(parsed.state.workstreams[0].items[0].done, false);
  assert.equal(parsed.state.workstreams[0].items[0].status, 'not-started');
  assert.equal(parsed.state.workstreams[0].items[0].links.length, 1);
  assert.equal(parsed.state.workstreams[0].items[0].links[0].href, 'https://pgraham974.github.io/ecosystem-deals/');
});
if (failed) process.exit(1);
