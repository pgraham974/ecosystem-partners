/* Joint Mack Living and Laurito Capital shell. Loads last and owns the navigation. */
(function () {
  'use strict';
  const COPY = GroupModel.COPY;
  const $ = window.$ || (s => document.querySelector(s));
  const esc = window.esc || (s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  const NOTES_KEY = 'gh-monday-notes';
  const state = {mode:'market', section:'', shortlist:false, setId:'current', weights:null, message:'', monday:null, evidence:null, scores:null, routes:null, lha:null, frameworks:0, competitors:null, compRegion:''};
  const previous = viewMode;

  function asset(name) {
    const url = new URL(name, location.href);
    url.searchParams.set('v', 'group-20261110c');
    return url.href;
  }
  async function loadJson(name) {
    const response = await fetch(asset(name), {cache:'no-store'});
    if (!response.ok) throw new Error(name + ' failed to load (' + response.status + ')');
    return response.json();
  }
  function shown(value) {
    return esc(String(value ?? '').replace(/\s*;\s*/g, '. ').replace(/[\u2014\u2013]/g, ', '));
  }
  function money(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return COPY.blank;
    return new Intl.NumberFormat('en-GB', {style:'currency', currency:'GBP', minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2}).format(value);
  }
  function setHash(hash) {
    const url = new URL(location.href);
    url.hash = hash;
    history.replaceState(null, '', url);
  }
  function show(id) {
    document.querySelectorAll('[id$="_view"]').forEach((view) => view.classList.add('hidden'));
    const host = document.getElementById(id);
    if (host) host.classList.remove('hidden');
  }
  function datasetLines() {
    return (state.evidence.datasets || []).map((row) => '<li><b>' + esc(row.label) + '</b> ' + esc(row.updated) + (row.also ? ' <span class="foot">' + esc(row.also) + '</span>' : '') + ' <span class="foot">' + esc(row.file) + '</span></li>').join('');
  }
  function datasetBlock(open) {
    return '<details class="ms-fold"' + (open ? ' open' : '') + '><summary>' + esc(COPY.datasetsTitle) + '</summary><ul class="gh-dates">' + datasetLines() + '</ul></details>';
  }
  function activeLabel() {
    const set = state.scores.sets[state.setId];
    return set ? set.label : 'Current live weights';
  }
  function choose(id) {
    const set = state.scores.sets[id];
    if (!set) return;
    GroupModel.checkWeights(set.weights);
    state.setId = id;
    state.weights = {...set.weights};
    state.message = id === 'proposed' ? 'Proposed file weights loaded. Not agreed.' : 'Current live weights loaded.';
  }
  function remember(weights) {
    GroupModel.checkWeights(weights);
    state.weights = {...weights};
    state.message = 'Weights applied in this browser. They total 100.';
  }
  function resetActive() {
    choose(state.setId);
    state.message = state.setId === 'proposed' ? 'Proposed file weights restored. Not agreed.' : 'Current file weights restored.';
  }
  function settingsHtml() {
    const cfg = state.scores;
    const active = state.weights;
    const groups = cfg.groups.map((group) => {
      const points = group.keys.reduce((total, key) => total + active[key], 0);
      const inputs = group.keys.map((key) => {
        const test = cfg.tests.find((row) => row.key === key);
        return '<label>' + esc(test.label) + '<input id="mw_' + key + '" type="number" min="0" max="100" step="1" value="' + active[key] + '"> <small>points</small></label>';
      }).join('');
      return '<h3>' + esc(group.label) + ' <span class="foot">' + points + ' on this set</span></h3><div class="ms-weights">' + inputs + '</div>';
    }).join('');
    const rows = cfg.tests.map((test) => {
      const group = cfg.groups.find((item) => item.id === test.group);
      return '<tr><td class="l">' + esc(group.label) + '</td><td class="l">' + esc(test.label) + '</td><td>' + cfg.sets.current.weights[test.key] + '</td><td>' + cfg.sets.proposed.weights[test.key] + '</td></tr>';
    }).join('');
    const banner = state.setId === 'proposed'
      ? '<p class="gh-proposed"><b>Proposed weights. Not agreed.</b> Luke and Liza still have to confirm them.</p>'
      : '<p class="foot">Current live weights are in use. The proposed set is in the comparison and is not agreed.</p>';
    const thresholds = MarketScreen.state.thresholds;
    return '<details class="ms-fold"><summary>Scoring matrix · ' + esc(state.setId === 'proposed' ? 'Proposed weights, not agreed' : activeLabel()) + '</summary>' + banner
      + '<label>Weight set <select id="gh-set"><option value="current"' + (state.setId === 'current' ? ' selected' : '') + '>Current live weights</option><option value="proposed"' + (state.setId === 'proposed' ? ' selected' : '') + '>Proposed weights, not agreed</option></select></label>'
      + groups
      + '<details><summary>Current and proposed side by side</summary><div class="scroll"><table><thead><tr><th class="l">Group</th><th class="l">Test</th><th>Current</th><th>Proposed, not agreed</th></tr></thead><tbody>' + rows + '</tbody></table></div></details>'
      + '<details><summary>How scoring works today</summary><p>' + esc(cfg.engine) + '</p><p>' + esc(cfg.rationale.today) + '</p><p>' + esc(cfg.rationale.proposal) + '</p><p>' + esc(cfg.rationale.notThisScreen) + '</p><p>' + esc(cfg.thresholds.note) + '</p></details>'
      + '<div class="ctl"><label>Minimum trading years <input id="mt_years" type="number" min="0" value="' + thresholds.years + '"></label><label>Revenue £ <input id="mt_revenue" type="number" min="0" value="' + thresholds.revenue + '"></label><label>Net assets £ <input id="mt_assets" type="number" min="0" value="' + thresholds.assets + '"></label><label>Staff <input id="mt_staff" type="number" min="0" value="' + thresholds.staff + '"></label><label>Accounts age, months <input id="mt_accountsMaxMonths" type="number" min="1" value="' + thresholds.accountsMaxMonths + '"></label></div>'
      + '<p class="foot">' + esc(COPY.weightSession) + '</p><button class="btn" id="ms-apply" type="button">Apply matrix</button> <button class="btn sec" id="ms-reset" type="button">Reset this set</button><p role="status" id="ms-settings-status">' + esc(state.message) + '</p></details>';
  }
  window.GroupScores = {weights: () => ({...state.weights}), remember, resetActive, settingsHtml, message: () => state.message};

  function paint() {
    const nav = $('#nav2');
    if (!nav) return;
    const top = state.mode === 'directory' ? 'market' : (state.mode === 'analysis' ? 'analysis' : state.mode);
    const items = [['mack', 'Mack Living'], ['market', 'Market Screen'], ['analysis', 'Analysis Dashboard']];
    nav.innerHTML = '<div class="mainnav">' + items.map(([id, label]) => '<button type="button" class="mainb' + (top === id ? ' on' : '') + '" data-gh="' + id + '">' + label + '</button>').join('') + '</div><div id="gh-sub"></div>';
    nav.querySelectorAll('[data-gh]').forEach((button) => button.onclick = () => viewMode(button.dataset.gh));
    const sub = $('#gh-sub');
    if (top === 'market') {
      const topOn = state.mode === 'directory' && window.PartnersHub && PartnersHub.state.top;
      const buttons = [['market', 'Matrix', !state.shortlist && state.mode !== 'directory'], ['market/shortlist', 'Shortlist', state.shortlist], ['market/directory', 'Directory', state.mode === 'directory' && !topOn], ['market/top', 'Top 10', !!topOn]];
      sub.innerHTML = buttons.map(([hash, label, on]) => '<button type="button" class="subb' + (on ? ' on' : '') + '" data-gh-go="' + hash + '">' + label + '</button>').join('');
    } else if (top === 'analysis') {
      const buttons = [['analysis/regions', 'Evidence', state.section === 'regions' || state.section === 'top'], ['analysis/competitors', 'Competitors', state.section === 'competitors'], ['analysis/contracts', 'Contracts', state.section === 'contracts'], ['analysis/frameworks', 'Framework records', state.section === 'frameworks'], ['analysis/opportunities', 'Opportunity records', state.section === 'opportunities'], ['analysis/workbook', 'Workbook', state.section === 'workbook']];
      sub.innerHTML = buttons.map(([hash, label, on]) => '<button type="button" class="subb' + (on ? ' on' : '') + '" data-gh-go="' + hash + '">' + label + '</button>').join('');
    } else sub.innerHTML = '<span class="foot">Monday morning Mack Living and Laurito Capital</span>';
    sub.querySelectorAll('[data-gh-go]').forEach((button) => button.onclick = () => viewMode(button.dataset.ghGo));
  }
  function brand() {
    const header = document.querySelector('header');
    if (!header) return;
    const mark = asset('laurito-lockup.png');
    header.innerHTML = '<div class="gh-brand"><a class="lc-brand" href="#market" id="gh-brand"><img src="' + esc(mark) + '" alt="Laurito Capital"></a><div class="gh-wordmark"><b>Mack Living</b></div></div><div class="lc-product">Market screening and analysis<span>Mack Living and Laurito Capital</span></div><div id="status">Dated research, not credit approval</div>';
    $('#gh-brand').onclick = (event) => { event.preventDefault(); viewMode('market'); };
    document.title = 'Mack Living and Laurito Capital';
    const disclaimer = document.querySelector('aside.card');
    if (disclaimer) disclaimer.innerHTML = '<details><summary><b>Evidence only.</b> A blank is unknown, not a pass.</summary><p>' + esc(COPY.disclaimer) + '</p></details>';
  }
  function openMarket(shortlist) {
    state.mode = 'market';
    state.section = '';
    state.shortlist = !!shortlist;
    show('pscreen_view');
    paint();
    setHash(shortlist ? 'market/shortlist' : 'market');
    MarketScreen.render();
  }
  function openDirectory() {
    state.mode = 'directory';
    state.shortlist = false;
    previous('who');
    paint();
    setHash('market/directory');
  }
  function openMack(tail) {
    state.mode = 'mack';
    state.section = tail || '';
    state.shortlist = false;
    show('mack_view');
    renderMack();
    paint();
    setHash(tail ? 'mack/' + tail : 'mack');
    if (tail === 'agenda') { const node = document.getElementById('gh-agenda'); if (node) node.scrollIntoView({block:'start'}); }
  }
  function openAnalysis(section) {
    const name = section || 'top';
    state.mode = 'analysis';
    state.section = name;
    state.shortlist = false;
    if (name === 'frameworks') { previous('frameworks'); paint(); setHash('analysis/frameworks'); return; }
    if (name === 'opportunities') { previous('flow'); paint(); setHash('analysis/opportunities'); return; }
    if (name === 'workbook') { previous('sheets'); paint(); setHash('analysis/workbook'); return; }
    if (name === 'return') { previous('return'); paint(); setHash('analysis/return'); return; }
    show('analysis_view');
    renderAnalysis();
    paint();
    setHash(name === 'top' ? 'analysis' : 'analysis/' + name);
    const anchor = name === 'contracts' ? 'gh-contracts' : (name === 'competitors' ? 'gh-competitors' : (name === 'regions' ? 'gh-regions' : (name.indexOf('region/') === 0 ? 'region-' + name.slice(7) : '')));
    if (anchor) { const node = document.getElementById(anchor); if (node) node.scrollIntoView({block:'start'}); }
  }
  function renderMack() {
    const regionName = Object.fromEntries(state.monday.regions.map((row) => [row.id, row.name]));
    const routes = state.monday.contractIds.map((id) => state.routes.find((row) => row.id === id)).filter(Boolean);
    const host = $('#mack-body');
    host.innerHTML = '<div class="ms-hero"><p class="lc-kicker">Mack Living</p><h1>' + esc(state.monday.meeting.name) + '</h1><p class="lc-purpose">' + esc(state.monday.meeting.purpose) + '</p></div>'
      + '<div class="card"><p class="foot">Meeting file ' + esc(state.monday.updated) + '. Route file ' + esc(state.routesUpdated) + '.</p><div class="gh-shortcuts">' + state.monday.shortcuts.map((item) => '<button type="button" class="btn sec" data-gh-go="' + esc(item.hash) + '">' + esc(item.label) + '</button>').join('') + '</div></div>'
      + '<section class="card" id="gh-regions-mack"><h2>Priority regions</h2><div class="gh-grid">' + state.monday.regions.map((row) => '<article id="mack-region-' + esc(row.id) + '"><h3>' + esc(row.name) + '</h3><p><span class="tag a">' + esc(row.status) + '</span></p><p class="foot">' + esc(row.seededFrom) + '</p><button type="button" class="btn sec" data-gh-go="analysis/region/' + esc(row.id) + '">Open in Analysis Dashboard</button></article>').join('') + '</div></section>'
      + '<section class="card"><h2>Priority contracts</h2><p class="foot">' + esc(COPY.routesIntro) + '</p><div class="scroll"><table><thead><tr><th class="l">Route</th><th class="l">Area</th><th class="l">Status</th><th>As of</th></tr></thead><tbody>'
      + routes.map((row) => '<tr><td class="l">' + shown(row.shortName || row.name) + '</td><td class="l">' + shown((row.regions || []).map((id) => regionName[id] || id).join(', ')) + '</td><td class="l">' + shown(row.statusLabel || row.status || '') + '</td><td>' + esc(row.statusAsOf || '') + '</td></tr>').join('')
      + '</tbody></table></div><p><button type="button" class="btn sec" data-gh-go="analysis/contracts">Open contract opportunities</button></p></section>'
      + '<section class="card" id="gh-agenda"><h2>Agenda and notes</h2><ol>' + state.monday.agenda.map((item) => '<li><b>' + esc(item.item) + '</b><p>' + esc(item.note) + '</p></li>').join('') + '</ol>'
      + '<p class="foot">' + esc(state.monday.notesHelp) + '</p><label class="gh-notes">Shared file notes<textarea readonly>' + esc(state.monday.notes || '') + '</textarea></label><label class="gh-notes">' + esc(COPY.notesLocal) + '<textarea id="gh-local-notes">' + esc(state.localNotes) + '</textarea></label></section>'
      + '<div class="card">' + datasetBlock(false) + '</div>';
    host.querySelectorAll('[data-gh-go]').forEach((button) => button.onclick = () => viewMode(button.dataset.ghGo));
    const box = $('#gh-local-notes');
    if (box) box.oninput = () => { state.localNotes = box.value; try { localStorage.setItem(NOTES_KEY, box.value); } catch (error) {} };
  }
  function lhaTable(rows) {
    return '<div class="scroll"><table id="lha-table"><thead><tr><th class="l">BRMA</th><th>Shared</th><th>1 bed</th><th>2 bed</th><th>3 bed</th><th>4 bed</th></tr></thead><tbody>'
      + rows.map((row) => '<tr><td class="l">' + esc(row.name) + '<small>' + esc(row.country) + '</small></td><td>' + money(row.SAR) + '</td><td>' + money(row['1']) + '</td><td>' + money(row['2']) + '</td><td>' + money(row['3']) + '</td><td>' + money(row['4']) + '</td></tr>').join('')
      + '</tbody></table></div>';
  }
  function renderAnalysis() {
    const lha = state.evidence.lha;
    const picked = lha.brmas.map((name) => state.lha.rates.find((row) => row.name === name && row.country === 'England')).filter(Boolean);
    const regionName = Object.fromEntries(state.monday.regions.map((row) => [row.id, row.name]));
    const benchmarks = state.monday.regions.map((region) => {
      const rows = state.evidence.benchmarks.filter((row) => row.regionId === region.id);
      return '<article class="card" id="region-' + esc(region.id) + '"><h3>' + esc(region.name) + '</h3><p><span class="tag a">' + esc(region.status) + '</span></p><table><thead><tr><th class="l">Benchmark</th><th class="l">Figure</th><th class="l">Source</th><th>Date</th></tr></thead><tbody>'
        + rows.map((row) => '<tr><td class="l">' + esc(row.topic) + '</td><td class="l">' + esc(row.value) + '</td><td class="l">' + (row.sourceUrl ? '<a href="' + esc(row.sourceUrl) + '" target="_blank" rel="noopener">' + esc(row.sourceTitle || row.sourceUrl) + '</a>' : esc(COPY.blank)) + '</td><td>' + esc(row.observedAt || COPY.blank) + '</td></tr><tr><td class="l foot" colspan="4">' + esc(row.note || '') + '</td></tr>').join('')
        + '</tbody></table></article>';
    }).join('');
    const routes = state.monday.contractIds.map((id) => state.routes.find((row) => row.id === id)).filter(Boolean);
    const card = state.evidence.manchesterCas;
    const fields = [['buyer', 'Buyer'], ['notice', 'Notice'], ['value', 'Value'], ['term', 'Term'], ['geography', 'Geography'], ['route', 'Route'], ['rent', 'Rent'], ['deadline', 'Deadline'], ['contacts', 'Contacts'], ['next', 'Next step']];
    const bip = state.evidence.bip;
    const host = $('#analysis-body');
    host.innerHTML = '<div class="ms-hero"><p class="lc-kicker">Analysis Dashboard</p><h1>Regions, evidence and opportunities</h1><p class="lc-purpose">' + esc(COPY.analysisLead) + '</p></div>'
      + '<section class="card"><h2>Dashboard framework</h2><p>' + esc(COPY.framework) + '</p><p class="foot">' + state.frameworks + ' framework records, file ' + esc(state.frameworksUpdated) + '.</p><div class="gh-shortcuts"><button type="button" class="btn sec" data-gh-go="analysis/competitors">Competitors</button><button type="button" class="btn sec" data-gh-go="analysis/frameworks">Framework records</button><button type="button" class="btn sec" data-gh-go="analysis/opportunities">Opportunity records</button><button type="button" class="btn sec" data-gh-go="analysis/return">Return check</button><button type="button" class="btn sec" data-gh-go="analysis/workbook">Workbook</button><button type="button" class="btn sec" data-gh-go="market/shortlist">Market Screen shortlist</button></div><p class="foot">' + esc(COPY.propertySite) + ' <a href="https://pgraham974.github.io/ecosystem-deals/" target="_blank" rel="noopener">Property comparison site</a></p></section>'
      + '<section class="card" id="gh-datasets">' + datasetBlock(true) + '</section>'
      + '<section class="card" id="gh-regions"><h2>Priority regions</h2><p class="foot">Each region is a placeholder to confirm. It is seeded from coverage already in this repo.</p><div class="gh-grid">' + state.monday.regions.map((row) => '<article><h3>' + esc(row.name) + '</h3><p><span class="tag a">' + esc(row.status) + '</span></p><p class="foot">' + esc(row.seededFrom) + '</p></article>').join('') + '</div></section>'
      + '<section class="card" id="gh-lha"><h2>' + esc(COPY.lhaTitle) + '</h2><p>Monthly Universal Credit rates for ' + esc(lha.period) + ', valid ' + esc(lha.validFrom) + ' to ' + esc(lha.validTo) + '. Publisher: ' + esc(lha.publisher) + '.</p><p><a href="' + esc(lha.publicationUrl) + '" target="_blank" rel="noopener">GOV.UK publication</a> · <a href="' + esc(lha.englandCsv) + '" target="_blank" rel="noopener">England CSV</a> · <a href="' + esc(lha.voaLookup) + '" target="_blank" rel="noopener">VOA postcode lookup</a></p><p class="foot">Publication updated ' + esc(lha.publicationUpdated) + '. ' + esc(lha.publicationUpdatedNote) + '</p><p class="foot">Rate file retrieved ' + esc(lha.fileRetrieved) + ' and matched ' + esc(lha.fileVerified) + '. ' + esc(lha.spotCheckNote) + '</p><p>' + esc(lha.guidance) + '</p>' + lhaTable(picked)
      + '<details class="ms-fold"><summary>All BRMAs in the rate file (' + state.lha.rates.length + ')</summary><p class="foot">Scotland CSV and Wales CSV were part of the 3 November 2026 match. <a href="' + esc(lha.scotlandCsv) + '" target="_blank" rel="noopener">Scotland</a> · <a href="' + esc(lha.walesCsv) + '" target="_blank" rel="noopener">Wales</a></p>' + lhaTable(state.lha.rates) + '</details></section>'
      + '<section class="card" id="gh-benchmarks"><h2>' + esc(COPY.benchmarksTitle) + '</h2><p>' + esc(COPY.benchmarksIntro) + '</p>' + benchmarks + '</section>'
      + competitorSection()
      + '<section class="card" id="gh-contracts"><h2>' + esc(COPY.contractsTitle) + '</h2><h3>' + esc(COPY.routesTitle) + '</h3><p class="foot">' + esc(COPY.routesIntro) + ' Route file ' + esc(state.routesUpdated) + '.</p><div class="scroll"><table><thead><tr><th class="l">Route</th><th class="l">Area</th><th class="l">Recorded status</th><th>As of</th></tr></thead><tbody>'
      + routes.map((row) => '<tr><td class="l"><b>' + shown(row.shortName || row.name) + '</b><details><summary>Blocker on file</summary><p>' + shown(row.blockerSummary || row.primaryBlocker || COPY.blank) + '</p></details></td><td class="l">' + shown((row.regions || []).map((id) => regionName[id] || id).join(', ')) + '</td><td class="l">' + shown(row.statusLabel || '') + '</td><td>' + esc(row.statusAsOf || '') + '</td></tr>').join('')
      + '</tbody></table></div><article class="card" id="gh-manchester-cas"><h3>' + esc(card.name) + '</h3><p><span class="tag a">' + esc(card.status) + '</span></p><p>' + esc(COPY.manchester) + '</p><dl class="kv">' + fields.map(([key, label]) => '<dt>' + esc(label) + '</dt><dd>' + esc(card[key] ? card[key] : COPY.blank) + '</dd>').join('') + '</dl></article></section>'
      + bipBlock(bip);
    host.querySelectorAll('[data-gh-go]').forEach((button) => button.onclick = () => viewMode(button.dataset.ghGo));
    host.querySelectorAll('[data-bip]').forEach((button) => button.onclick = () => openBip(button.dataset.bip));
    const regionPick = document.getElementById('gh-comp-region');
    if (regionPick) regionPick.onchange = () => { state.compRegion = regionPick.value; renderAnalysis(); const node = document.getElementById('gh-competitors'); if (node) node.scrollIntoView({block:'start'}); };
  }
  async function openBip(id) {
    state.mode = 'analysis';
    state.section = 'frameworks';
    state.shortlist = false;
    previous('frameworks');
    paint();
    setHash('analysis/frameworks');
    for (let i = 0; i < 40; i++) {
      const chip = document.querySelector('[data-rec="BIP:' + id + '"]');
      if (chip) { chip.scrollIntoView({block:'center'}); return; }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  function competitorSection() {
    const all = (state.competitors && state.competitors.competitors) || [];
    const regions = [...new Set(all.map((row) => row.region))].sort((a, b) => a.localeCompare(b, 'en'));
    const shown = GroupModel.filterCompetitors(all, state.compRegion);
    const cards = shown.map((row) => {
      const awards = (row.bip || []).map((id) => '<button type="button" class="btn sec" data-bip="' + esc(id) + '">' + esc(id) + '</button>').join(' ');
      const opps = (row.competesOn || []).map((link) => link.id ? '<b>' + esc(link.id) + '</b> ' + esc(link.name) : esc(link.name) + ' <span class="foot">' + esc(COPY.noCurrentOpp) + '</span>').join('<br>');
      return '<article class="gh-comp"><h3>' + esc(row.name) + ' <span class="foot">' + esc(row.id) + '</span></h3><p>' + esc(row.entity || COPY.blank) + '</p><p>' + esc(row.region) + ' · ' + esc(row.type) + '</p><p>BiP awards ' + (awards || esc(COPY.blank)) + '</p><p>Competes on<br>' + (opps || esc(COPY.blank)) + '</p><details><summary>Note</summary><p>' + shownText(row.note) + (row.also ? '</p><p class="foot">' + shownText(row.also) : '') + '</p></details></article>';
    }).join('');
    return '<section class="card" id="gh-competitors"><h2>' + esc(COPY.competitorsTitle) + '</h2><p>' + esc(COPY.competitorsIntro) + '</p><p class="foot">File ' + esc((state.competitors && state.competitors.updated) || '') + '.</p><div class="ctl"><label>Region <select id="gh-comp-region"><option value="">All regions</option>' + regions.map((region) => '<option value="' + esc(region) + '"' + (state.compRegion === region ? ' selected' : '') + '>' + esc(region) + '</option>').join('') + '</select></label><span class="foot">' + shown.length + ' of ' + all.length + ' shown</span></div>' + cards + '</section>';
  }
  function shownText(value) { return shown(value || COPY.blank); }
  function bipBlock(bip) {
    const built = new Date(bip.built + 'T00:00:00');
    const age = Math.floor((Date.now() - built.getTime()) / 86400000);
    const stale = age > 2 ? '<p class="gh-proposed">Last BiP build ' + esc(bip.built) + ' is ' + age + ' days old. Treat the awards and spend as dated.</p>' : '<p class="foot">Last BiP build ' + esc(bip.built) + '.</p>';
    return '<section class="card" id="gh-bip"><h2>' + esc(COPY.bipTitle) + '</h2><p>' + esc(bip.source) + '</p><p>' + esc(bip.where) + '</p><p class="foot">Refresh overlay checked ' + esc(bip.refreshChecked) + '.</p>' + stale + '<button type="button" class="btn sec" data-gh-go="' + esc(bip.view) + '">' + esc(COPY.bipOpen) + '</button></section>';
  }
  function decorateMarket() {
    const host = $('#ps_body');
    const hero = host && host.querySelector('.ms-hero');
    if (!hero || host.querySelector('#gh-market-extra')) return;
    const setNote = state.setId === 'proposed' ? 'Proposed weights, not agreed.' : 'Current live weights.';
    const bip = state.evidence && state.evidence.bip;
    hero.insertAdjacentHTML('afterend', '<div class="card" id="gh-market-extra"><p>' + esc(COPY.marketSteps) + '</p><p><b>' + esc(COPY.weightsInUse) + ':</b> ' + esc(setNote) + '</p>' + (state.shortlist ? '<p class="gh-proposed">' + esc(COPY.shortlist) + (host.querySelectorAll('#ms-matrix tbody tr').length ? '' : ' ' + esc(COPY.shortlistEmpty)) + '</p>' : '') + (bip ? '<p class="foot">BiP awards stay on Framework records. Last build ' + esc(bip.built) + '.</p><button type="button" class="btn sec" data-gh-go="' + esc(bip.view) + '">' + esc(COPY.bipOpen) + '</button>' : '') + datasetBlock(false) + '</div>');
    const select = $('#gh-set');
    if (select) select.onchange = () => { choose(select.value); MarketScreen.render(); };
    host.querySelectorAll('#gh-market-extra [data-gh-go]').forEach((button) => button.onclick = () => viewMode(button.dataset.ghGo));
  }

  const mackView = document.createElement('div');
  mackView.id = 'mack_view';
  mackView.className = 'hidden';
  mackView.innerHTML = '<main id="mack-body"></main>';
  const analysisView = document.createElement('div');
  analysisView.id = 'analysis_view';
  analysisView.className = 'hidden';
  analysisView.innerHTML = '<main id="analysis-body"></main>';
  document.body.append(mackView, analysisView);

  viewMode = function (mode) {
    const raw = String(mode || 'market');
    const parts = raw.split('/');
    const head = parts[0];
    const tail = parts.slice(1).join('/');
    if (head === 'lha' || head === 'rent') { openAnalysis('regions'); return; }
    if (head === 'mack') { openMack(tail); return; }
    if (head === 'analysis') { openAnalysis(tail); return; }
    if (head === 'market' || head === 'pscreen') {
      if (tail === 'directory' || tail === 'top') {
        if (window.PartnersHub) {
          PartnersHub.state.top = tail === 'top';
          if (tail === 'top' && PartnersHub.state.segment === 'all') PartnersHub.state.segment = 'rp';
        }
        openDirectory();
        if (tail === 'top') setHash('market/top');
      } else openMarket(tail === 'shortlist');
      return;
    }
    if (head === 'who' || head === 'rp' || head === 'operators') {
      if (tail === 'directory') openDirectory();
      else openMarket(false);
      return;
    }
    if (head === 'frameworks') { openAnalysis('frameworks'); return; }
    if (head === 'flow' || head === 'opportunities') { openAnalysis('opportunities'); return; }
    if (head === 'sheets' || head === 'workbook') { openAnalysis('workbook'); return; }
    if (head === 'return') { openAnalysis('return'); return; }
    openMarket(false);
  };
  window.viewMode = viewMode;
  window.addEventListener('hashchange', () => {
    const hash = location.hash.replace(/^#/, '');
    if (hash) viewMode(hash);
  });

  const originalRender = MarketScreen.render;
  MarketScreen.render = async function () {
    if (state.weights) MarketScreen.state.weights = {...state.weights};
    if (state.shortlist) {
      MarketScreen.state.status = 'Meets screen';
      MarketScreen.state.sort = 'score';
      MarketScreen.state.direction = -1;
    }
    await originalRender();
    decorateMarket();
  };

  try { state.localNotes = localStorage.getItem(NOTES_KEY) || ''; } catch (error) { state.localNotes = ''; }
  const ready = (async () => {
    const [scores, monday, evidence, living, lha, frameworks, competitors] = await Promise.all([
      loadJson('scoring-weights.json'), loadJson('mack-monday.json'), loadJson('analysis-evidence.json'), loadJson('mack-living.json'), loadJson('market-lha.json'), loadJson('frameworks.json'), loadJson('competitors.json')
    ]);
    state.scores = scores;
    state.monday = monday;
    state.evidence = evidence;
    state.competitors = competitors;
    state.routes = living.contracts || [];
    state.routesUpdated = living.updated || '';
    state.lha = lha;
    state.frameworks = (frameworks.items || []).length;
    state.frameworksUpdated = frameworks.updated || '';
    choose('current');
    brand();
    paint();
  })();
  window.GroupHub = {ownsNav: true, ready, paint, get state() { return state; }};
})();
