'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const sandbox = {window: {}};
vm.runInNewContext(fs.readFileSync('group-model.js', 'utf8'), sandbox, {filename: 'group-model.js'});
vm.runInNewContext(fs.readFileSync('acquisition-channels.js', 'utf8'), sandbox, {filename: 'acquisition-channels.js'});
const Channels = sandbox.window.AcquisitionChannels;
const Group = sandbox.window.GroupModel;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('PASS ' + name); }
  catch (error) { failed += 1; console.error('FAIL ' + name + '\n' + error.stack); }
}
test('auction sale method rows are left out and unknown cities are dropped', () => {
  const rows = Channels.listingsFrom({
    listings: [
      {id: 'a', city: 'Manchester', sale_method: 'private treaty', price_gbp: 100, income_pa: 10, url: 'https://example.test/a', address: 'One'},
      {id: 'b', city: 'Manchester', sale_method: 'auction', price_gbp: 200, url: 'https://example.test/b', address: 'Two'},
      {id: 'c', city: 'Leeds', sale_method: 'private treaty', price_gbp: 300, address: 'Three'},
      {id: 'd', city: 'City Of Bristol', sale_method: 'private treaty', price_gbp: 400, address: 'Four'}
    ]
  });
  assert.deepEqual(rows.map((row) => row.id), ['a', 'd']);
  assert.equal(rows[0].region, 'GM');
  assert.equal(rows[1].region, 'BRS');
  assert.equal(rows[0].price, 100);
  assert.equal(rows[0].income, 10);
});
test('income threshold does not invent a result when price or income is missing', () => {
  const view = Channels.assessIncome([
    {price: 100000, income: 10000},
    {price: 200000, income: 10000},
    {price: null, income: 10000},
    {price: 100000, income: null}
  ], 0.075);
  assert.equal(view.rows[0].threshold, Math.round(10000 / 0.075));
  assert.equal(view.rows[0].result, 'below');
  assert.equal(view.rows[1].result, 'above');
  assert.equal(view.below, 1);
  assert.equal(view.above, 1);
  assert.equal(view.untested, 2);
  assert.equal(Channels.assessIncome(view.rows, null).rows.every((row) => row.result === 'not testable'), true);
});
test('off-market stays at zero and on-market zero is not called a missing feed', () => {
  const pack = Channels.build({region: 'BIR', lots: [], auctionsLoaded: true, onMarket: {updated: '2026-10-22', listings: []}, onMarketUpdated: '2026-10-22'});
  assert.equal(pack.offMarket.count, 0);
  assert.equal(pack.offMarket.note, 'no feed yet');
  assert.equal(pack.offMarket.items.length, 0);
  assert.equal(pack.onMarket.count, 0);
  assert.equal(pack.onMarket.feed, true);
  assert.match(pack.onMarket.note, /No on-market listing is recorded for this area/);
  assert.match(pack.onMarket.note, /Manchester, Cheltenham and Bristol/);
  assert.equal(pack.auction.count, 0);
  assert.match(pack.auction.note, /No current auction lot/);
  const unloaded = Channels.build({region: 'GM', lots: [{region: 'GM'}], auctionsLoaded: false});
  assert.equal(unloaded.auction.count, null);
  assert.equal(unloaded.onMarket.count, null);
  assert.equal(Group.scanCopy([pack.offMarket.note, pack.onMarket.note, pack.auction.note]).length, 0);
});
if (failed) process.exit(1);
