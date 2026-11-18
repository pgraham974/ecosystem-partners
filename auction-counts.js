/* Count current auction lots. Allsop is left out. No network and no DOM. */
(function (root) {
  'use strict';
  const REGIONS = Object.freeze([
    ['GM', 'Manchester'],
    ['LIV', 'Liverpool'],
    ['CHS', 'Cheshire'],
    ['BIR', 'Birmingham'],
    ['BRS', 'Bristol'],
    ['GLA', 'Glasgow'],
    ['EDI', 'Edinburgh'],
    ['GLOS', 'Cheltenham']
  ]);
  const LIVE = 'https://pgrahamlc.github.io/ecosystem-deals/data/auctions/lots.json';
  const PAGE = 'https://pgrahamlc.github.io/ecosystem-deals/#auctions';
  function lotText(lot) {
    return [lot.title, lot.address, lot.property_type, lot.residential_subtype, lot.lot_type].join(' ');
  }
  function beds(lot) {
    const found = [...lotText(lot).matchAll(/(\d+)\s*[- ]?\s*bed/gi)].map((match) => Number(match[1]));
    if (!found.length) return 'unknown';
    return found.some((count) => count === 3 || count === 4) ? 'matched' : 'other';
  }
  function bedClass(lot) {
    const text = lotText(lot);
    const found = [...text.matchAll(/(\d+)\s*[- ]?\s*bed/gi)].map((match) => Number(match[1]));
    if (!found.length) return /\bhmo\b|shared room|house share|room only/i.test(text) ? 'shared' : 'unknown';
    const unique = [...new Set(found)];
    if (unique.length !== 1) return 'other';
    if (unique[0] >= 1 && unique[0] <= 4) return String(unique[0]);
    return 'other';
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
  function currentLots(lots, today) {
    const day = String(today || '').slice(0, 10);
    const cityToRegion = Object.fromEntries(REGIONS.map(([id, city]) => [city, id]));
    const out = [];
    for (const lot of lots || []) {
      if (!lot || lot.stale) continue;
      if (String(lot.status || '').toLowerCase() !== 'upcoming') continue;
      if (isAllsop(lot)) continue;
      const date = lot.auction_date || '';
      if (date && date < day) continue;
      const region = cityToRegion[lot.city];
      if (!region) continue;
      const price = Number(lot.guide_price);
      const title = String(lot.title || lot.address || 'Lot').replace(/\s+/g, ' ').trim();
      out.push({
        id: String(lot.id || lot.source_url || out.length),
        region,
        city: lot.city,
        beds: bedClass(lot),
        price: Number.isFinite(price) && price > 0 ? price : null,
        url: lot.source_url || '',
        title: title.length > 90 ? title.slice(0, 88) + '...' : title
      });
    }
    return out;
  }
  function yieldOnCost(gates) {
    const anchors = gates && gates.anchors;
    const spreads = gates && (gates.spreads || gates.spreadsBp);
    if (!anchors || !spreads) return null;
    const exit = Number(anchors.exitYield) + Number(spreads.yocOverExit) / 10000;
    const debt = Number(anchors.debtCost) + Number(spreads.yocOverDebt) / 10000;
    if (!Number.isFinite(exit) || !Number.isFinite(debt)) return null;
    return Math.max(exit, debt);
  }
  function assess(lots, rates, hurdle) {
    const byBed = {'1': 0, '2': 0, '3': 0, '4': 0, shared: 0, unknown: 0, other: 0};
    for (const lot of lots || []) byBed[lot.beds] = (byBed[lot.beds] || 0) + 1;
    const rent = {};
    for (const row of rates || []) rent[row.key] = row;
    function view(field) {
      const rows = (lots || []).map((lot) => {
        const monthly = rent[lot.beds] ? rent[lot.beds][field] : null;
        if (lot.price == null || monthly == null || !(hurdle > 0)) {
          return Object.assign({}, lot, {result: 'not testable', threshold: null, headroom: null, headroomPct: null});
        }
        const threshold = Math.round((monthly * 12) / hurdle);
        const headroom = threshold - lot.price;
        return Object.assign({}, lot, {
          threshold,
          headroom,
          headroomPct: threshold ? Math.round((headroom / threshold) * 1000) / 10 : null,
          result: lot.price <= threshold ? 'below' : 'above'
        });
      });
      const tested = rows.filter((row) => row.result !== 'not testable');
      const below = tested.filter((row) => row.result === 'below').length;
      return {
        rows,
        tested: tested.length,
        below,
        above: tested.length - below,
        untested: rows.length - tested.length,
        viable: tested.length ? Math.round((below / tested.length) * 1000) / 10 : null
      };
    }
    return {byBed, lha: view('reference'), om: view('omr')};
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
      regions: count(file && file.lots, today),
      lots: currentLots(file && file.lots, today)
    };
  }
  root.AuctionCounts = Object.freeze({REGIONS, LIVE, PAGE, beds, bedClass, isAllsop, count, currentLots, yieldOnCost, assess, pack});
})(typeof window !== 'undefined' ? window : globalThis);
