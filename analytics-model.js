/* Chart figures from files already loaded. No blended totals and no invented splits. */
(function (root) {
  'use strict';
  function money(value) {
    return new Intl.NumberFormat('en-GB', {style: 'currency', currency: 'GBP', maximumFractionDigits: 0}).format(value);
  }
  function addDays(iso, days) {
    const [year, month, day] = String(iso).split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }
  function inRegion(record, region) {
    const code = String(record && record.region || '');
    if (!region) return false;
    if (region.id === 'National') return code === 'National' || code === 'England and Wales';
    return (region.bip || []).indexOf(code) !== -1;
  }
  function valueKpi(records) {
    const valued = (records || []).filter((row) => typeof row.value === 'number' && row.value > 0);
    if (!valued.length) return {value: 'Not yet recorded', note: 'No published value on the BiP rows for this area.'};
    const bases = [...new Set(valued.map((row) => row.basis || 'Basis not stated'))];
    if (bases.length > 1) return {value: 'Not one total', note: valued.length + ' published values use different bases, so there is no single total.'};
    const sum = valued.reduce((total, row) => total + row.value, 0);
    return {value: money(sum), note: bases[0] + '. ' + valued.length + (valued.length === 1 ? ' row.' : ' rows.')};
  }
  function build(input) {
    const Model = root.BoardroomModel;
    const today = input.today || '2026-11-18';
    const region = input.region;
    const areas = (Model.REGIONS || []).filter((row) => row.id !== 'National');
    const horizon = addDays(today, 365);
    const schemes = input.schemes || [];
    const bipRows = Object.values(input.bip || {}).filter((row) => inRegion(row, region));
    const openNow = schemes.filter((row) => /live|open/i.test(row.status || '')).length;
    const opening = schemes.filter((row) => row.start && row.start.firm && row.start.iso >= today && row.start.iso <= horizon).length;
    const names = new Set();
    schemes.forEach((row) => ((row.operators && row.operators.names) || []).forEach((name) => names.add(name)));
    const heatmap = areas.map((area) => {
      const built = Model.build({today, region: area.id, lha: input.lha, ons: input.ons, frameworks: {items: []}, v4: {fwLinks: [], bip: {}}, position: {}});
      const cells = ['1', '2', '3', '4'].map((key) => {
        const bed = built.rates.find((row) => row.key === key);
        if (!bed || bed.gapPercent == null) return {text: 'n/a', band: 'na', title: 'Not yet recorded'};
        return {text: (bed.gapPercent > 0 ? '+' : '') + bed.gapPercent + '%', band: Model.gapBand(bed.gapPercent), title: bed.label + ' ' + money(Math.abs(bed.gap))};
      });
      return {id: area.id, label: area.label, cells};
    });
    const gaps = heatmap.map((row) => {
      const built = Model.build({today, region: row.id, lha: input.lha, ons: input.ons, frameworks: {items: []}, v4: {fwLinks: [], bip: {}}, position: {}});
      const widest = built.rates.filter((bed) => bed.gap != null).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))[0];
      return widest ? {id: row.id, label: row.label, bed: widest.label, pounds: Math.abs(widest.gap), pct: Math.abs(widest.gapPercent), band: Model.gapBand(widest.gapPercent)} : {id: row.id, label: row.label, bed: '', pounds: null, pct: null, band: 'na'};
    }).sort((a, b) => (b.pounds || -1) - (a.pounds || -1));
    const dated = schemes.filter((row) => (row.start && row.start.firm) || (row.end && row.end.firm));
    const ganttDates = [today];
    dated.forEach((row) => {
      if (row.start && row.start.firm) ganttDates.push(row.start.iso);
      if (row.end && row.end.firm) ganttDates.push(row.end.iso);
    });
    ganttDates.sort();
    const share = root.ShareModel ? root.ShareModel.build({region, bip: input.bip, opps: input.opps}) : null;
    const national = (Model.REGIONS || []).find((row) => row.id === 'National');
    const lotShare = root.ShareModel && national ? root.ShareModel.build({region: national, bip: input.bip, opps: input.opps}) : null;
    const concentration = lotShare && lotShare.metric === 'lots' ? {label: 'Share of lot places on the national framework', groups: lotShare.groups.slice(0, 8), note: region.id === 'National' ? '' : 'This is the national framework. It is not a split of local spend.'} : {label: '', groups: [], note: 'Lot places are not recorded for a concentration chart.'};
    let targets = {below: null, above: null, untested: null, note: 'The yield hurdle is not yet recorded.'};
    if (input.hurdle && root.AuctionCounts && input.rates) {
      const lots = ((input.auctions && input.auctions.lots) || []).filter((lot) => lot.region === region.id);
      const assessed = root.AuctionCounts.assess(lots, input.rates, input.hurdle);
      const view = assessed.lha;
      targets = {below: view.below, above: view.above, untested: view.untested, note: lots.length ? 'LHA threshold at the current yield hurdle. No bed count or no guide price is not testable.' : 'No current lots are loaded for this area.'};
    }
    const demand = [];
    const watch = root.TriageModel && root.TriageModel.signalItems ? root.TriageModel.signalItems(input.signals, region.id) : [];
    watch.forEach((row) => demand.push({name: row.name, units: typeof row.units === 'number' ? row.units : null, unverified: row.verified !== 'Confirmed', note: row.kind}));
    ((input.signals && input.signals.demand) || []).forEach((row) => demand.push({name: row.name, units: typeof row.units === 'number' ? row.units : null, unverified: true, note: row.signal}));
    const partners = {};
    schemes.forEach((row) => ((row.operators && row.operators.names) || []).forEach((name) => { partners[name] = (partners[name] || 0) + 1; }));
    const partnerBars = Object.keys(partners).map((name) => ({name, count: partners[name]})).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 8);
    const withGap = heatmap.filter((row) => row.cells.some((cell) => cell.band !== 'na')).length;
    return {
      kpis: [
        {label: 'Schemes tracked', value: String(schemes.length), note: 'Framework schemes recorded for this area.'},
        {label: 'Published value', value: valueKpi(bipRows).value, note: valueKpi(bipRows).note},
        {label: 'Open now', value: String(openNow), note: opening + ' firm starts fall inside 12 months.'},
        {label: 'Named operators', value: names.size ? String(names.size) : 'Not yet recorded', note: 'Firms named on the schemes in this area. A firm on two schemes is counted once.'},
        {label: 'Areas with a gap', value: String(withGap), note: 'Of the eight selector areas, how many have an LHA and an ONS rent.'}
      ],
      heatmap,
      gaps,
      gantt: {min: ganttDates[0], max: ganttDates[ganttDates.length - 1], today, rows: dated.slice(0, 12).map((row) => ({name: row.name, start: row.start && row.start.firm ? row.start.iso : '', end: row.end && row.end.firm ? row.end.iso : '', status: row.status || 'Not yet recorded'}))},
      share,
      concentration,
      targets,
      demand,
      partners: partnerBars
    };
  }
  root.AnalyticsModel = Object.freeze({build, valueKpi, inRegion});
})(typeof window !== 'undefined' ? window : globalThis);
