'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const sandbox = {window: {}, Intl};
for (const file of ['boardroom-model.js', 'share-model.js', 'auction-counts.js', 'triage-model.js', 'analytics-model.js']) {
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, {filename: file});
}
const Model = sandbox.window.AnalyticsModel;
const regions = sandbox.window.BoardroomModel.REGIONS;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('PASS ' + name); }
  catch (error) { failed += 1; console.error('FAIL ' + name + '\n' + error.stack); }
}
const ons = {areas: {Manchester: {month: 'Sep 2026', b1: 1007, b2: 1239, b3: 1441, b4: 2024}}};
const lha = JSON.parse(fs.readFileSync('market-lha.json', 'utf8'));
const signals = JSON.parse(fs.readFileSync('public-signals.json', 'utf8'));
test('mixed value bases are not added into one total', () => {
  const kpi = Model.valueKpi([
    {value: 100, basis: 'Awarded value'},
    {value: 50, basis: 'Ceiling'}
  ]);
  assert.equal(kpi.value, 'Not one total');
  assert.ok(kpi.note.indexOf('no single total') > -1);
  assert.equal(kpi.note.indexOf(';'), -1);
});
test('the heatmap keeps a blank where ONS is missing and ranks a real gap', () => {
  const pack = Model.build({
    today: '2026-11-18',
    region: regions.find((row) => row.id === 'GM'),
    lha, ons, signals,
    schemes: [],
    bip: {},
    opps: []
  });
  const gm = pack.heatmap.find((row) => row.id === 'GM');
  const liv = pack.heatmap.find((row) => row.id === 'LIV');
  assert.equal(gm.cells[1].text.indexOf('%') > -1, true);
  assert.equal(liv.cells[0].text, 'n/a');
  assert.equal(pack.heatmap.some((row) => row.id === 'National'), false);
  assert.equal(pack.gaps[0].id, 'GM');
  assert.equal(pack.demand.some((row) => row.name === 'National CAS' && row.units === 3000), true);
  assert.equal(pack.demand.some((row) => row.name === 'Glasgow private rented sector accommodation'), false);
  assert.equal(pack.demand.find((row) => row.name === 'Serco').units, null);
});
if (failed) process.exit(1);
