'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const sandbox = {window: {}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'triage-model.js'), 'utf8'), sandbox, {filename: 'triage-model.js'});
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'group-model.js'), 'utf8'), sandbox, {filename: 'group-model.js'});
const Triage = sandbox.window.TriageModel;
const Group = sandbox.window.GroupModel;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('PASS ' + name); }
  catch (error) { failed += 1; console.error('FAIL ' + name + '\n' + error.stack); }
}
const region = {id: 'GM', label: 'Greater Manchester', opp: 'GM'};
test('a rent figure is not treated as a public contract length', () => {
  assert.equal(Triage.publicLength(''), '');
  assert.equal(Triage.publicLength('Not published at framework level'), '');
  assert.equal(Triage.publicLength('Rent £875 per month'), '');
  assert.equal(Triage.publicLength('10 years plus 1 day'), '10 years plus 1 day');
});
test('Manchester CAS and a low-confidence framework stay unverified', () => {
  assert.equal(Triage.frameworkUnverified({confidence: 'H', status_n: 'Live (closed to new)', status: 'Live', suppliers: []}), false);
  assert.equal(Triage.frameworkUnverified({confidence: 'H', status_n: 'Forthcoming', status: 'Forthcoming', suppliers: []}), true);
  assert.equal(Triage.frameworkUnverified({confidence: 'L', status_n: 'Live (closed to new)', status: 'Live', suppliers: []}), true);
  assert.equal(Triage.opportunityUnverified({status: 'Eligible', gates: {'G-Req': 'PASS'}}), false);
  assert.equal(Triage.opportunityUnverified({status: 'Qualify: 1 unknown gate(s)', gates: {}}), true);
  const built = Triage.build({
    today: '2026-11-18',
    region,
    schemes: [{id: 'fw-0', name: 'Public framework', status: 'Live', term: '4 years', homes: 12, bip: ['BE-01'], start: {firm: false}, end: {firm: true, iso: '2027-06-01'}, unverified: false}],
    rates: [{gap: -100}],
    auctions: {matched: 6, unknown: 97},
    frameworks: [{name: 'Public framework', confidence: 'L', status_n: 'Live (closed to new)', status: 'Live', suppliers: []}],
    opportunities: [{id: 'GM-046', region: 'Greater Manchester', status: 'Research needed', gates: {}}],
    manchesterCas: {status: 'to verify with Chris and bid contacts'},
    operators: 4,
    median: 260000,
    feed: {updated: '', weeklyTarget: 'Weekly', items: [{id: 'contracts', label: 'Contracts', supplied: false}]}
  });
  assert.equal(built.flags.manchesterCas, 'Unverified');
  assert.equal(built.unverified, 3);
  assert.equal(built.verdict, 'Proceed to underwriting');
  assert.equal(built.example.homes, Math.floor(12500000 / 260000));
  assert.equal(built.feed.awaiting, true);
  assert.equal(JSON.stringify(built).includes('@'), false);
  assert.equal(Group.scanCopy(built.rule).length, 0);
});
test('no schemes and no matching lots is do not pursue', () => {
  const built = Triage.build({today: '2026-11-18', region, schemes: [], rates: [{gap: -1}], auctions: {matched: 0, unknown: 1}, frameworks: [], opportunities: [], feed: {items: []}});
  assert.equal(built.verdict, 'Do not pursue');
});
test('a missing length is needs information and the item is listed', () => {
  const built = Triage.build({
    today: '2026-11-18',
    region,
    schemes: [{id: 'fw-1', name: 'Scheme', status: 'Live', term: '', homes: null, bip: [], start: {firm: false}, end: {firm: false}}],
    rates: [],
    auctions: null,
    frameworks: [],
    opportunities: [],
    feed: {items: []}
  });
  assert.equal(built.verdict, 'Needs information');
  assert.ok(built.missing.some((line) => /contract length/i.test(line)));
  assert.ok(built.missing.some((line) => /open market rent/i.test(line)));
});
test('the watch uses an end date only when no notice is on file', () => {
  const today = '2026-11-18';
  const withNotice = Triage.watch([{id: 'a', name: 'Forthcoming framework', status: 'Forthcoming', start: {firm: true, iso: '2027-04-01'}, end: {firm: true, iso: '2027-08-01'}}], today);
  assert.equal(withNotice.fallback, false);
  assert.equal(withNotice.items[0].kind, 'Due to start');
  const onlyEnd = Triage.watch([{id: 'b', name: 'Live framework', status: 'Live', start: {firm: true, iso: '2024-01-01'}, end: {firm: true, iso: '2027-08-01'}}], today);
  assert.equal(onlyEnd.fallback, true);
  assert.equal(onlyEnd.items[0].kind, 'End date used as a re-procurement signal');
  assert.equal(onlyEnd.items[0].noticeType, 'End-date signal');
  assert.equal(withNotice.items[0].noticeType, 'Start');
  assert.equal(withNotice.items[0].why.indexOf(';'), -1);
});
test('national CAS is on every area and Glasgow PRSA stays in Glasgow', () => {
  const file = JSON.parse(fs.readFileSync(path.join(__dirname, 'public-signals.json'), 'utf8'));
  const national = Triage.signalItems(file, 'GM').find((row) => row.id === 'signal-national-cas');
  const glasgowOnly = Triage.signalItems(file, 'GLA');
  assert.equal(national.kind, 'Reported live');
  assert.equal(national.sources.length, 0);
  assert.ok(national.why.indexOf('3,000') > -1);
  assert.equal(Group.scanCopy(national.why).length, 0);
  assert.equal(Group.scanCopy(glasgowOnly.find((row) => row.id === 'signal-glasgow-prsa').why).length, 0);
  assert.equal(glasgowOnly.some((row) => row.id === 'signal-glasgow-prsa'), true);
  assert.equal(Triage.signalItems(file, 'GM').some((row) => row.id === 'signal-glasgow-prsa'), false);
  assert.equal(glasgowOnly.find((row) => row.id === 'signal-glasgow-prsa').sources[0].label, 'Public Contracts Scotland');
  const merged = Triage.mergeWatch({items: [{id: 'a', name: 'Later', date: '2027-04-01', kind: 'Due to start'}], fallback: false}, [national]);
  assert.equal(merged.items[0].id, 'signal-national-cas');
  assert.equal(Triage.demandItems(file).length, 2);
});
if (failed) process.exit(1);
