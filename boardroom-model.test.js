'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.join(__dirname);
const sandbox = {window: {}, Intl};
vm.runInNewContext(fs.readFileSync(path.join(root, 'group-model.js'), 'utf8'), sandbox, {filename: 'group-model.js'});
vm.runInNewContext(fs.readFileSync(path.join(root, 'acquisition-channels.js'), 'utf8'), sandbox, {filename: 'acquisition-channels.js'});
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
test('ONS Manchester rents and the LHA gap are computed, not typed as a target count', () => {
  const ons = {source: 'ONS Price Index of Private Rents, released 21 October 2026', url: 'https://www.ons.gov.uk/economy/inflationandpriceindices/datasets/priceindexofprivaterentsukmonthlypricestatistics', areas: {'Manchester': {month: 'Sep 2026', all: 1380, b1: 1007, b2: 1239, b3: 1441, b4: 2024}, 'Bristol, City of': {month: 'Sep 2026', b1: 1230, b2: 1551, b3: 1769, b4: 2558}}};
  const next = Model.build({...input, ons, auctions: {regions: {GM: {matched: 6, unknown: 116, current: 137}}}});
  const two = next.rates.find((row) => row.key === '2');
  assert.equal(two.omr, 1239);
  assert.equal(two.gap, 875 - 1239);
  assert.equal(two.gapPercent, Math.round(((875 - 1239) / 1239) * 1000) / 10);
  assert.equal(next.rates.find((row) => row.key === 'shared').omr, null);
  assert.equal(next.rates.find((row) => row.key === '4').onsLabel, '4 or more');
  assert.equal(next.portfolio.targets.matched, 6);
  assert.equal(next.portfolio.targets.unknown, 116);
  const bristol = Model.build({...input, region: 'BRS', ons});
  assert.equal(bristol.rates.find((row) => row.key === '2').omr, 1551);
});
test('copy has no semicolon or dash', () => {
  assert.equal(Group.scanCopy(gm.verdict).length, 0);
  assert.equal(Group.scanCopy(gm.lights).length, 0);
  assert.equal(Group.scanCopy(gm.lhaProvenance).length, 0);
});
test('Deals areas use their own BRMA and do not copy Manchester', () => {
  const ons = {areas: {Liverpool: {month: 'Sep 2026', b1: 688, b2: 840, b3: 967, b4: 1298}, 'Greater Glasgow': {month: 'Sep 2026', b1: 845, b2: 1091, b3: 1340, b4: 2284}, Lothian: {month: 'Sep 2026', b1: 1036, b2: 1324, b3: 1600, b4: 2200}}};
  const liv = Model.build({...input, region: 'LIV', ons});
  assert.equal(liv.region.label, 'Liverpool');
  assert.equal(liv.region.reference, 'Greater Liverpool');
  assert.equal(liv.rates.find((row) => row.key === '2').reference, 595);
  assert.equal(liv.rates.find((row) => row.key === '2').omr, 840);
  assert.equal(liv.contracts.schemes, 0);
  assert.equal(liv.lights.find((row) => row.label === 'Operator coverage').detail, 'Not yet recorded');
  const gla = Model.build({...input, region: 'GLA', ons});
  assert.equal(gla.rates.find((row) => row.key === '2').reference, 850);
  assert.equal(gla.region.reference, 'Greater Glasgow');
  const edi = Model.build({...input, region: 'EDI', ons});
  assert.equal(edi.region.reference, 'Lothian');
  assert.equal(edi.rates.find((row) => row.key === '1').omr, 1036);
  const chel = Model.build({...input, region: 'GLOS'});
  assert.equal(chel.region.label, 'Cheltenham');
  assert.ok(chel.contracts.schemes > 0);
  assert.equal(Model.gapBand(-33.3), 'bad');
  assert.equal(Model.gapBand(-9.9), 'good');
  assert.equal(Model.gapBand(10), 'mid');
  assert.equal(Model.gapBand(25), 'mid');
  assert.equal(Model.gapBand(null), 'na');
  assert.equal(Group.scanCopy(liv.lhaProvenance).length, 0);
  assert.equal(Group.scanCopy(liv.ons.note).length, 0);
});
test('the executive snapshot keeps Manchester counts and does not invent deals', () => {
  assert.equal(Model.PRIORITY_REGION, 'GM');
  assert.equal([...Model.PRIORITY_IDS].join(','), 'GM,EDI,BIR,LIV,CHS');
  assert.equal(gm.executive.schemes, 19);
  assert.equal(gm.executive.fromBip, 7);
  assert.equal(gm.executive.deals, null);
  assert.equal(gm.executive.held, null);
  assert.equal(gm.executive.open.length, gm.schemes.filter((row) => Model.isOpenStatus(row.status)).length);
  assert.equal(gm.executive.open.some((row) => row.status === 'Closed'), false);
  assert.ok(gm.executive.open.length > 0);
  assert.ok(gm.executive.open.length < gm.executive.schemes);
  assert.equal(gm.executive.priorityRegion, 'GM');
  assert.match(gm.executive.operatorLine, /businesses operating in this space/);
  assert.match(gm.executive.note, /triage and pre-qualification only/);
  assert.match(gm.executive.note, /not held in the dashboard/);
  assert.equal(Group.scanCopy(gm.executive.note).length, 0);
  assert.equal(Group.scanCopy(gm.executive.operatorLine).length, 0);
  assert.equal(Group.scanCopy(gm.channels.offMarket.note).length, 0);
  assert.equal(Group.scanCopy(gm.channels.auction.note).length, 0);
  assert.equal(Group.scanCopy(gm.channels.onMarket.note).length, 0);
});
test('priority regions without a framework file stay empty and keep their own LHA', () => {
  const ons = {areas: {Birmingham: {month: 'Sep 2026', b1: 800, b2: 950, b3: 1100, b4: 1400}, Liverpool: {month: 'Sep 2026', b2: 840}, 'Cheshire West and Chester': {month: 'Sep 2026', b2: 900}, Lothian: {month: 'Sep 2026', b1: 1036, b2: 1324}}};
  const bir = Model.build({...input, region: 'BIR', ons, priorityRegion: 'GM'});
  assert.equal(bir.region.label, 'Birmingham');
  assert.equal(bir.executive.schemes, 0);
  assert.equal(bir.executive.open.length, 0);
  assert.equal(bir.executive.operatorLine, 'Not yet recorded');
  assert.equal(bir.rates.find((row) => row.key === '2').reference, 750);
  assert.equal(bir.rates.find((row) => row.key === '2').omr, 950);
  const liv = Model.build({...input, region: 'LIV', ons});
  assert.equal(liv.executive.schemes, 0);
  assert.equal(liv.rates.find((row) => row.key === '2').reference, 595);
  const chs = Model.build({...input, region: 'CHS', ons});
  assert.equal(chs.region.reference, 'West Cheshire');
  assert.equal(chs.rates.find((row) => row.key === '2').reference, 675);
  assert.equal(chs.rates.find((row) => row.key === '2').omr, 900);
  assert.equal(chs.executive.schemes, 0);
  const edi = Model.build({...input, region: 'EDI', ons});
  assert.equal(edi.rates.find((row) => row.key === '2').reference, 970);
  assert.equal(edi.executive.deals, null);
});
test('auction and on-market counts come from files and off-market has no feed', () => {
  const auctions = read('auction-targets.json');
  const onMarket = read('on-market-targets.json');
  const next = Model.build({...input, auctions, onMarket});
  assert.equal(next.channels.offMarket.count, 0);
  assert.equal(next.channels.offMarket.feed, false);
  assert.equal(next.channels.offMarket.note, 'no feed yet');
  assert.equal(next.channels.offMarket.items.length, 0);
  assert.equal(next.channels.auction.loaded, true);
  assert.equal(next.channels.auction.count, next.channels.auction.items.length);
  assert.equal(next.channels.auction.count, auctions.regions.GM.current);
  assert.equal(next.channels.onMarket.count, 15);
  assert.equal(next.channels.onMarket.feed, true);
  assert.equal(next.channels.onMarket.items.every((row) => row.region === 'GM'), true);
  const edi = Model.build({...input, region: 'EDI', auctions, onMarket});
  assert.equal(edi.channels.onMarket.count, 0);
  assert.equal(edi.channels.onMarket.feed, true);
  assert.match(edi.channels.onMarket.note, /No on-market listing is recorded for this area/);
  assert.equal(edi.channels.auction.count, auctions.regions.EDI.current);
  const bare = Model.build(input);
  assert.equal(bare.channels.auction.count, null);
  assert.equal(bare.channels.onMarket.count, null);
  assert.equal(Group.scanCopy(next.channels.onMarket.note).length, 0);
  assert.equal(Group.scanCopy(edi.channels.onMarket.note).length, 0);
});
if (failed) process.exit(1);
