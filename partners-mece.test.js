const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = __dirname;
const sandbox = {console, window: {}};
sandbox.window = sandbox;
vm.runInNewContext(fs.readFileSync(path.join(root, 'market-score.js'), 'utf8'), sandbox);
vm.runInNewContext(fs.readFileSync(path.join(root, 'partner-flow-model.js'), 'utf8'), sandbox);
vm.runInNewContext(fs.readFileSync(path.join(root, 'partners-mece.js'), 'utf8'), sandbox);
const M = sandbox.PartnersMece;
const data = {
  partners: JSON.parse(fs.readFileSync(path.join(root, 'partners.json'), 'utf8')),
  rp: JSON.parse(fs.readFileSync(path.join(root, 'rp_charities.json'), 'utf8')),
  operators: JSON.parse(fs.readFileSync(path.join(root, 'operators.json'), 'utf8'))
};
const sheets = JSON.parse(fs.readFileSync(path.join(root, 'sheets_public.json'), 'utf8'));
const frameworks = JSON.parse(fs.readFileSync(path.join(root, 'frameworks.json'), 'utf8'));
const entities = M.classify(data, {today: '2026-11-05', evaluate: sandbox.MarketScore.evaluate});
const report = M.coverage(data, entities);
const flow = sandbox.PartnerFlowModel.build(sheets, sheets.importedAt);
const ctx = {entities, opportunities: flow.opportunities, frameworks: frameworks.items, sheets};
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
test('directory is a partition with every source record once', () => {
  assert.deepEqual([...report.errors], []);
  assert.equal(report.counts.rp + report.counts.operator + report.counts.other, entities.length);
  assert.ok(report.counts.rp >= 14);
});
test('known overlaps have one home', () => {
  const named = (re) => entities.filter((entity) => re.test(entity.aliases.join(' | ')));
  assert.equal(named(/stepping stone projects/i).length, 1);
  assert.equal(entities.filter((entity) => entity.rp && entity.rp.name.startsWith('ACH')).length, 1);
  assert.equal(entities.filter((entity) => /depaul housing/i.test(entity.name)).length, 1);
  assert.equal(entities.filter((entity) => entity.name === 'DEPAUL UK').length, 1);
  assert.equal(entities.filter((entity) => entity.name === 'Elim Housing' || (entity.operator && /elim housing/i.test(entity.operator.name))).length, 0);
  const living = entities.find((entity) => /places for people living\+/i.test(entity.name));
  assert.ok(living.absorbed.some((note) => /elim/i.test(note.name)));
  assert.equal(entities.filter((entity) => entity.ids.includes('5543523') || entity.name === 'Mack').length, 1);
});
test('top 10 uses published route order and does not invent a score', () => {
  const top = M.filterEntities(entities, {segment: 'rp', top: true});
  assert.equal(top.length, 10);
  assert.equal(top[0].subtype, 'Published landlord route');
  assert.ok(top.every((entity) => entity.segment === 'rp'));
});
test('return check refuses blanks and matches the stated formula', () => {
  const result = M.opportunityReturn({units: 10, rent: 6000, price: 1000000, fees: 50000, works: 50000, costs: 5000, reserve: 5000, loss: 10, debt: 500000, interest: 6, principal: 0, finance: 0});
  assert.equal(result.capital, 1100000);
  assert.equal(result.gross, 60000);
  assert.equal(result.service, 30000);
});
test('agent does not invent a core score or a 5 Nov refresh', () => {
  assert.equal(flow.stats.coreScored, 0);
  const core = M.answer('Why is the core score not calculated?', ctx);
  assert.match(core.text, /not calculated/i);
  assert.match(core.text, /2026-10-20/);
  assert.doesNotMatch(core.text, /refreshed on 5 Nov|successful BiP sync on 5/i);
  const fresh = M.answer('Did BiP refresh this morning on 5 Nov 2026?', ctx);
  assert.match(fresh.text, /No BiP sync dated 5 Nov 2026/);
  assert.equal(entities.some((entity) => entity.screen && entity.screen.score != null), true);
});
test('agent compare, missing demand, draft and navigation stay inside the files', () => {
  const compare = M.answer('Compare Stepping Stone Projects and CCP', ctx);
  assert.equal(compare.trace[0], 'compare_counterparties');
  assert.equal(compare.citations.length, 2);
  assert.match(compare.text, /Screening research/);
  assert.doesNotMatch(compare.text, /[—–]/);
  const missing = M.answer('Which opportunities have no linked demand?', ctx);
  assert.equal(missing.trace[0], 'missing_links');
  assert.ok(missing.citations.length > 0);
  assert.ok(missing.citations.every((cite) => flow.opportunities.find((opp) => opp.id === cite.id && opp.demands.length === 0)));
  const note = M.answer('Draft a screening note for Salix Homes', ctx);
  assert.match(note.text, /Screening note/);
  assert.match(note.text, /Not disclosed|£/);
  assert.doesNotMatch(note.text, /core score: 100|investibility score: /i);
  const open = M.answer('Open frameworks', ctx);
  assert.equal(open.actions[0].view, 'frameworks');
  assert.equal(open.actions[0].auto, true);
  const mack = M.answer('What is MP-01?', ctx);
  assert.match(mack.text, /retired Mack pipeline/);
});
test('published Manchester routes are real RP rows', () => {
  const answer = M.answer('Who has a published landlord route in Manchester?', ctx);
  assert.equal(answer.trace[0], 'search_counterparties');
  assert.ok(answer.citations.length > 0);
  assert.ok(answer.citations.every((cite) => {
    const entity = entities.find((item) => item.id === cite.id);
    return entity.rp && entity.rp.route_status === 'Published landlord route' && entity.cities.some((city) => /manchester/i.test(city));
  }));
});
console.log(passed + ' tests passed; segments ' + JSON.stringify(report.counts));
