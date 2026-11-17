/* Count current auction lots. Allsop is left out. No network and no DOM. */
(function (root) {
  'use strict';
  const REGIONS = Object.freeze([
    ['GM', 'Manchester'],
    ['BRS', 'Bristol'],
    ['GLOS', 'Cheltenham']
  ]);
  const LIVE = 'https://pgrahamlc.github.io/ecosystem-deals/data/auctions/lots.json';
  const PAGE = 'https://pgrahamlc.github.io/ecosystem-deals/#auctions';
  function beds(lot) {
    const text = [lot.title, lot.address, lot.property_type, lot.residential_subtype, lot.lot_type].join(' ');
    const found = [...text.matchAll(/(\d+)\s*[- ]?\s*bed/gi)].map((match) => Number(match[1]));
    if (!found.length) return 'unknown';
    return found.some((count) => count === 3 || count === 4) ? 'matched' : 'other';
  }
  function isAllsop(lot) {
    const names = [lot.source].concat((lot.sources || []).map((row) => row && row.name));
    return names.some((name) => /allsop/i.test(String(name || '')));
  }
  function count(lots, today) {
    const day = String(today || '').slice(0, 10);
    const regions = {};
    for (const [id, city] of REGIONS) regions[id] = {city, current: 0, matched: 0, unknown: 0, other: 0};
    const byCity = Object.fromEntries(REGIONS.map(([id, city]) => [city, regions[id]]));
    for (const lot of lots || []) {
      if (!lot || lot.stale) continue;
      if (String(lot.status || '').toLowerCase() !== 'upcoming') continue;
      if (isAllsop(lot)) continue;
      const date = lot.auction_date || '';
      if (date && date < day) continue;
      const row = byCity[lot.city];
      if (!row) continue;
      row.current += 1;
      row[beds(lot)] += 1;
    }
    return regions;
  }
  function pack(file, today, from) {
    return {
      source: LIVE,
      live: PAGE,
      updated_at: (file && file.updated_at) || '',
      asOf: String(today || '').slice(0, 10),
      refreshedFrom: from || 'snapshot',
      rule: 'Upcoming lots that are not stale, with an auction date of today or later, or with no date. A lot matches when the title or type states 3 or 4 bedrooms. Lots with no bedroom number are counted as unknown. Allsop lots are excluded.',
      label: 'current auction lots matching criteria (Ecosystem Deals)',
      criteria: '3 to 4 bed',
      regions: count(file && file.lots, today)
    };
  }
  root.AuctionCounts = Object.freeze({REGIONS, LIVE, PAGE, beds, isAllsop, count, pack});
})(typeof window !== 'undefined' ? window : globalThis);
