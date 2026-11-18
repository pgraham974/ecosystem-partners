/* Market share from BiP rows already on file. No invented splits. */
(function (root) {
  'use strict';
  const RANK = {value: 4, units: 3, lots: 2, awards: 1};
  const LABELS = {
    value: 'Awarded value',
    units: 'Units',
    lots: 'Share of lot places',
    awards: 'Share by award count'
  };

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }
  function norm(value) {
    return clean(value).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function tidyName(value) {
    return clean(value).replace(/\s+t\/a\s+.*/i, '').replace(/\s+-\s+aasc$/i, '');
  }
  function parseParent(text, opps) {
    let raw = clean(text);
    const cross = raw.match(/^As\s+([A-Z]+-\d+)\b/i);
    if (cross) {
      const other = (opps || []).find((row) => row.id === cross[1]);
      raw = other ? clean(other.parent) : '';
    }
    if (!raw || /no parent|no corporate parent|not identified|none identified|two individual/i.test(raw)) return '';
    const ultimate = raw.match(/ultimate parent\s+([^.;(]+)/i);
    if (ultimate) return ultimate[1].replace(/\s+plc\.?$/i, '').trim();
    const owns = raw.match(/^([^.;(]+?)\s+owns\b/i);
    if (owns) return owns[1].replace(/\s+plc\.?$/i, '').trim();
    if (/group/i.test(raw) && raw.length < 80) return raw.replace(/\s+plc\.?$/i, '').trim();
    return '';
  }
  function bestOpp(supplier, opps) {
    const name = norm(supplier);
    if (name.length < 4) return null;
    let best = null;
    let score = 0;
    for (const opp of opps || []) {
      const fields = [opp.org, opp.entity].map(norm).filter(Boolean);
      let next = 0;
      if (fields.some((field) => field === name)) next = 5;
      else if (fields.some((field) => (field.indexOf(name) === 0 || name.indexOf(field) === 0) && Math.min(field.length, name.length) >= 8)) next = 4;
      if (next > score) { score = next; best = opp; }
    }
    if (best) return best;
    const token = name.split(' ')[0];
    if (token !== name || token.length < 4) return null;
    return (opps || []).find((opp) => norm(opp.org).split(' ')[0] === token || norm(opp.parent).split(' ')[0] === token) || null;
  }
  function groupFor(supplier, opps) {
    const entity = clean(supplier);
    if (/^mack opco\b/i.test(entity)) return {group: 'Mack Living', entity};
    const opp = bestOpp(entity, opps);
    if (!opp) return {group: tidyName(entity), entity};
    const parent = parseParent(opp.parent, opps);
    return {group: parent || opp.org || tidyName(entity), entity};
  }
  function incomplete(text) {
    return /and others|incl\.|name variants|not verified|unverified/i.test(text) || /^\d+\b/.test(clean(text));
  }
  function splitNames(text) {
    return clean(text).split(/\s*;\s*|\s*\|\s*|\s*,\s*/).map(clean).filter((name) => name && !/^and others$/i.test(name));
  }
  function slicesOf(record) {
    const lots = record.lotSuppliers;
    if (lots && typeof lots === 'object' && Object.keys(lots).length) {
      const counts = {};
      for (const names of Object.values(lots)) {
        for (const name of names || []) {
          const key = clean(name);
          if (key) counts[key] = (counts[key] || 0) + 1;
        }
      }
      const rows = Object.keys(counts).map((name) => ({name, amount: counts[name]}));
      if (rows.length) return {metric: 'lots', rows, total: rows.reduce((sum, row) => sum + row.amount, 0)};
    }
    const text = clean(record.suppliers);
    if (!text || incomplete(text)) return null;
    const names = splitNames(text);
    if (!names.length) return null;
    if (names.length === 1 && typeof record.value === 'number' && record.value > 0) {
      return {metric: 'value', rows: [{name: names[0], amount: record.value}], total: record.value};
    }
    return {metric: 'awards', rows: names.map((name) => ({name, amount: 1})), total: names.length};
  }
  function inRegion(record, region) {
    const code = clean(record && record.region);
    if (!region) return false;
    if (region.id === 'National') return code === 'National' || code === 'England and Wales';
    return (region.bip || []).indexOf(code) !== -1;
  }
  function round(value) {
    return Math.round(value * 10) / 10;
  }
  function hhiBand(score) {
    if (score > 2500) return 'Concentrated';
    if (score >= 1500) return 'Moderately concentrated';
    return 'Not concentrated';
  }
  function rollup(rows) {
    const groups = {};
    for (const row of rows) {
      if (!groups[row.group]) groups[row.group] = {name: row.group, amount: 0, entities: {}, contracts: []};
      const group = groups[row.group];
      group.amount += row.amount;
      group.entities[row.entity] = true;
      group.contracts.push(row.contract);
    }
    const list = Object.values(groups).map((group) => ({
      name: group.name,
      amount: group.amount,
      entities: Object.keys(group.entities).sort((a, b) => a.localeCompare(b)),
      contracts: group.contracts
    }));
    const total = list.reduce((sum, group) => sum + group.amount, 0);
    list.forEach((group) => { group.share = total ? round(group.amount / total * 100) : 0; });
    list.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
    list.forEach((group, index) => { group.rank = index + 1; });
    return {groups: list, total};
  }
  function build(input) {
    const region = input.region || {id: '', label: '', bip: []};
    const opps = input.opps || [];
    const records = Object.values(input.bip || {}).filter((record) => inRegion(record, region));
    const contracts = [];
    const skipped = [];
    for (const record of records) {
      const slice = slicesOf(record);
      const base = {
        id: record.id,
        title: record.title || record.id,
        buyer: record.buyer || '',
        url: record.url || '',
        basis: record.basis || '',
        ceiling: typeof record.value === 'number' ? record.value : null
      };
      if (!slice) {
        skipped.push(base);
        continue;
      }
      const grouped = {};
      for (const row of slice.rows) {
        const mapped = groupFor(row.name, opps);
        if (!grouped[mapped.group]) grouped[mapped.group] = {name: mapped.group, amount: 0, entities: {}};
        grouped[mapped.group].amount += row.amount;
        grouped[mapped.group].entities[mapped.entity] = true;
      }
      const groups = Object.values(grouped).map((group) => ({
        name: group.name,
        amount: group.amount,
        share: slice.total ? round(group.amount / slice.total * 100) : 0,
        entities: Object.keys(group.entities).sort((a, b) => a.localeCompare(b))
      })).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
      contracts.push(Object.assign(base, {metric: slice.metric, metricLabel: LABELS[slice.metric], total: slice.total, groups}));
    }
    const best = contracts.reduce((rank, contract) => Math.max(rank, RANK[contract.metric] || 0), 0);
    const headlineMetric = Object.keys(RANK).find((key) => RANK[key] === best) || '';
    const used = contracts.filter((contract) => contract.metric === headlineMetric);
    const flat = [];
    for (const contract of used) {
      for (const group of contract.groups) {
        flat.push({group: group.name, entity: group.entities[0] || group.name, amount: group.amount, contract: {id: contract.id, title: contract.title, amount: group.amount, share: group.share, metric: contract.metricLabel}});
      }
    }
    const regionRoll = rollup(flat);
    const top = regionRoll.groups[0] || null;
    const mack = regionRoll.groups.find((group) => group.name === 'Mack Living') || null;
    const top3 = round(regionRoll.groups.slice(0, 3).reduce((sum, group) => sum + group.share, 0));
    const hhi = Math.round(regionRoll.groups.reduce((sum, group) => sum + Math.pow(group.share, 2), 0));
    const other = contracts.filter((contract) => contract.metric !== headlineMetric);
    let takeaway = 'Share is not yet recorded for this area.';
    if (top && headlineMetric) {
      const held = top.name + ' holds ' + top.share + '% of ' + LABELS[headlineMetric].toLowerCase() + ' in ' + (region.label || 'this area') + '.';
      const mackLine = mack ? ' Mack Living is rank ' + mack.rank + ' with ' + mack.share + '%.' : ' Mack Living has no ' + LABELS[headlineMetric].toLowerCase() + ' recorded in this area.';
      const mix = other.length ? ' ' + other.length + ' other contract' + (other.length === 1 ? ' uses' : 's use') + ' a different metric and ' + (other.length === 1 ? 'is' : 'are') + ' not in this total.' : '';
      takeaway = held + mackLine + ' Top 3 hold ' + top3 + '%. HHI ' + hhi + ', ' + hhiBand(hhi).toLowerCase() + '.' + mix;
    }
    return {
      region: region.label || '',
      metric: headlineMetric,
      metricLabel: headlineMetric ? LABELS[headlineMetric] : '',
      contracts,
      skipped,
      groups: regionRoll.groups,
      total: regionRoll.total,
      top: top ? {name: top.name, share: top.share, rank: top.rank} : null,
      mack: mack ? {name: mack.name, share: mack.share, rank: mack.rank, entities: mack.entities} : null,
      top3,
      hhi,
      hhiBand: headlineMetric ? hhiBand(hhi) : '',
      takeaway,
      otherMetrics: [...new Set(other.map((contract) => contract.metricLabel))]
    };
  }
  root.ShareModel = Object.freeze({build, groupFor, LABELS});
})(typeof window !== 'undefined' ? window : globalThis);
