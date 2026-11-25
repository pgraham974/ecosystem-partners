/* Refresh on-market-targets.json from the Ecosystem Deals blocks file. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sandbox = {window: {}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'acquisition-channels.js'), 'utf8'), sandbox, {filename: 'acquisition-channels.js'});
const Channels = sandbox.window.AcquisitionChannels;

async function main() {
  const response = await fetch(Channels.SOURCE, {cache: 'no-store'});
  if (!response.ok) throw new Error('Blocks file failed (' + response.status + ')');
  const file = await response.json();
  const listings = Channels.listingsFrom(file);
  const out = {
    source: Channels.SOURCE,
    page: Channels.PAGE,
    updated: file.updated || '',
    note: 'Private treaty listings only. Auction sale method rows are left out so they are not counted twice. Point in time check, not a live feed.',
    listings
  };
  const target = path.join(__dirname, 'on-market-targets.json');
  fs.writeFileSync(target, JSON.stringify(out, null, 2) + '\n');
  const gm = listings.filter((row) => row.region === 'GM').length;
  console.log('Wrote ' + target);
  console.log('Checked ' + (file.updated || 'unknown') + '. Greater Manchester private treaty listings: ' + gm + '.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
