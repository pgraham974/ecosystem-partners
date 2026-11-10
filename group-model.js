/* Pure helpers for the Mack Living / Laurito screening shell. No DOM or network. */
(function (root) {
  'use strict';
  const KEYS = ['age', 'revenue', 'profit', 'assets', 'liquidity', 'staff', 'governance', 'freshness'];
  function sum(weights) {
    return KEYS.reduce((total, key) => total + Number(weights[key] || 0), 0);
  }
  function checkWeights(weights) {
    if (!weights || typeof weights !== 'object' || Array.isArray(weights)) throw new TypeError('weights must be an object');
    for (const key of KEYS) {
      const value = weights[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new TypeError('Bad weight: ' + key);
    }
    for (const key of Object.keys(weights)) {
      if (!KEYS.includes(key)) throw new TypeError('Unknown weight: ' + key);
    }
    if (Math.abs(sum(weights) - 100) > 1e-6) throw new RangeError('weights must total 100');
    return true;
  }
  function groupTotals(groups, weights) {
    return groups.map((group) => ({
      id: group.id,
      label: group.label,
      points: group.keys.reduce((total, key) => total + Number(weights[key] || 0), 0)
    }));
  }
  function blankCard(card) {
    const fields = ['buyer', 'notice', 'value', 'term', 'geography', 'route', 'rent', 'deadline', 'contacts', 'next'];
    return fields.every((key) => card[key] == null || String(card[key]).trim() === '') && (!card.sources || card.sources.length === 0);
  }
  function scanCopy(value, path) {
    const found = [];
    const walk = (item, here) => {
      if (typeof item === 'string') {
        if (item.includes(';') || item.includes('\u2014') || item.includes('\u2013')) found.push(here || '(root)');
        return;
      }
      if (Array.isArray(item)) item.forEach((child, index) => walk(child, here + '[' + index + ']'));
      else if (item && typeof item === 'object') {
        for (const key of Object.keys(item)) walk(item[key], here ? here + '.' + key : key);
      }
    };
    walk(value, path || '');
    return found;
  }
  function datasetMismatches(catalogue, actual) {
    const mismatches = [];
    for (const row of catalogue) {
      if (actual[row.file] !== row.updated) mismatches.push(row.file + ' catalogue ' + row.updated + ' file ' + (actual[row.file] || 'missing'));
    }
    return mismatches;
  }
  const COPY = Object.freeze({
    disclaimer: 'Screening research, not an investment recommendation. Provider financials, governance and published terms are source-dated evidence. Confirm the rent-paying legal entity, current accounts and written terms before relying on a provider. Proposed score weights are not agreed.',
    marketLead: 'Partner and market screening for Mack Living and Laurito Capital. Choose a weight set, read the points, then open a provider. A blank test is unknown, not a pass.',
    marketSteps: 'Workflow: 1 choose current or proposed weights. 2 sort and filter the matrix. 3 open a row for the eight tests and any hold. 4 use the shortlist in the Monday meeting.',
    shortlist: 'Market Screen shortlist: providers that meet all eight tests on the weight set in use. Unknown tests keep a provider off this list. This is not a second directory.',
    shortlistEmpty: 'No provider meets all eight tests on the weights in use. A missing turnover or profit figure is enough to keep a record off this list.',
    weightSession: 'Number changes apply in this browser only. Agreed weights are changed in scoring-weights.json. The proposed set is not agreed. Luke and Liza still have to confirm it.',
    analysisLead: 'Regional and opportunity analysis for Mack Living and Laurito Capital. Partner scoring stays on the Market Screen.',
    framework: 'Three views share one site. Mack Living is the Monday list. Market Screen is the partner and market screen. Analysis Dashboard is the regional evidence, the contract list and the workbook opportunities. Detail sits behind each expander.',
    manchester: 'This card is blank on purpose. It is not filled from the workbook or from the recorded routes. Status: to verify with Chris and bid contacts.',
    vipTitle: 'VIP Tracker',
    datasetsTitle: 'Dataset last updated',
    benchmarksTitle: 'Commercial benchmarks',
    lhaTitle: 'Local Housing Allowance 2026/27',
    contractsTitle: 'Contract opportunities',
    routesTitle: 'Routes already recorded',
    blank: 'Blank',
    notesLocal: 'Notes on this browser only. They are not written to mack-monday.json.',
    propertySite: 'The separate property comparison site remains at the existing address. It is not this Analysis Dashboard.',
    benchmarksIntro: 'Guaranteed rent and management fee amounts are shown only where a public source is already cited. Otherwise the slot says to be supplied. Marketing lines in the operator file are not treated as a fee.',
    routesIntro: 'These routes are already in mack-living.json. They are outreach notes, not awards. The Manchester CAS card under them is separate and blank.',
    weightsInUse: 'Weights in use'
  });
  root.GroupModel = Object.freeze({KEYS, sum, checkWeights, groupTotals, blankCard, scanCopy, datasetMismatches, COPY});
})(typeof window !== 'undefined' ? window : globalThis);
