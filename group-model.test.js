'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.join(__dirname);
const sandbox = {window: {}};
vm.runInNewContext(fs.readFileSync(path.join(root, 'group-model.js'), 'utf8'), sandbox, {filename: 'group-model.js'});
vm.runInNewContext(fs.readFileSync(path.join(root, 'market-score.js'), 'utf8'), sandbox, {filename: 'market-score.js'});
const Model = sandbox.window.GroupModel;
const Score = sandbox.window.MarketScore;
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const weights = read('scoring-weights.json');
const monday = read('mack-monday.json');
const evidence = read('analysis-evidence.json');
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('PASS ' + name); }
  catch (error) { failed += 1; console.error('FAIL ' + name + '\n' + error.stack); }
}
test('current weights match the live scorer and total 100', () => {
  assert.deepEqual(weights.sets.current.weights, JSON.parse(JSON.stringify(Score.DEFAULT_WEIGHTS)));
  Model.checkWeights(weights.sets.current.weights);
  Model.checkWeights(weights.sets.proposed.weights);
});
test('proposed weights are labelled proposed and are not agreed', () => {
  assert.equal(weights.sets.proposed.status, 'proposed');
  assert.equal(weights.sets.proposed.agreed, false);
  assert.equal(weights.agreed, false);
  assert.match(weights.agreement, /not agreed/);
  assert.match(weights.agreement, /Luke and Liza/);
});
test('proposed set moves weight from size and net assets toward profit and governance', () => {
  const current = Model.groupTotals(weights.groups, weights.sets.current.weights);
  const proposed = Model.groupTotals(weights.groups, weights.sets.proposed.weights);
  const byId = (rows) => Object.fromEntries(rows.map((row) => [row.id, row.points]));
  assert.deepEqual(byId(current), {financial: 55, ownership: 10, size: 25, other: 10});
  assert.deepEqual(byId(proposed), {financial: 50, ownership: 20, size: 20, other: 10});
  assert.equal(weights.sets.proposed.weights.profit, 20);
  assert.equal(weights.sets.proposed.weights.governance, 20);
  assert.equal(weights.sets.proposed.weights.assets, 10);
});
test('proposed weights score the Mack snapshot without inventing missing turnover', () => {
  const partners = read('partners.json');
  const mack = partners.partners.find((row) => row.no === '05543523');
  const today = '2026-11-10';
  const current = Score.evaluate(mack, {today, weights: weights.sets.current.weights});
  const proposed = Score.evaluate(mack, {today, weights: weights.sets.proposed.weights});
  assert.equal(current.score, 60);
  assert.equal(current.unknown.includes('revenue'), true);
  assert.equal(proposed.unknown.includes('revenue'), true);
  assert.equal(proposed.unknown.includes('profit'), true);
  assert.equal(proposed.dimensions.find((row) => row.key === 'governance').points, 0);
  assert.equal(proposed.dimensions.find((row) => row.key === 'assets').points, 10);
  assert.ok(proposed.score < current.score);
});
test('Monday regions are seeded and marked placeholder to confirm', () => {
  assert.deepEqual(monday.regions.map((row) => row.id), ['GM', 'BRS', 'GLOS', 'EDI']);
  for (const region of monday.regions) assert.equal(region.status, 'placeholder to confirm');
  const ids = new Set(read('mack-living.json').contracts.map((row) => row.id));
  for (const id of monday.contractIds) assert.equal(ids.has(id), true, id);
});
test('Manchester CAS is blank and carries the verification status', () => {
  const card = evidence.manchesterCas;
  assert.equal(card.name, 'Manchester CAS');
  assert.equal(card.status, 'to verify with Chris and bid contacts');
  assert.equal(Model.blankCard(card), true);
});
test('benchmarks keep only the cited Bristol rents and mark the rest to be supplied', () => {
  const cited = evidence.benchmarks.filter((row) => row.value !== 'to be supplied');
  assert.equal(cited.length, 1);
  assert.equal(cited[0].regionId, 'BRS');
  assert.match(cited[0].sourceUrl, /^https:\/\/www\.bristol\.gov\.uk\//);
  assert.equal(cited[0].observedAt, '2026-11-03');
  assert.ok(evidence.benchmarks.filter((row) => row.topic === 'Guaranteed rent').every((row) => row.value === 'to be supplied'));
  assert.ok(evidence.benchmarks.filter((row) => row.topic === 'Management fee').every((row) => row.value === 'to be supplied'));
});
test('LHA citation uses the official 2026/27 publication and the spot-checked rows match the file', () => {
  const lha = read('market-lha.json');
  assert.equal(evidence.lha.period, '2026/27');
  assert.equal(evidence.lha.publicationUrl, lha.source_url);
  assert.equal(evidence.lha.publicationUpdated, '2026-04-08');
  assert.equal(evidence.lha.spotCheck, '2026-11-10');
  const expected = {
    'Central Greater Manchester': [411.58, 775, 875, 950, 1350],
    'Southern Greater Manchester': [411.58, 625, 750, 900, 1400],
    'Bolton and Bury': [341.51, 475, 575, 700, 950],
    'Oldham and Rochdale': [344.83, 475, 577.5, 695, 950],
    Wigan: [339.83, 400, 500, 595, 775],
    Bristol: [511.33, 900, 1095, 1300, 1850],
    Cheltenham: [436.5, 625, 800, 1000, 1470],
    Gloucester: [406.33, 550, 725, 850, 1200]
  };
  for (const name of evidence.lha.brmas) {
    const row = lha.rates.find((item) => item.name === name && item.country === 'England');
    assert.ok(row, name);
    assert.deepEqual([row.SAR, row['1'], row['2'], row['3'], row['4']], expected[name]);
  }
});
test('dataset catalogue dates match the source files', () => {
  const actual = {
    'partners.json': read('partners.json').updated,
    'rp_charities.json': read('rp_charities.json').updated,
    'operators.json': read('operators.json').updated,
    'frameworks.json': read('frameworks.json').updated,
    'sheets_public.json': read('sheets_public.json').importedAt,
    'v4-enrich.json': read('v4-enrich.json').built.slice(0, 10),
    'market-lha.json': read('market-lha.json').retrieved,
    'mack-living.json': read('mack-living.json').updated,
    'mack-monday.json': monday.updated,
    'scoring-weights.json': weights.updated,
    'competitors.json': read('competitors.json').updated,
    'analysis-evidence.json': evidence.updated
  };
  assert.equal(Model.datasetMismatches(evidence.datasets, actual).length, 0);
});
test('new copy has no semicolon or dash', () => {
  const files = ['scoring-weights.json', 'mack-monday.json', 'analysis-evidence.json'];
  for (const file of files) assert.equal(Model.scanCopy(read(file)).length, 0, file);
  assert.equal(Model.scanCopy(Model.COPY).length, 0);
});
test('BiP reference uses the existing build date and does not replace the feed', () => {
  const refresh = read('build/bip_refresh.json');
  const enrich = read('v4-enrich.json');
  assert.equal(evidence.bip.built, enrich.built.slice(0, 10));
  assert.equal(evidence.bip.refreshChecked, refresh.checked);
  assert.equal(evidence.bip.view, 'analysis/frameworks');
  assert.match(evidence.bip.source, /v4-enrich.json/);
  assert.equal(evidence.vip, undefined);
});
test('64 competitors restored and linked to current ids', () => {
  const file = read('competitors.json');
  const enrich = read('v4-enrich.json');
  const ids = new Set(enrich.opps.map((row) => row.id).concat(enrich.newItems.map((row) => row.id)));
  const bip = new Set(Object.keys(enrich.bip));
  assert.equal(file.count, 64);
  assert.equal(file.competitors.length, 64);
  assert.equal(file.recoveredFrom, 'd847727 mack-pipeline.json');
  const mears = file.competitors.find((row) => row.id === 'GM-001');
  assert.equal(mears.name, 'Mears Group');
  assert.equal(mears.entity, 'Mears Limited');
  assert.deepEqual(mears.bip, ['BE-01', 'BE-19']);
  assert.ok(mears.competesOn.some((link) => link.id === 'MJ-001'));
  assert.ok(mears.competesOn.some((link) => link.id === 'GM-046'));
  const places = file.competitors.find((row) => row.competesOn.some((link) => link.was === 'MP-19'));
  assert.equal(places.competesOn.find((link) => link.was === 'MP-19').id, 'NEW-PFP-DECANT');
  for (const row of file.competitors) {
    for (const award of row.bip) assert.equal(bip.has(award), true, row.id + ' ' + award);
    for (const link of row.competesOn) if (link.id) assert.equal(ids.has(link.id), true, link.id);
  }
  assert.equal(Model.filterCompetitors(file.competitors, '').length, 64);
  assert.equal(Model.filterCompetitors(file.competitors, 'Greater Manchester').length, 27);
  assert.equal(Model.filterCompetitors(file.competitors, 'England and Wales').length, 31);
  assert.equal(JSON.stringify(file).includes('\u2014') || JSON.stringify(file).includes('\u2013'), false);
});
if (failed) process.exit(1);
