/* Joint Mack Living and Laurito Capital shell. Loads last and owns the navigation. */
(function () {
  'use strict';
  const COPY = GroupModel.COPY;
  const $ = window.$ || (s => document.querySelector(s));
  const esc = window.esc || (s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  const NOTES_KEY = 'gh-monday-notes';
  const CHECKLIST_KEY = 'gh-checklist-v1';
  const state = {mode:'board', section:'', region:'GM', boardPick:'', positionFile:null, shortlist:false, setId:'current', weights:null, message:'', monday:null, evidence:null, scores:null, routes:null, living:null, v4:null, fwItems:null, lha:null, frameworks:0, competitors:null, compRegion:'', ml:{region:'GM', lease:'', status:'', sort:'deadline'}};
  let checklistDoc = null;
  let checklistMeta = {purpose:'', storageNote:''};
  let checklistMessage = '';
  const previous = viewMode;

  function asset(name) {
    const url = new URL(name, location.href);
    url.searchParams.set('v', 'group-20261117');
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
    const top = state.mode === 'directory' ? 'records' : state.mode;
    const items = [['board', 'Boardroom'], ['market', 'Market Screen'], ['analysis', 'Analysis Dashboard'], ['mack', 'Mack Living'], ['records', 'Records']];
    nav.innerHTML = '<div class="mainnav">' + items.map(([id, label]) => '<button type="button" class="mainb' + (top === id ? ' on' : '') + '" data-gh="' + id + '">' + label + '</button>').join('') + '</div><div id="gh-sub"></div>';
    nav.querySelectorAll('[data-gh]').forEach((button) => button.onclick = () => viewMode(button.dataset.gh));
    const sub = $('#gh-sub');
    if (top === 'market') {
      const topOn = state.mode === 'directory' && window.PartnersHub && PartnersHub.state.top;
      const buttons = [['market', 'Matrix', !state.shortlist && state.mode !== 'directory'], ['market/shortlist', 'Shortlist', state.shortlist], ['market/directory', 'Directory', state.mode === 'directory' && !topOn], ['market/top', 'Top 10', !!topOn]];
      sub.innerHTML = '<button type="button" class="subb" data-gh-go="board">Back to the boardroom</button>' + buttons.map(([hash, label, on]) => '<button type="button" class="subb' + (on ? ' on' : '') + '" data-gh-go="' + hash + '">' + label + '</button>').join('');
    } else if (top === 'analysis') {
      const evidenceOn = ['regions', 'top', 'lha', 'manchester', 'benchmarks'].includes(state.section) || String(state.section).indexOf('region/') === 0;
      const buttons = [['analysis/regions', 'Evidence', evidenceOn], ['records/frameworks', 'Framework records', false], ['records/opportunities', 'Opportunity records', false], ['records/workbook', 'Workbook', false]];
      sub.innerHTML = '<button type="button" class="subb" data-gh-go="board">Back to the boardroom</button>' + buttons.map(([hash, label, on]) => '<button type="button" class="subb' + (on ? ' on' : '') + '" data-gh-go="' + hash + '">' + label + '</button>').join('');
    } else if (top === 'records') {
      const buttons = [['records/position', 'Position', state.section === 'position'], ['records/frameworks', 'Frameworks', state.section === 'frameworks'], ['records/opportunities', 'Opportunities', state.section === 'opportunities'], ['records/workbook', 'Workbook', state.section === 'workbook'], ['records/counterparties', 'Counterparties', state.section === 'counterparties']];
      sub.innerHTML = '<button type="button" class="subb" data-gh-go="board">Back to the boardroom</button>' + buttons.map(([hash, label, on]) => '<button type="button" class="subb' + (on ? ' on' : '') + '" data-gh-go="' + hash + '">' + label + '</button>').join('');
    } else if (top === 'board') sub.innerHTML = '';
    else sub.innerHTML = '<button type="button" class="subb" data-gh-go="board">Back to the boardroom</button><span class="foot">' + esc(BoardroomModel.regionById(state.region).label) + ' only</span>';
    sub.querySelectorAll('[data-gh-go]').forEach((button) => button.onclick = () => viewMode(button.dataset.ghGo));
  }
  function brand() {
    const header = document.querySelector('header');
    if (!header) return;
    const mark = asset('laurito-lockup.png');
    header.innerHTML = '<div class="gh-brand"><a class="lc-brand" href="#board" id="gh-brand"><img src="' + esc(mark) + '" alt="Laurito Capital"></a><div class="gh-wordmark"><b>Mack Living</b></div></div><label class="gh-region">Area <select id="gh-region">' + BoardroomModel.REGIONS.map((row) => '<option value="' + row.id + '"' + (row.id === state.region ? ' selected' : '') + '>' + esc(row.label) + '</option>').join('') + '</select></label><a class="an-deals" href="https://pgrahamlc.github.io/ecosystem-deals/" target="_blank" rel="noopener">Ecosystem Deals</a><div id="status">Dated research, not credit approval</div>';
    $('#gh-brand').onclick = (event) => { event.preventDefault(); viewMode('board'); };
    $('#gh-region').onchange = () => setRegion($('#gh-region').value);
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
    const anchor = tail === 'agenda' ? 'gh-agenda' : (tail ? 'ml-' + tail : '');
    if (anchor) { const node = document.getElementById(anchor); if (node) node.scrollIntoView({block:'start'}); }
  }
  function opportunityId(value) {
    return /^(GM|BR|GL)-[A-Z0-9-]+$/.test(value || '') ? value : '';
  }
  function openAnalysis(section) {
    const name = section || 'top';
    state.mode = 'analysis';
    state.section = name.indexOf('opportunities/') === 0 ? 'opportunities' : name;
    state.shortlist = false;
    if (name === 'frameworks') { previous('frameworks'); paint(); setHash('analysis/frameworks'); return; }
    if (name === 'opportunities' || name.indexOf('opportunities/') === 0) {
      const id = opportunityId(name.slice('opportunities/'.length));
      previous(id ? 'flow/' + id : 'flow');
      paint();
      setHash(id ? 'analysis/opportunities/' + id : 'analysis/opportunities');
      return;
    }
    if (name === 'workbook') { previous('sheets'); paint(); setHash('analysis/workbook'); return; }
    if (name === 'return') { previous('return'); paint(); setHash('analysis/return'); return; }
    show('analysis_view');
    renderAnalysis();
    paint();
    setHash(name === 'top' ? 'analysis' : 'analysis/' + name);
    const anchors = {contracts:'gh-contracts', competitors:'gh-competitors', regions:'gh-regions', lha:'gh-lha', manchester:'gh-manchester-cas', benchmarks:'gh-benchmarks'};
    const anchor = name.indexOf('region/') === 0 ? 'region-' + name.slice(7) : (anchors[name] || '');
    if (anchor) { const node = document.getElementById(anchor); if (node) node.scrollIntoView({block:'start'}); }
  }
  function dealField(label, value) {
    return '<div><dt>' + esc(label) + '</dt><dd>' + esc(value || MlCommercial.NOT_STATED) + '</dd></div>';
  }
  function renderMack() {
    const pack = MlCommercial.build({living: state.living, frameworks: {items: state.fwItems || []}, v4: state.v4, manchester: state.evidence && state.evidence.manchesterCas, today: new Date().toISOString().slice(0, 10)});
    const query = state.ml;
    const visible = MlCommercial.sortCards(MlCommercial.filterCards(pack.cards, query), query.sort);
    const leases = [...new Set(pack.cards.map((row) => row.leaseType))];
    const statuses = [...new Set(pack.cards.map((row) => row.bucket))];
    const regions = [['', 'All regions'], ['GM', 'Greater Manchester'], ['BRS', 'Bristol / West'], ['GLOS', 'Gloucestershire'], ['National', 'England and Wales']];
    const summary = pack.summary;
    const host = $('#mack-body');
    host.innerHTML = '<div class="ms-hero"><p class="lc-kicker">Mack Living</p><h1>What is the lease?</h1><p class="lc-purpose">Length, rent, voids and repairs, shown only where a source states them. Anything else is not stated or to confirm.</p></div>'
      + '<div class="card"><div class="ms-summary"><span><b>' + summary.live + '</b> open records</span><span><b>' + esc(summary.nearest ? Number(summary.nearest.slice(8)) + ' ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(summary.nearest.slice(5,7))-1] + ' ' + summary.nearest.slice(0,4) : 'not stated') + '</b> nearest deadline</span><span><b>' + (summary.units == null ? 'not stated' : summary.units) + '</b> stated units</span><span><b>' + esc(summary.longest) + '</b> longest stated term</span></div><p class="foot">Open records exclude historical, forthcoming, appointed and to confirm rows. Stated units are the minimum 66 on the recorded P-1476 notice only. The longest term is the longest lease length written on a term or route row.</p><div class="gh-shortcuts">' + state.monday.shortcuts.map((item) => '<button type="button" class="btn sec" data-gh-go="' + esc(item.hash) + '">' + esc(item.label) + '</button>').join('') + '<button type="button" class="btn sec" data-gh-go="board">Boardroom</button></div></div>'
      + '<section class="card" id="gh-deals"><div class="ctl"><label>Region <select id="ml-region">' + regions.map(([id, label]) => '<option value="' + id + '"' + (query.region === id ? ' selected' : '') + '>' + esc(label) + '</option>').join('') + '</select></label><label>Lease type <select id="ml-lease"><option value="">All types</option>' + leases.map((item) => '<option' + (query.lease === item ? ' selected' : '') + '>' + esc(item) + '</option>').join('') + '</select></label><label>Status <select id="ml-status"><option value="">All statuses</option>' + statuses.map((item) => '<option' + (query.status === item ? ' selected' : '') + '>' + esc(item) + '</option>').join('') + '</select></label><label>Sort <select id="ml-sort"><option value="deadline"' + (query.sort === 'deadline' ? ' selected' : '') + '>Deadline</option><option value="term"' + (query.sort === 'term' ? ' selected' : '') + '>Term length</option></select></label><span class="foot">' + visible.length + ' of ' + pack.cards.length + ' shown</span></div>'
      + visible.map((row) => '<article class="gh-deal" id="ml-' + esc(row.id || '') + '"><div class="gh-deal-h"><h3>' + esc(row.name) + '</h3><span class="tag">' + esc(row.bucket) + '</span></div><p>' + esc(row.leaseType) + ' · ' + esc(row.region) + ' · ' + esc(row.source) + '</p><p class="foot">' + esc(row.status) + '</p><dl class="gh-deal-grid">' + dealField('Length', row.length) + dealField('Start', row.start) + dealField('End', row.end) + dealField('Breaks or extensions', row.breaks) + dealField('Rent basis', row.rentBasis) + dealField('Rent level', row.rentLevel) + dealField('Voids', row.voids) + dealField('Repairs', row.repairs) + dealField('Buyer', row.buyer) + dealField('Units sought', row.units) + dealField('Deadline', row.deadlineLabel) + '</dl><p><b>Next step. </b>' + esc(row.next) + '</p><p>BiP ' + ((row.bip || []).length ? row.bip.map((id) => '<button type="button" class="btn sec" data-bip="' + esc(id) + '">' + esc(id) + '</button>').join(' ') : esc(MlCommercial.NOT_STATED)) + '</p>' + (row.evidence ? '<details><summary>Source wording</summary><p>' + esc(row.evidence) + '</p></details>' : '') + '</article>').join('')
      + '</section>'
      + '<section class="card" id="gh-agenda"><h2>Monday discussion</h2><p>' + esc(state.monday.meeting.purpose) + '</p><ol>' + state.monday.agenda.map((item) => '<li><b>' + esc(item.item) + '</b><p>' + esc(item.note) + '</p></li>').join('') + '</ol>'
      + '<details><summary>Priority regions, still to confirm</summary><div class="gh-grid">' + state.monday.regions.map((row) => '<article><h3>' + esc(row.name) + '</h3><p><span class="tag a">' + esc(row.status) + '</span></p><p class="foot">' + esc(row.seededFrom) + '</p></article>').join('') + '</div></details>'
      + '<p class="foot">' + esc(state.monday.notesHelp) + '</p><label class="gh-notes">Shared file notes<textarea readonly>' + esc(state.monday.notes || '') + '</textarea></label><label class="gh-notes">' + esc(COPY.notesLocal) + '<textarea id="gh-local-notes">' + esc(state.localNotes) + '</textarea></label></section>'
      + '<div class="card">' + datasetBlock(false) + '</div>';
    host.querySelectorAll('[data-gh-go]').forEach((button) => button.onclick = () => viewMode(button.dataset.ghGo));
    host.querySelectorAll('[data-bip]').forEach((button) => button.onclick = () => openBip(button.dataset.bip));
    $('#ml-region').onchange = (event) => { state.ml.region = event.target.value; renderMack(); };
    $('#ml-lease').onchange = (event) => { state.ml.lease = event.target.value; renderMack(); };
    $('#ml-status').onchange = (event) => { state.ml.status = event.target.value; renderMack(); };
    $('#ml-sort').onchange = (event) => { state.ml.sort = event.target.value; renderMack(); };
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
      + '<section class="card"><h2>Dashboard framework</h2><p>' + esc(COPY.framework) + '</p><p class="foot">' + state.frameworks + ' framework records, file ' + esc(state.frameworksUpdated) + '.</p><div class="gh-shortcuts"><button type="button" class="btn sec" data-gh-go="analysis/competitors">Competitors</button><button type="button" class="btn sec" data-gh-go="analysis/frameworks">Framework records</button><button type="button" class="btn sec" data-gh-go="analysis/opportunities">Opportunity records</button><button type="button" class="btn sec" data-gh-go="analysis/return">Return check</button><button type="button" class="btn sec" data-gh-go="analysis/workbook">Workbook</button><button type="button" class="btn sec" data-gh-go="market/shortlist">Market Screen shortlist</button><button type="button" class="btn sec" data-gh-go="checklist">Go / No-Go Checklist</button></div><p class="foot">' + esc(COPY.propertySite) + ' <a href="https://pgraham974.github.io/ecosystem-deals/" target="_blank" rel="noopener">Property comparison site</a></p></section>'
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

  function saveChecklist() {
    try { localStorage.setItem(CHECKLIST_KEY, ChecklistModel.serialise(checklistDoc)); } catch (error) {}
  }
  function storedChecklist(seed) {
    const seeded = ChecklistModel.fromSeed(seed);
    try {
      const raw = localStorage.getItem(CHECKLIST_KEY);
      if (!raw) return seeded;
      const parsed = ChecklistModel.parseImport(raw);
      return parsed.error ? seeded : parsed.state;
    } catch (error) {
      return seeded;
    }
  }
  function checklistCount(done, total) {
    return done + ' of ' + total + ' done';
  }
  function checklistLink(link) {
    if (link.hash) return '<button type="button" class="btn sec" data-gh-go="' + esc(link.hash) + '">' + esc(link.label) + '</button>';
    return '<a class="btn sec" href="' + esc(link.href) + '" target="_blank" rel="noopener">' + esc(link.label) + '</a>';
  }
  function renderChecklist() {
    const host = $('#checklist-body');
    if (!host) return;
    if (!checklistDoc || !window.ChecklistModel) {
      host.innerHTML = '<p role="status">Loading the checklist...</p>';
      return;
    }
    const summary = ChecklistModel.summarise(checklistDoc);
    const statuses = ChecklistModel.STATUSES;
    const sections = checklistDoc.workstreams.map((ws) => {
      const count = summary.streams.find((row) => row.id === ws.id) || {done:0, total:0, percent:0};
      const items = ws.items.map((item) => {
        const options = statuses.map((row) => '<option value="' + row.id + '"' + (item.status === row.id ? ' selected' : '') + '>' + row.label + '</option>').join('');
        const links = (item.links || []).map(checklistLink).join('');
        return '<article class="gn-item' + (item.done ? ' done' : '') + '" id="gn-item-' + esc(ws.id) + '-' + esc(item.id) + '">'
          + '<div class="gn-top"><label class="gn-check"><input type="checkbox" data-gn-done="' + esc(ws.id) + '" data-gn-item="' + esc(item.id) + '"' + (item.done ? ' checked' : '') + '> Done</label>'
          + '<p class="gn-q">' + esc(item.text) + '</p></div>'
          + '<div class="gn-meta"><label>Status <select data-gn-status="' + esc(ws.id) + '" data-gn-item="' + esc(item.id) + '">' + options + '</select></label>'
          + '<label>Owner <input data-gn-owner="' + esc(ws.id) + '" data-gn-item="' + esc(item.id) + '" value="' + esc(item.owner) + '" placeholder="Name" autocomplete="off"></label>'
          + '<button type="button" class="btn sec" data-gn-del="' + esc(ws.id) + '" data-gn-item="' + esc(item.id) + '">Delete</button></div>'
          + '<label class="gn-notes">Notes or answer <textarea data-gn-notes="' + esc(ws.id) + '" data-gn-item="' + esc(item.id) + '" placeholder="Short answer">' + esc(item.notes) + '</textarea></label>'
          + (links ? '<div class="gn-links">' + links + '</div>' : '')
          + '</article>';
      }).join('');
      return '<section class="card" id="gn-' + esc(ws.id) + '"><div class="gn-ws-h"><h2>' + esc(ws.title) + '</h2><p class="foot" id="gn-prog-' + esc(ws.id) + '">' + checklistCount(count.done, count.total) + '</p></div>'
        + '<div class="gn-bar" aria-hidden="true"><span style="width:' + count.percent + '%"></span></div>'
        + items
        + '<form class="gn-add" data-gn-add="' + esc(ws.id) + '"><input placeholder="New checklist item" aria-label="New item in ' + esc(ws.title) + '" autocomplete="off"><button class="btn" type="submit">Add item</button></form>'
        + '<details><summary class="foot">Remove this workstream</summary><button type="button" class="btn sec" data-gn-del-ws="' + esc(ws.id) + '">Delete workstream</button></details>'
        + '</section>';
    }).join('');
    host.innerHTML = '<div class="ms-hero"><p class="lc-kicker">Go / No-Go</p><h1>Go / No-Go Checklist</h1><p class="lc-purpose">' + esc(checklistMeta.purpose) + '</p></div>'
      + '<div class="kpis"><div class="kpi"><small>Overall</small><b id="gn-overall">' + checklistCount(summary.done, summary.total) + '</b></div>'
      + summary.streams.map((row) => '<div class="kpi"><small>' + esc(row.title) + '</small><b>' + checklistCount(row.done, row.total) + '</b></div>').join('')
      + '</div>'
      + sections
      + '<section class="card" id="gn-share"><h2>Add a workstream</h2><form class="gn-add" id="gn-add-ws"><input id="gn-ws-name" placeholder="New workstream name" aria-label="New workstream name" autocomplete="off"><button class="btn" type="submit">Add workstream</button></form>'
      + '<div class="gn-tools"><button type="button" class="btn sec" id="gn-export">Export JSON</button><button type="button" class="btn sec" id="gn-import-btn">Import JSON</button><input id="gn-import" type="file" accept="application/json,.json" hidden></div>'
      + '<p role="status" id="gn-msg">' + esc(checklistMessage) + '</p>'
      + '<p class="foot">' + esc(checklistMeta.storageNote) + '</p></section>';
    wireChecklist(host);
  }
  function wireChecklist(host) {
    const say = (text) => { const msg = $('#gn-msg'); if (msg) msg.textContent = text; };
    host.querySelectorAll('[data-gh-go]').forEach((button) => button.onclick = () => viewMode(button.dataset.ghGo));
    host.querySelectorAll('[data-gn-done]').forEach((box) => box.onchange = () => {
      checklistMessage = '';
      checklistDoc = ChecklistModel.setDone(checklistDoc, box.dataset.gnDone, box.dataset.gnItem, box.checked);
      saveChecklist();
      renderChecklist();
    });
    host.querySelectorAll('[data-gn-status]').forEach((select) => select.onchange = () => {
      checklistMessage = '';
      checklistDoc = ChecklistModel.setStatus(checklistDoc, select.dataset.gnStatus, select.dataset.gnItem, select.value);
      saveChecklist();
      renderChecklist();
    });
    host.querySelectorAll('[data-gn-owner]').forEach((input) => input.oninput = () => {
      checklistDoc = ChecklistModel.setField(checklistDoc, input.dataset.gnOwner, input.dataset.gnItem, 'owner', input.value);
      saveChecklist();
    });
    host.querySelectorAll('[data-gn-notes]').forEach((input) => input.oninput = () => {
      checklistDoc = ChecklistModel.setField(checklistDoc, input.dataset.gnNotes, input.dataset.gnItem, 'notes', input.value);
      saveChecklist();
    });
    host.querySelectorAll('[data-gn-del]').forEach((button) => button.onclick = () => {
      checklistMessage = '';
      checklistDoc = ChecklistModel.deleteItem(checklistDoc, button.dataset.gnDel, button.dataset.gnItem).state;
      saveChecklist();
      renderChecklist();
    });
    host.querySelectorAll('[data-gn-del-ws]').forEach((button) => button.onclick = () => {
      checklistMessage = '';
      checklistDoc = ChecklistModel.deleteWorkstream(checklistDoc, button.dataset.gnDelWs).state;
      saveChecklist();
      renderChecklist();
      paint();
    });
    host.querySelectorAll('form[data-gn-add]').forEach((form) => form.onsubmit = (event) => {
      event.preventDefault();
      const result = ChecklistModel.addItem(checklistDoc, form.dataset.gnAdd, form.querySelector('input').value);
      checklistMessage = result.error || '';
      if (result.error) { say(result.error); return; }
      checklistDoc = result.state;
      saveChecklist();
      renderChecklist();
    });
    const addWs = $('#gn-add-ws');
    if (addWs) addWs.onsubmit = (event) => {
      event.preventDefault();
      const result = ChecklistModel.addWorkstream(checklistDoc, $('#gn-ws-name').value);
      checklistMessage = result.error || '';
      if (result.error) { say(result.error); return; }
      checklistDoc = result.state;
      saveChecklist();
      renderChecklist();
      paint();
    };
    const exportBtn = $('#gn-export');
    if (exportBtn) exportBtn.onclick = () => {
      const blob = new Blob([ChecklistModel.serialise(checklistDoc)], {type:'application/json'});
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'go-no-go-checklist.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    };
    const importBtn = $('#gn-import-btn');
    const importFile = $('#gn-import');
    if (importBtn && importFile) {
      importBtn.onclick = () => importFile.click();
      importFile.onchange = () => {
        const file = importFile.files && importFile.files[0];
        importFile.value = '';
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const parsed = ChecklistModel.parseImport(String(reader.result || ''));
          if (parsed.error) { checklistMessage = parsed.error; renderChecklist(); return; }
          checklistDoc = parsed.state;
          checklistMessage = 'Checklist replaced from the file.';
          saveChecklist();
          renderChecklist();
          paint();
        };
        reader.readAsText(file);
      };
    }
  }
  function openChecklist(tail) {
    state.mode = 'checklist';
    state.section = tail || '';
    state.shortlist = false;
    show('checklist_view');
    renderChecklist();
    paint();
    setHash(tail ? 'checklist/' + tail : 'checklist');
    if (tail) { const node = document.getElementById('gn-' + tail); if (node) node.scrollIntoView({block:'start'}); }
  }

  function leaveBoard() {
    document.body.classList.remove('bd-on', 'bd-present');
  }
  function positionData() {
    const file = (state.positionFile && state.positionFile.regions) || {};
    let local = {};
    try { local = JSON.parse(localStorage.getItem('gh-position') || '{}'); } catch (error) { local = {}; }
    const merged = {};
    for (const region of BoardroomModel.REGIONS) {
      const base = file[region.id] || {};
      const saved = local[region.id] || {};
      merged[region.id] = Object.assign({}, base, saved, {omr: Object.assign({}, base.omr || {}, saved.omr || {})});
    }
    return merged;
  }
  function applyRegion() {
    const region = BoardroomModel.regionById(state.region);
    state.ml.region = region.id === 'National' ? '' : region.id;
    if (typeof FWF !== 'undefined') FWF.reg = region.id === 'National' ? '' : region.id;
    if (window.MarketScreen && MarketScreen.state) MarketScreen.state.city = region.city || '';
  }
  function setRegion(id) {
    state.region = id;
    state.boardPick = '';
    try { localStorage.setItem('gh-region', id); } catch (error) {}
    applyRegion();
    const header = document.getElementById('gh-region');
    if (header) header.value = id;
    if (state.mode === 'board') renderBoard();
    else if (state.mode === 'mack') renderMack();
    else if (state.mode === 'analysis') renderAnalysis();
    else if (state.mode === 'market' && window.MarketScreen) MarketScreen.render();
    else if (state.mode === 'records') viewMode('records/' + (state.section || 'position'));
  }
  function togglePresent() {
    const on = document.body.classList.toggle('bd-present');
    if (on && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }
  function renderBoard() {
    document.body.classList.add('bd-on');
    const host = document.getElementById('board-body');
    const built = BoardroomModel.build({today: new Date().toISOString().slice(0, 10), region: state.region, frameworks: {items: state.fwItems || []}, v4: state.v4, lha: state.lha, position: positionData()});
    BoardroomUI.render(host, built, {selected: state.boardPick, onRegion: setRegion, onPresent: togglePresent, onGo: (hash) => viewMode(hash), onSelect: (id) => { state.boardPick = id; renderBoard(); }});
  }
  function openBoard() {
    state.mode = 'board';
    state.section = '';
    show('board_view');
    renderBoard();
    paint();
    setHash('board');
  }
  function openPosition() {
    leaveBoard();
    state.mode = 'records';
    state.section = 'position';
    show('records_view');
    BoardroomUI.positionForm(document.getElementById('records-body'), state.region, positionData(), (saved) => {
      if (!saved) { viewMode('board'); return; }
      const all = positionData();
      all[state.region] = saved;
      try { localStorage.setItem('gh-position', JSON.stringify(all)); } catch (error) {}
    });
    paint();
    setHash('records/position');
  }
  function openRecords(section) {
    const name = section || 'position';
    if (name === 'position') { openPosition(); return; }
    leaveBoard();
    state.mode = 'records';
    const head = name.split('/')[0];
    state.section = head;
    if (head === 'opportunities') {
      const id = opportunityId(name.slice('opportunities/'.length));
      previous(id ? 'flow/' + id : 'flow');
      paint();
      setHash(id ? 'records/opportunities/' + id : 'records/opportunities');
      return;
    }
    if (head === 'workbook') { previous('sheets'); paint(); setHash('records/workbook'); return; }
    if (head === 'counterparties') { previous('who'); paint(); setHash('records/counterparties'); return; }
    previous('frameworks');
    paint();
    setHash('records/frameworks');
  }

  const mackView = document.createElement('div');
  mackView.id = 'mack_view';
  mackView.className = 'hidden';
  mackView.innerHTML = '<main id="mack-body"></main>';
  const analysisView = document.createElement('div');
  analysisView.id = 'analysis_view';
  analysisView.className = 'hidden';
  analysisView.innerHTML = '<main id="analysis-body"></main>';
  const checklistView = document.createElement('div');
  checklistView.id = 'checklist_view';
  checklistView.className = 'hidden';
  checklistView.innerHTML = '<main id="checklist-body"></main>';
  const boardView = document.createElement('div');
  boardView.id = 'board_view';
  boardView.className = 'hidden';
  boardView.innerHTML = '<main id="board-body"></main>';
  const recordsView = document.createElement('div');
  recordsView.id = 'records_view';
  recordsView.className = 'hidden';
  recordsView.innerHTML = '<main id="records-body"></main>';
  document.body.append(boardView, recordsView, mackView, analysisView, checklistView);

  viewMode = function (mode) {
    const raw = String(mode || 'market');
    const parts = raw.split('/');
    const head = parts[0];
    const tail = parts.slice(1).join('/');
    if (!head || head === 'board' || head === 'analytics' || head === 'checklist') { openBoard(); return; }
    if (head === 'records' || head === 'data') { openRecords(tail); return; }
    leaveBoard();
    if (head === 'lha' || head === 'rent') { openAnalysis('lha'); return; }
    if (head === 'mack') { openMack(tail); return; }
    if (head === 'analysis') { openAnalysis(tail === 'frameworks' ? 'regions' : tail); return; }
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
    if (head === 'frameworks') { openRecords('frameworks'); return; }
    if (head === 'flow' || head === 'opportunities') { openRecords(opportunityId(tail) ? 'opportunities/' + tail : 'opportunities'); return; }
    if (head === 'sheets' || head === 'workbook') { openRecords('workbook'); return; }
    if (head === 'return') { openAnalysis('return'); return; }
    if (head === 'who') { openRecords('counterparties'); return; }
    openBoard();
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
    const [scores, monday, evidence, living, lha, frameworks, competitors, v4, positionFile] = await Promise.all([
      loadJson('scoring-weights.json'), loadJson('mack-monday.json'), loadJson('analysis-evidence.json'), loadJson('mack-living.json'), loadJson('market-lha.json'), loadJson('frameworks.json'), loadJson('competitors.json'), loadJson('v4-enrich.json'), loadJson('portfolio-position.json')
    ]);
    state.positionFile = positionFile;
    try { state.region = localStorage.getItem('gh-region') || 'GM'; } catch (error) { state.region = 'GM'; }
    state.scores = scores;
    state.monday = monday;
    state.evidence = evidence;
    state.competitors = competitors;
    state.v4 = v4;
    state.fwItems = frameworks.items || [];
    state.living = living;
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
