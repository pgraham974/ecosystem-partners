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
    const name = {GM: 'Greater Manchester', BRS: 'Bristol', GLOS: 'Gloucestershire'}[region.id];
    return row.region === name;
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
  function watch(schemes, today) {
    const horizon = addMonths(today, 18);
    const notices = [];
    const ends = [];
    for (const row of schemes || []) {
      const text = String(row.status || '') + ' ' + String(row.name || '');
      const forthcoming = /forthcoming|market engagement|pre-procurement|re-procur/i.test(text);
      const startInWindow = row.start && row.start.firm && row.start.iso >= today && row.start.iso <= horizon;
      const startLater = row.start && row.start.firm && row.start.iso > horizon;
      if (startInWindow) {
        notices.push({id: row.id, name: row.name, date: row.start.iso, kind: 'Due to start'});
      } else if (forthcoming && !startLater) {
        notices.push({id: row.id, name: row.name, date: row.start && row.start.firm ? row.start.iso : '', kind: 'Notice on file'});
      }
      if (row.end && row.end.firm && row.end.iso >= today && row.end.iso <= horizon) {
        ends.push({id: row.id, name: row.name, date: row.end.iso, kind: 'End date used as a re-procurement signal'});
      }
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
    RULE, DEAL, AUCTIONS, addMonths, publicLength, frameworkUnverified, opportunityUnverified, opportunityInRegion, flag, watch, indicativeHomes, feedStatus, build
  });
})(typeof window !== 'undefined' ? window : globalThis);
