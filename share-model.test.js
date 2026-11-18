'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const sandbox = {window: {}};
vm.runInNewContext(fs.readFileSync('share-model.js', 'utf8'), sandbox, {filename: 'share-model.js'});
const Share = sandbox.window.ShareModel;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('PASS ' + name); }
  catch (error) { failed += 1; console.error('FAIL ' + name + '\n' + error.stack); }
}
const opps = [
  {id: 'GM-001', org: 'Mears Group', entity: 'Mears Limited', parent: 'Mears Group plc owns 100% (PSC).'},
  {id: 'GM-002', org: 'Serco', entity: 'Serco Limited', parent: 'Serco Holdings Ltd (PSC). ultimate parent Serco Group plc.'},
  {id: 'GM-015', org: 'Centennial Property Limited', entity: 'Centennial Property Limited', parent: 'No corporate parent: two individual PSCs.'}
];
test('a ceiling is not split across unnamed or partial supplier lists', () => {
  const built = Share.build({
    region: {id: 'GM', label: 'Greater Manchester', bip: ['UKD33']},
    opps,
    bip: {
      a: {id: 'a', region: 'UKD33', title: 'Named award', buyer: 'Council', value: 1000, suppliers: 'Centennial Property Limited', url: 'https://app.bipintelligence.com/x'},
      b: {id: 'b', region: 'UKD33', title: 'Unsplit ceiling', buyer: 'Council', value: 9000, suppliers: '14 suppliers', url: ''},
      c: {id: 'c', region: 'UKD33', title: 'Partial list', buyer: 'Council', value: 8000, suppliers: '8 incl. Rent Connect', url: ''}
    }
  });
  assert.equal(built.metric, 'value');
  assert.equal(built.contracts.length, 1);
  assert.equal(built.skipped.length, 2);
  assert.equal(built.top.name, 'Centennial Property Limited');
  assert.equal(built.top.share, 100);
  assert.equal(built.mack, null);
});
test('lot places stay separate from award counts and Mack is the recorded Mack Opco name', () => {
  const built = Share.build({
    region: {id: 'National', label: 'National', bip: []},
    opps,
    bip: {
      lots: {id: 'lots', region: 'England and Wales', title: 'Framework', buyer: 'MoJ', value: 200, suppliers: 'Mears Limited and others', lotSuppliers: {A: ['Mears Limited', 'Mack Opco Ltd'], B: ['Serco Limited']}, url: 'https://app.bipintelligence.com/award'},
      count: {id: 'count', region: 'National', title: 'List', buyer: 'Council', value: 50, suppliers: 'Mears Limited; Serco Limited', url: ''}
    }
  });
  assert.equal(built.metric, 'lots');
  assert.equal(built.contracts.find((row) => row.id === 'count').metric, 'awards');
  assert.equal(built.groups.map((row) => row.name).sort().join('|'), 'Mack Living|Mears Group|Serco Group');
  assert.ok(built.groups.every((row) => row.share === 33.3));
  assert.equal(built.mack.name, 'Mack Living');
  assert.equal(built.mack.entities[0], 'Mack Opco Ltd');
  assert.ok(built.takeaway.indexOf(';') === -1);
  assert.ok(built.otherMetrics.indexOf('Share by award count') !== -1);
});
test('real Greater Manchester share uses only supplier-level awards', () => {
  const v4 = JSON.parse(fs.readFileSync('v4-enrich.json', 'utf8'));
  const built = Share.build({region: {id: 'GM', label: 'Greater Manchester', bip: ['UKD3', 'UKD33']}, opps: v4.opps, bip: v4.bip});
  assert.equal(built.metric, 'value');
  assert.equal(built.contracts.length, 1);
  assert.equal(built.contracts[0].id, 'BE-06');
  assert.equal(built.top.share, 100);
  assert.ok(built.skipped.length > 0);
  const bristol = Share.build({region: {id: 'BRS', label: 'Bristol', bip: ['UKK11']}, opps: v4.opps, bip: v4.bip});
  assert.equal(bristol.metric, 'awards');
  assert.ok(bristol.groups.every((row) => row.share === 14.3));
  assert.equal(bristol.groups.some((row) => row.name === 'Places for People Living+'), true);
  assert.equal(bristol.groups.some((row) => /Great Places/.test(row.name)), false);
});
if (failed) process.exit(1);
