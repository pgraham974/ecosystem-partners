'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.join(__dirname);
const sandbox = {window: {}, Intl};
vm.runInNewContext(fs.readFileSync(path.join(root, 'group-model.js'), 'utf8'), sandbox, {filename: 'group-model.js'});
vm.runInNewContext(fs.readFileSync(path.join(root, 'boardroom-model.js'), 'utf8'), sandbox, {filename: 'boardroom-model.js'});
const Model = sandbox.window.BoardroomModel;
const Group = sandbox.window.GroupModel;
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const input = {
  today: '2026-11-17',
  region: 'GM',
  frameworks: read('frameworks.json'),
  v4: read('v4-enrich.json'),
  lha: read('market-lha.json'),
  position: read('portfolio-position.json').regions
};
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('PASS ' + name); }
  catch (error) { failed += 1; console.error('FAIL ' + name + '\n' + error.stack); }
}
const gm = Model.build(input);
test('Greater Manchester hides Gloucester and Bristol schemes', () => {
  assert.equal(gm.region.label, 'Greater Manchester');
  assert.equal(gm.contracts.areas, 1);
  assert.equal(gm.schemes.some((row) => /Trevone/.test(row.name)), false);
  assert.equal(gm.schemes.some((row) => /STAF/.test(row.name)), false);
  assert.equal(gm.schemes.some((row) => /Housing Related Support/.test(row.name)), true);
});
test('LHA beds come from the reference BRMA and are not invented', () => {
  const by = Object.fromEntries(gm.rates.map((row) => [row.key, row.reference]));
  assert.equal(by.shared, 411.58);
  assert.equal(by['1'], 775);
  assert.equal(by['2'], 875);
  assert.equal(by['3'], 950);
  assert.equal(by['4'], 1350);
  assert.equal(gm.rates.every((row) => row.omr == null && row.gap == null), true);
});
test('operator places use BiP and do not double count the same framework', () => {
  const hrs = gm.ranked.find((row) => /Housing Related Support/.test(row.name));
  assert.equal(hrs.operators.count, 14);
  assert.equal(hrs.operators.names.length, 0);
  const cas = gm.ranked.find((row) => /Community Accommodation Service \(CAS\) Open Framework/.test(row.name));
  assert.ok(cas.operators.names.length > 10);
  assert.equal(cas.bip.includes('BE-01'), true);
});
test('blank portfolio and open market stay not recorded', () => {
  assert.equal(gm.portfolio.deals, null);
  assert.equal(gm.portfolio.held, null);
  assert.equal(gm.portfolio.targets, null);
  assert.equal(gm.omrKnown, false);
  assert.equal(gm.lights.find((row) => row.label === 'Deals and holdings').detail, 'Not yet recorded');
});
test('an entered open market rent creates a gap against the reference LHA only', () => {
  const position = JSON.parse(JSON.stringify(input.position));
  position.GM.omr['2'] = 1000;
  position.GM.omr.source = 'Entered on the position sheet';
  const next = Model.build({...input, position});
  const two = next.rates.find((row) => row.key === '2');
  assert.equal(two.gap, 125);
  assert.equal(next.rates.find((row) => row.key === '1').gap, null);
});
test('copy has no semicolon or dash', () => {
  assert.equal(Group.scanCopy(gm.verdict).length, 0);
  assert.equal(Group.scanCopy(gm.lights).length, 0);
  assert.equal(Group.scanCopy(gm.lhaProvenance).length, 0);
});
if (failed) process.exit(1);
