'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.join(__dirname);
const sandbox = {window: {}};
vm.runInNewContext(fs.readFileSync(path.join(root, 'ml-commercial.js'), 'utf8'), sandbox, {filename: 'ml-commercial.js'});
const api = sandbox.window.MlCommercial;
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const built = api.build({
  living: read('mack-living.json'),
  frameworks: read('frameworks.json'),
  v4: read('v4-enrich.json'),
  manchester: read('analysis-evidence.json').manchesterCas,
  today: '2026-11-10'
});
const byId = Object.fromEntries(built.cards.map((row) => [row.id, row]));
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('PASS ' + name); }
  catch (error) { failed += 1; console.error('FAIL ' + name + '\n' + error.stack); }
}
test('routes, terms, notices, appointment and Manchester CAS are all present', () => {
  assert.equal(built.cards.length, 8 + 6 + 3 + 1 + 1);
  assert.ok(byId['bristol-private-renting']);
  assert.ok(byId['mack-appointment']);
  assert.ok(byId['NEW-CAS3-P1476']);
  assert.ok(byId['T01']);
  assert.ok(byId['manchester-cas']);
});
test('unknown commercial terms stay blank', () => {
  const bristol = byId['bristol-private-renting'];
  assert.equal(bristol.rentLevel, 'not stated');
  assert.equal(bristol.leaseType, 'to confirm');
  assert.equal(JSON.stringify(bristol).includes('800'), false);
  const aasc = byId['aasc-landlord-supply'];
  assert.equal(aasc.leaseType, 'Guaranteed rent');
  assert.equal(aasc.termMonths, null);
  assert.equal(aasc.length, 'not stated');
  const manchester = byId['manchester-cas'];
  assert.equal(manchester.status, 'to verify with Chris and bid contacts');
  for (const key of ['length', 'rentBasis', 'rentLevel', 'voids', 'repairs', 'units', 'buyer']) assert.equal(manchester[key], 'not stated', key);
  assert.equal(manchester.leaseType, 'to confirm');
});
test('summary uses only stated term, deadline and unit figures', () => {
  assert.equal(built.summary.nearest, '2026-11-16');
  assert.equal(built.summary.units, 66);
  assert.equal(built.summary.longest, '10 years');
  assert.equal(byId['T04'].rentLevel.includes('925'), true);
  assert.equal(byId['gm-empty-homes-leasing'].unitsNumber, null);
});
test('filters and sorts do not add records', () => {
  assert.equal(api.filterCards(built.cards, {region: 'GLOS'}).every((row) => row.regions.includes('GLOS')), true);
  const byTerm = api.sortCards(built.cards, 'term');
  assert.equal(byTerm[0].termMonths >= byTerm[1].termMonths, true);
  const byDate = api.sortCards(built.cards, 'deadline');
  assert.equal(byDate[0].deadline, '2026-11-16');
});
test('authored card text has no dash or semicolon', () => {
  const authored = JSON.stringify(built.cards.map((row) => [row.length, row.rentBasis, row.voids, row.repairs, row.breaks, row.deadlineLabel, row.leaseType, row.status]));
  assert.equal(authored.includes('\u2014') || authored.includes('\u2013') || authored.includes(';'), false);
});
if (failed) process.exit(1);
