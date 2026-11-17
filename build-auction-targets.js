/* Refresh auction-targets.json from the live Ecosystem Deals lots file. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sandbox = {window: {}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'auction-counts.js'), 'utf8'), sandbox, {filename: 'auction-counts.js'});
const Counts = sandbox.window.AuctionCounts;

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const response = await fetch(Counts.LIVE, {cache: 'no-store'});
  if (!response.ok) throw new Error('Live lots file failed (' + response.status + ')');
  const file = await response.json();
  const packed = Counts.pack(file, today, 'snapshot');
  const out = path.join(__dirname, 'auction-targets.json');
  fs.writeFileSync(out, JSON.stringify(packed, null, 2) + '\n');
  const gm = packed.regions.GM;
  console.log('Wrote ' + out);
  console.log('File updated ' + packed.updated_at + '. Counted on ' + today + '.');
  console.log('Greater Manchester: ' + gm.matched + ' matching, ' + gm.unknown + ' with no bed count, ' + gm.current + ' current.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
