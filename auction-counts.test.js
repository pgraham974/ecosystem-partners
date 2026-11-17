'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const sandbox = {window: {}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'auction-counts.js'), 'utf8'), sandbox, {filename: 'auction-counts.js'});
const Counts = sandbox.window.AuctionCounts;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('PASS ' + name); }
  catch (error) { failed += 1; console.error('FAIL ' + name + '\n' + error.stack); }
}
const today = '2026-11-17';
function lot(extra) {
  return Object.assign({status: 'upcoming', stale: false, city: 'Manchester', auction_date: '2026-12-01', source: 'Auction House Manchester', title: 'House', property_type: '', residential_subtype: '', lot_type: ''}, extra);
}
test('a past, stale, sold or Allsop lot is not current', () => {
  const regions = Counts.count([
    lot({auction_date: '2026-11-16', title: '3 bed house'}),
    lot({stale: true, title: '3 bed house'}),
    lot({status: 'sold', title: '4 bed house'}),
    lot({source: 'Allsop', title: '3 bed house'}),
    lot({sources: [{name: 'Allsop Residential'}], title: '4 bedroom flat'})
  ], today);
  assert.equal(regions.GM.current, 0);
  assert.equal(regions.GM.matched, 0);
});
test('3 and 4 bed lots match and a missing bed count stays unknown', () => {
  const regions = Counts.count([
    lot({title: '3 bed terrace'}),
    lot({title: '4 bedroom house', city: 'Manchester'}),
    lot({title: 'Land with no size'}),
    lot({title: '2 bed flat'}),
    lot({title: '3 bed flat', city: 'Bristol'}),
    lot({title: 'Shop', city: 'Cheltenham', auction_date: ''})
  ], today);
  assert.equal(regions.GM.matched, 2);
  assert.equal(regions.GM.unknown, 1);
  assert.equal(regions.GM.other, 1);
  assert.equal(regions.GM.current, 4);
  assert.equal(regions.BRS.matched, 1);
  assert.equal(regions.GLOS.unknown, 1);
});
test('an undated upcoming lot is current', () => {
  const regions = Counts.count([lot({auction_date: '', title: '3 bed'})], today);
  assert.equal(regions.GM.matched, 1);
});
if (failed) process.exit(1);
