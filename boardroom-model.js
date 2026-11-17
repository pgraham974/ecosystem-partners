/* Figures for the one-screen boardroom. Blank stays blank. */
(function (root) {
  'use strict';
  const REGIONS = Object.freeze([
    {id: 'GM', label: 'Greater Manchester', city: 'Manchester', bip: ['UKD3', 'UKD33'], opp: 'GM', reference: 'Central Greater Manchester'},
    {id: 'BRS', label: 'Bristol / West', city: 'City Of Bristol', bip: ['UKK11'], opp: 'BR', reference: 'Bristol'},
    {id: 'GLOS', label: 'Gloucestershire', city: 'Cheltenham', bip: ['UKK13'], opp: 'GL', reference: 'Cheltenham'},
    {id: 'National', label: 'National', city: '', bip: ['National', 'England and Wales'], opp: 'MJ', reference: ''}
  ]);
  const LHA_NAMES = Object.freeze({
    GM: ['Central Greater Manchester', 'Southern Greater Manchester', 'Bolton and Bury', 'Oldham and Rochdale', 'Wigan'],
    BRS: ['Bristol'],
    GLOS: ['Cheltenham', 'Gloucester']
  });
  const BEDS = Object.freeze([
    ['shared', 'SAR', 'HMO / shared', ''],
    ['1', '1', '1 bed', '1 bed'],
    ['2', '2', '2 bed', '2 bed'],
    ['3', '3', '3 bed', '3 bed'],
    ['4', '4', '4 bed', '4 or more']
  ]);
  const ONS_AREA = Object.freeze({GM: 'Manchester', BRS: 'Bristol, City of', GLOS: 'Cheltenham'});
  const BIP_FIELDS = Object.freeze(['id', 'type', 'title', 'buyer', 'suppliers', 'lotSuppliers', 'value', 'basis', 'start', 'end', 'region', 'status', 'opps', 'url', 'checked', 'published', 'framework']);

  function regionById(id) {
    return REGIONS.find((row) => row.id === id) || REGIONS[0];
  }
  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }
  function readDate(value) {
    const raw = value == null ? '' : String(value).trim();
    if (!raw || /ongoing|rolling/i.test(raw)) return {raw, firm: false, iso: ''};
    const matches = [...raw.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)].map((match) => match[1]);
    if (matches.length !== 1) return {raw, firm: false, iso: '', ambiguous: matches.length > 1};
    if (/earliest|estimated|approx|about|~|max|confirm|expected/i.test(raw)) return {raw, firm: false, iso: '', qualified: true};
    return {raw, firm: true, iso: matches[0]};
  }
  function num(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
  function money(value) {
    if (num(value) == null) return '';
    return new Intl.NumberFormat('en-GB', {style: 'currency', currency: 'GBP', minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2}).format(value);
  }
  function ukDate(iso) {
    if (!iso) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const parts = iso.split('-');
    return Number(parts[2]) + ' ' + months[Number(parts[1]) - 1] + ' ' + parts[0];
  }
  function addDays(iso, days) {
    const [year, month, day] = iso.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }
  function parseSuppliers(value) {
    const text = clean(value);
    if (!text) return {names: [], stated: null};
    const statedMatch = text.match(/^(\d+)\b/);
    const stated = statedMatch && /supplier|appointee|incl/i.test(text) ? Number(statedMatch[1]) : null;
    if (/^\d+\s+suppliers?$/i.test(text)) return {names: [], stated};
    const names = text.replace(/\band others\b/ig, '').replace(/^\d+\s+incl\.?\s*/i, '').split(/,| and |;|\//).map(clean).filter((name) => name && name.length > 2 && !/suppliers?$/i.test(name));
    return {names, stated};
  }
  function operatorsFrom(records, kind) {
    const names = new Set();
    let stated = null;
    for (const record of records || []) {
      const parsed = parseSuppliers(record && record.suppliers);
      parsed.names.forEach((name) => names.add(name));
      if (parsed.stated != null) stated = Math.max(stated || 0, parsed.stated);
      const lots = record && record.lotSuppliers;
      if (lots && typeof lots === 'object') {
        for (const list of Object.values(lots)) for (const name of list || []) if (clean(name)) names.add(clean(name));
      }
    }
    const kindCount = String(kind || '').match(/(\d+)\s+appointees/i);
    if (kindCount) stated = Math.max(stated || 0, Number(kindCount[1]));
    const count = stated != null && stated > names.size ? stated : (names.size || stated || 0);
    return {count, names: [...names].sort((a, b) => a.localeCompare(b, 'en')), stated: stated != null && stated > names.size ? stated : null};
  }
  function covers(region, itemRegions, oppIds) {
    const list = itemRegions || [];
    if (list.includes(region.id)) return true;
    return (oppIds || []).some((id) => String(id).startsWith(region.opp + '-'));
  }
  function classify(text) {
    const source = String(text || '').toLowerCase();
    if (/asylum/.test(source)) return 'Asylum';
    if (/cas|probation|prison|justice/.test(source)) return 'Justice';
    if (/young|care leaver/.test(source)) return 'Young people';
    if (/domestic/.test(source)) return 'Domestic abuse';
    if (/supported/.test(source)) return 'Supported';
    if (/temporary|nightly|leas|ta\b/.test(source)) return 'Temporary accommodation';
    return 'Other';
  }
  function light(tone, label, detail) {
    return {tone, label, detail};
  }

  function build(input) {
    const today = readDate(input && input.today).firm ? input.today : '2026-11-17';
    const region = regionById(input && input.region);
    const frameworks = ((input.frameworks && input.frameworks.items) || []);
    const links = (input.v4 && input.v4.fwLinks) || [];
    const bip = (input.v4 && input.v4.bip) || {};
    const horizon = addDays(today, 365);
    const schemes = [];
    frameworks.forEach((item, index) => {
      const link = links.find((row) => { try { return new RegExp(row.match).test(item.name || ''); } catch (error) { return false; } });
      const records = ((link && link.bip) || []).map((id) => bip[id]).filter(Boolean);
      if (!covers(region, item.regions, records.flatMap((record) => record.opps || []))) return;
      const bipStart = records.map((record) => readDate(record.start)).find((date) => date.firm);
      const bipEnd = records.map((record) => readDate(record.end)).find((date) => date.firm);
      const ownStart = readDate(item.start);
      const ownEnd = readDate(item.end);
      schemes.push({
        id: 'fw-' + index,
        name: item.name,
        short: item.name.length > 42 ? item.name.slice(0, 40) + '...' : item.name,
        buyer: item.buyer || (records[0] && records[0].buyer) || '',
        type: classify((item.accom_type || '') + ' ' + item.name),
        status: item.status_n || 'Unknown',
        term: (item.lease_terms && item.lease_terms.term) || '',
        rent: (item.lease_terms && item.lease_terms.rent_basis) || '',
        start: bipStart || {raw: ownStart.raw, firm: false, iso: ''},
        end: bipEnd || {raw: ownEnd.raw, firm: false, iso: ''},
        startId: bipStart ? records.find((record) => readDate(record.start).firm).id : '',
        operators: operatorsFrom(records, link && link.kind),
        bip: records.map((record) => record.id)
      });
    });
    const file = input.lha || {rates: []};
    const names = LHA_NAMES[region.id] || [];
    const rows = names.map((name) => (file.rates || []).find((row) => row.name === name && row.country === 'England')).filter(Boolean);
    const reference = rows.find((row) => row.name === region.reference) || rows[0] || null;
    const onsFile = (input.ons && input.ons.areas) || {};
    const onsName = ONS_AREA[region.id] || '';
    const ons = onsName ? onsFile[onsName] : null;
    const onsKey = {shared: '', '1': 'b1', '2': 'b2', '3': 'b3', '4': 'b4'};
    const beds = BEDS.map(([key, field, label, onsLabel]) => {
      const values = rows.map((row) => num(row[field])).filter((value) => value != null);
      const market = ons && onsKey[key] ? num(ons[onsKey[key]]) : null;
      const lha = reference ? num(reference[field]) : null;
      const gap = lha != null && market != null && market !== 0 ? Math.round((lha - market) * 100) / 100 : null;
      const gapPercent = gap != null ? Math.round((gap / market) * 1000) / 10 : null;
      return {
        key, label, onsLabel,
        reference: lha,
        min: values.length ? Math.min(...values) : null,
        max: values.length ? Math.max(...values) : null,
        omr: market,
        gap, gapPercent
      };
    });
    const position = (input.position && input.position[region.id]) || {};
    const rates = beds;
    const omrKnown = rates.some((bed) => bed.omr != null);
    const onsMeta = {
      area: onsName,
      month: ons ? ons.month : '',
      source: (input.ons && input.ons.source) || '',
      url: (input.ons && input.ons.url) || '',
      note: '4 or more is the ONS category. It is not a pure 4 bed rent. This series has no shared room average.'
    };
    const typeMap = {};
    for (const row of schemes) typeMap[row.type] = (typeMap[row.type] || 0) + 1;
    const ranked = schemes.filter((row) => row.operators.count > 0).sort((a, b) => b.operators.count - a.operators.count || a.name.localeCompare(b.name));
    const operatorPlaces = ranked.reduce((sum, row) => sum + row.operators.count, 0);
    const uniqueOperators = new Set();
    for (const row of schemes) for (const name of row.operators.names) uniqueOperators.add(name);
    const soon = schemes.filter((row) => (row.end.firm && row.end.iso >= today && row.end.iso <= horizon) || (row.start.firm && row.start.iso >= today && row.start.iso <= horizon)).length;
    const past = schemes.filter((row) => row.end.firm && row.end.iso < today).length;
    const deals = num(position.dealsExecuted);
    const held = num(position.propertiesHeld);
    const auction = (input.auctions && input.auctions.regions && input.auctions.regions[region.id]) || null;
    const lights = [
      omrKnown ? light(rates.some((bed) => bed.gap != null && bed.gap < 0) ? 'mid' : 'good', 'Rent gap', 'LHA minus the ONS rent for the named area.') : light('none', 'Rent gap', 'Not yet recorded'),
      !auction ? light('none', 'Supply of targets', 'Not yet recorded') : light(auction.matched > 0 ? 'good' : 'mid', 'Supply of targets', auction.matched + ' lots state 3 or 4 bed. ' + auction.unknown + ' have no bed count.'),
      light(operatorPlaces > 0 ? 'good' : 'bad', 'Operator coverage', operatorPlaces ? operatorPlaces + ' places on these frameworks. ' + uniqueOperators.size + ' firms are named. A firm on two frameworks is counted twice. Market Screen counts provider accounts, which is a separate list.' : 'None recorded'),
      past ? light('bad', 'Framework expiry', past + (past === 1 ? ' firm end date is already past' : ' firm end dates are already past')) : soon ? light('mid', 'Framework expiry', soon + (soon === 1 ? ' firm date falls inside 12 months' : ' firm dates fall inside 12 months')) : light(schemes.some((row) => row.end.firm) ? 'good' : 'mid', 'Framework expiry', schemes.some((row) => row.end.firm) ? 'No firm end inside 12 months' : 'Firm end dates are unknown'),
      deals == null && held == null ? light('none', 'Deals and holdings', 'Not yet recorded') : light('good', 'Deals and holdings', 'A figure has been entered on the position sheet')
    ];
    const comparable = rates.filter((row) => row.gap != null);
    const allBelow = comparable.length > 0 && comparable.every((row) => row.gap < 0);
    const positionLine = deals == null && held == null
      ? 'Deals executed and properties held are not yet recorded.'
      : 'Deals executed: ' + (deals == null ? 'not yet recorded' : deals) + '. Properties held: ' + (held == null ? 'not yet recorded' : held) + '.';
    const verdict = !omrKnown
      ? 'Open market rent is not in the ONS file for this area. ' + positionLine
      : (allBelow ? 'LHA is below the September 2026 ONS rent on every comparable bed size.' : 'The LHA gap is not the same sign on every bed size.') + ' ' + positionLine;
    return {
      today,
      region: {id: region.id, label: region.label, reference: reference ? reference.name : ''},
      regions: REGIONS.map((row) => ({id: row.id, label: row.label, city: row.city})),
      bipFields: BIP_FIELDS,
      contracts: {
        schemes: schemes.length,
        withBip: schemes.filter((row) => row.bip.length).length,
        areas: 1,
        types: Object.entries(typeMap).sort((a, b) => b[1] - a[1])
      },
      schemes,
      timeline: schemes.filter((row) => row.start.firm || row.end.firm).sort((a, b) => String(a.start.iso || '9999').localeCompare(String(b.start.iso || '9999'))),
      ranked,
      rates,
      omrKnown,
      ons: onsMeta,
      lhaProvenance: 'DWP Universal Credit LHA 2026/27, via market-lha.json. The reference row is ' + (reference ? reference.name : 'not in the file') + '.',
      auctions: auction,
      auctionsLive: (input.auctions && input.auctions.live) || 'https://pgrahamlc.github.io/ecosystem-deals/#auctions',
      portfolio: {deals, held, operators: operatorPlaces, uniqueOperators: uniqueOperators.size, targets: auction},
      soon,
      lights,
      verdict
    };
  }
  root.BoardroomModel = Object.freeze({REGIONS, LHA_NAMES, BEDS, BIP_FIELDS, build, readDate, money, ukDate, regionById});
})(typeof window !== 'undefined' ? window : globalThis);
