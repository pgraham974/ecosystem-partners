'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const sandbox = {window: {}, Intl, document: {body: {classList: {contains() { return false; }}}}};
for (const file of ['group-model.js', 'acquisition-channels.js', 'auction-counts.js', 'boardroom-model.js', 'boardroom-ui.js']) {
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, {filename: file});
}
const Model = sandbox.window.BoardroomModel;
const UI = sandbox.window.BoardroomUI;
const read = (name) => JSON.parse(fs.readFileSync(name, 'utf8'));
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('PASS ' + name); }
  catch (error) { failed += 1; console.error('FAIL ' + name + '\n' + error.stack); }
}
function host() {
  return {innerHTML: '', querySelector() { return null; }, querySelectorAll() { return []; }};
}
const ons = {areas: {Manchester: {month: 'Sep 2026', b1: 1007, b2: 1239, b3: 1441, b4: 2024}}};
const built = Model.build({
  today: '2026-11-18',
  region: 'GM',
  priorityRegion: 'GM',
  frameworks: read('frameworks.json'),
  v4: read('v4-enrich.json'),
  lha: read('market-lha.json'),
  position: read('portfolio-position.json').regions,
  ons,
  auctions: read('auction-targets.json'),
  onMarket: read('on-market-targets.json'),
  hurdle: 0.075
});
const node = host();
UI.render(node, built, {});
const html = node.innerHTML;
test('the executive view is one rent matrix plus three acquisition channels', () => {
  assert.equal(html.split('<h2>Rent matrix</h2>').length, 2);
  assert.equal(html.includes('>LHA 2026/27 (pcm)<'), true);
  assert.equal(html.includes('>Open market (pcm)<'), true);
  assert.equal(html.includes('>Gap £ (pcm)<'), true);
  assert.equal(html.includes('>Gap %<'), true);
  assert.equal(html.split('<h2>Widest LHA gap</h2>').length, 1);
  assert.equal(html.includes('Off-market'), true);
  assert.equal(html.includes('Auction'), true);
  assert.equal(html.includes('On-market'), true);
  assert.equal(html.includes('no feed yet'), true);
  assert.equal(html.includes('>15<'), true);
  assert.equal(html.includes('triage and pre-qualification only'), true);
  assert.equal(html.includes('not held in the dashboard'), true);
  assert.equal(html.includes('Businesses operating in this space'), true);
  assert.equal(html.includes('7 from BiP Tracker'), true);
  assert.equal(html.includes('Manchester, Edinburgh, Birmingham, Liverpool and Cheshire'), true);
  assert.equal(html.includes('\u2013'), false);
  assert.equal(html.includes('\u2014'), false);
  assert.equal(html.includes('Detailed board'), true);
  assert.equal(html.includes('>Timeline<'), false);
});
test('an empty priority region states that no framework is recorded', () => {
  const empty = Model.build({
    today: '2026-11-18',
    region: 'BIR',
    frameworks: read('frameworks.json'),
    v4: read('v4-enrich.json'),
    lha: read('market-lha.json'),
    position: read('portfolio-position.json').regions,
    ons: {areas: {}},
    auctions: read('auction-targets.json'),
    onMarket: read('on-market-targets.json')
  });
  const box = host();
  UI.render(box, empty, {});
  assert.equal(box.innerHTML.includes('No open framework is recorded for this area yet.'), true);
  assert.equal(box.innerHTML.includes('Not yet recorded'), true);
  assert.equal(box.innerHTML.includes('no feed yet'), true);
  assert.equal(box.innerHTML.includes('\u2013') || box.innerHTML.includes('\u2014'), false);
});
test('rentTable is a single matrix for bedroom rows', () => {
  const table = UI.rentTable(built);
  assert.equal(table.split('<h2>').length, 2);
  assert.equal(table.includes('1 bed'), true);
  assert.equal(table.includes('£875'), true);
  assert.equal(table.includes('£1,239'), true);
  assert.equal(table.includes(Model.money(875 - 1239)), true);
});
if (failed) process.exit(1);
