/* Public triage for one region. No rents, counterparty names or contact details. */
(function (root) {
  'use strict';
  const RULE = 'Do not pursue when the area has no framework schemes and no current 3 or 4 bed lots. Needs information when the open market rent, the lot count, a contract length or a property count is missing. Otherwise proceed to underwriting.';
  const DEAL = 'https://pgrahamlc.github.io/ecosystem-deals/#deal';
  const AUCTIONS = 'https://pgrahamlc.github.io/ecosystem-deals/#auctions';
  function addMonths(iso, months) {
    const [year, month, day] = String(iso).split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1 + months, day));
    return date.toISOString().slice(0, 10);
  }
  function blankTerm(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return true;
    if (/not published|not stated|not captured|not yet|to confirm|unknown/i.test(text)) return true;
    if (/£|\bgbp\b|rent per|per week|per month|pcm/i.test(text)) return true;
    return false;
  }
  function publicLength(value) {
    return blankTerm(value) ? '' : String(value).replace(/\s+/g, ' ').trim();
  }
  function frameworkUnverified(item) {
    const confidence = String(item && item.confidence || '');
    const blob = [item && item.status, item && item.status_n, item && item.notes, ...((item && item.suppliers) || [])].join(' ');
    if (confidence !== 'H') return true;
    return /unverified|not verified|placeholder|to verify|forthcoming|not found/i.test(blob);
  }
  function opportunityUnverified(row) {
    const status = String(row && row.status || '');
    if (/placeholder|unverified|to verify|research needed|excluded|qualify/i.test(status)) return true;
    return Object.values((row && row.gates) || {}).some((value) => /unknown|fail/i.test(String(value)));
  }
  function opportunityInRegion(row, region) {
    if (!row) return false;
    if (!region || region.id === 'National') return true;
    if (String(row.id || '').indexOf(region.opp + '-') === 0) return true;
    const names = {
      GM: ['Greater Manchester'],
      LIV: ['Liverpool'],
      CHS: ['Cheshire'],
      BIR: ['Birmingham'],
      BRS: ['Bristol', 'Bristol / West'],
      GLA: ['Glasgow'],
      EDI: ['Edinburgh'],
      GLOS: ['Cheltenham', 'Gloucestershire']
    }[region.id] || [region.label];
    return names.indexOf(row.region) !== -1;
  }
  function flag(unverified) {
    return unverified ? 'Unverified' : 'Confirmed';
  }
  function terms(schemes) {
    return (schemes || []).map((row) => {
      const length = publicLength(row.term);
      const homes = typeof row.homes === 'number' && row.homes > 0 ? row.homes : null;
      return {id: row.id, name: row.name, length: length || '', homes, unverified: !!row.unverified};
    });
  }
  function noticeType(row, kind) {
    if (String(kind).indexOf('End date') === 0) return 'End-date signal';
    const text = [row && row.status, row && row.noticeText, row && row.name].join(' ');
    if (kind === 'Due to start') return 'Start';
    if (/early engagement|market engagement|preliminary market/i.test(text)) return 'Early engagement';
    if (/tender/i.test(text)) return 'Tender';
    if (/pre-procurement|forthcoming|pipeline|prior information/i.test(text)) return 'Pre-procurement';
    if (kind === 'Notice on file') return 'Pre-procurement';
    return 'Not yet recorded';
  }
  function whyItMatters(kind, notice) {
    if (String(kind).indexOf('End date') === 0) return 'No early notice is on file. The firm end date is inside 18 months, so it is shown as a re-procurement signal. Mack Living would need a new notice before treating this as a live route. Laurito would not underwrite demand from an end date alone.';
    if (notice === 'Start') return 'The recorded start is inside 18 months. Mack Living can use that window to seek a place. Laurito can use the same demand when underwriting homes. This is not a bid and it does not award any volume.';
    if (notice === 'Tender') return 'A tender notice is on file. Mack Living can use it to prepare a place on the framework. Laurito can use it as demand evidence. This is not a bid.';
    if (notice === 'Early engagement') return 'Early engagement is on file. No award and no volume are recorded. It is a signal for Mack Living to follow the notice, not a contract.';
    if (notice === 'Pre-procurement') return 'A pre-procurement notice is on file. No award and no volume are recorded. It tells Mack Living a competition may follow. It is not a contract.';
    return 'Not yet recorded.';
  }
  function packWatch(row, date, kind) {
    const notice = noticeType(row, kind);
    return {
      id: row.id,
      name: row.name,
      date: date || '',
      kind,
      noticeType: notice,
      authority: row.buyer || '',
      region: row.regionLabel || '',
      start: row.start && row.start.firm ? row.start.iso : '',
      end: row.end && row.end.firm ? row.end.iso : '',
      value: typeof row.valueAmount === 'number' ? row.valueAmount : null,
      valueBasis: row.valueBasis || '',
      operators: (row.operators && row.operators.names) || [],
      operatorCount: row.operators ? row.operators.count : 0,
      verified: row.unverified === true ? 'Unverified' : (row.unverified === false ? 'Confirmed' : 'Not yet recorded'),
      why: whyItMatters(kind, notice),
      sources: row.sources || [],
      bip: row.bip || []
    };
  }
  function watch(schemes, today) {
    const horizon = addMonths(today, 18);
    const notices = [];
    const ends = [];
    for (const row of schemes || []) {
      const text = String(row.status || '') + ' ' + String(row.noticeText || '') + ' ' + String(row.name || '');
      const forthcoming = /forthcoming|market engagement|pre-procurement|re-procur/i.test(text);
      const startInWindow = row.start && row.start.firm && row.start.iso >= today && row.start.iso <= horizon;
      const startLater = row.start && row.start.firm && row.start.iso > horizon;
      if (startInWindow) notices.push(packWatch(row, row.start.iso, 'Due to start'));
      else if (forthcoming && !startLater) notices.push(packWatch(row, row.start && row.start.firm ? row.start.iso : '', 'Notice on file'));
      if (row.end && row.end.firm && row.end.iso >= today && row.end.iso <= horizon) ends.push(packWatch(row, row.end.iso, 'End date used as a re-procurement signal'));
    }
    notices.sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999')));
    ends.sort((a, b) => a.date.localeCompare(b.date));
    if (notices.length) return {items: notices, fallback: false};
    if (ends.length) return {items: ends, fallback: true};
    return {items: [], fallback: false};
  }
  function indicativeHomes(median) {
    if (typeof median !== 'number' || !Number.isFinite(median) || median <= 0) return null;
    const pot = 5000000 / 0.4;
    return {equity: 5000000, ltv: 60, pot, median, homes: Math.floor(pot / median)};
  }
  function feedStatus(feed) {
    const items = (feed && feed.items) || [];
    const supplied = items.filter((item) => item && item.supplied === true);
    return {
      updated: feed && feed.updated ? feed.updated : '',
      weeklyTarget: (feed && feed.weeklyTarget) || '',
      required: items.length,
      supplied: supplied.length,
      awaiting: supplied.length === 0,
      items: items.map((item) => ({id: item.id, label: item.label, supplied: item.supplied === true}))
    };
  }
  function build(input) {
    const today = input.today;
    const region = input.region;
    const schemes = input.schemes || [];
    const auctions = input.auctions || null;
    const gapKnown = (input.rates || []).some((row) => row.gap != null);
    const rows = terms(schemes);
    const extra = input.propertyRecords || [];
    const lengths = rows.filter((row) => row.length).concat(extra.filter((row) => publicLength(row.length)));
    const homes = rows.filter((row) => row.homes != null).concat(extra.filter((row) => row.homes != null));
    const frameworks = (input.frameworks || []).map((item) => ({name: item.name, unverified: frameworkUnverified(item)}));
    const opportunities = (input.opportunities || []).filter((row) => opportunityInRegion(row, region)).map((row) => ({id: row.id, unverified: opportunityUnverified(row)}));
    const cas = input.manchesterCas;
    const casUnverified = !!(cas && /to verify|unverified|placeholder/i.test(String(cas.status || '')));
    const unverified = frameworks.filter((row) => row.unverified).length + opportunities.filter((row) => row.unverified).length + (casUnverified ? 1 : 0);
    const missing = [];
    if (!gapKnown) missing.push('Open market rent is not recorded for this area');
    if (!auctions) missing.push('Current auction lot count is not loaded');
    if (!lengths.length) missing.push('No contract length is on file');
    if (!homes.length) missing.push('No property count is on file');
    let verdict = 'Proceed to underwriting';
    if (!schemes.length && auctions && auctions.matched === 0) verdict = 'Do not pursue';
    else if (missing.length) verdict = 'Needs information';
    const example = indicativeHomes(input.median);
    return {
      today,
      region,
      rule: RULE,
      steps: {
        position: {schemes: schemes.length, withBip: schemes.filter((row) => (row.bip || []).length).length, operators: input.operators || 0, past: schemes.filter((row) => row.end && row.end.firm && row.end.iso < today).length},
        market: {gapKnown, matched: auctions ? auctions.matched : null, unknown: auctions ? auctions.unknown : null},
        terms: {onFile: lengths.length, notSupplied: Math.max(0, rows.length - rows.filter((row) => row.length).length), homes: homes.reduce((sum, row) => sum + row.homes, 0), rows},
        investment: {deal: DEAL, auctions: AUCTIONS, matched: auctions ? auctions.matched : null, buyBox: ''}
      },
      verdict,
      missing: verdict === 'Needs information' ? missing : [],
      unverified,
      confirmed: frameworks.filter((row) => !row.unverified).length + opportunities.filter((row) => !row.unverified).length,
      flags: {frameworks, opportunities, manchesterCas: casUnverified ? 'Unverified' : (cas ? 'Confirmed' : '')},
      watch: watch(schemes, today),
      feed: feedStatus(input.feed),
      example
    };
  }
  root.TriageModel = Object.freeze({
    RULE, DEAL, AUCTIONS, addMonths, publicLength, frameworkUnverified, opportunityUnverified, opportunityInRegion, flag, noticeType, watch, indicativeHomes, feedStatus, build
  });
})(typeof window !== 'undefined' ? window : globalThis);
