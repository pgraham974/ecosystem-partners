/* Joint Mack Living and Laurito Capital shell. Loads last and owns the navigation. */
(function () {
  'use strict';
  const COPY = GroupModel.COPY;
  const $ = window.$ || (s => document.querySelector(s));
  const esc = window.esc || (s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  const NOTES_KEY = 'gh-monday-notes';
  const CHECKLIST_KEY = 'gh-checklist-v1';
  const state = {mode:'board', section:'', region:'GM', boardPick:'', positionFile:null, shortlist:false, setId:'current', weights:null, message:'', monday:null, evidence:null, scores:null, routes:null, living:null, v4:null, fwItems:null, lha:null, frameworks:0, competitors:null, compRegion:'', ax:{status:'', type:'', brma:'', open:''}, recOpen:'', ml:{region:'GM', lease:'', status:'', sort:'deadline', focus:'', show:false}};
  let checklistDoc = null;
  let checklistMeta = {purpose:'', storageNote:''};
  let checklistMessage = '';
  const previous = viewMode;

  function asset(name) {
    const url = new URL(name, location.href);
    url.searchParams.set('v', 'board-20261117g');
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
    if (typeof value !== 'number' || !Number.isFinite(value)) return 'Not yet recorded';
    return new Intl.NumberFormat('en-GB', {style:'currency', currency:'GBP', minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2}).format(value);
  }
  function countsOf(rows, keyFn) {
    const map = new Map();
    for (const row of rows) {
      const key = keyFn(row) || 'Not yet recorded';
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()].map(([label, count]) => ({id: label, label, count})).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'en'));
  }
  function barChart(rows, attr, active) {
    if (!rows.length) return '<p class="bd-empty">Not yet recorded</p>';
    const max = Math.max(1, ...rows.map((row) => row.count));
    return '<div class="an-chart" role="group">' + rows.map((row) => '<button type="button" class="bd-bar' + (active === row.id ? ' on' : '') + '" data-' + attr + '="' + esc(row.id) + '"><span>' + esc(row.label) + '</span><i><b style="width:' + Math.max(4, row.count / max * 100) + '%"></b></i><em>' + row.count + '</em></button>').join('') + '</div>';
  }
  function valueChart(rows, attr, active) {
    if (!rows.length) return '<p class="bd-empty">Not yet recorded</p>';
    const max = Math.max(1, ...rows.map((row) => row.amount));
    return '<div class="an-chart an-values" role="group">' + rows.map((row) => '<button type="button" class="bd-bar' + (active === row.id ? ' on' : '') + '" data-' + attr + '="' + esc(row.id) + '"><span>' + esc(row.label) + '</span><i><b style="width:' + Math.max(4, row.amount / max * 100) + '%"></b></i><em>' + esc(row.text) + '</em></button>').join('') + '</div>';
  }
  function kpiRow(items) {
    return '<div class="kpis">' + items.map((item) => '<div class="kpi"><small>' + esc(item.label) + '</small><b>' + esc(item.value) + '</b></div>').join('') + '</div>';
  }
  function takeList(lines) {
    return '<ul class="an-takes">' + lines.filter(Boolean).map((line) => '<li>' + esc(line) + '</li>').join('') + '</ul>';
  }
  function fold(id, title, body, open) {
    return '<details class="ms-fold an-fold" id="' + id + '"' + (open ? ' open' : '') + '><summary>' + esc(title) + '</summary>' + body + '</details>';
  }
  function regionNow() {
    return BoardroomModel.regionById(state.region);
  }
  function competitorRegionName(id) {
    return {GM: 'Greater Manchester', BRS: 'Bristol', GLOS: 'Gloucestershire', National: 'England and Wales'}[id] || '';
  }
  function frameworksHere() {
    const region = regionNow();
    return (state.fwItems || []).filter((item) => {
      const list = item.regions || [];
      if (region.id === 'National') return list.includes('National');
      return list.includes(region.id);
    });
  }
  function ukWhen(iso) {
    if (!iso) return 'Not yet recorded';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const parts = String(iso).split('-');
    if (parts.length < 3) return iso;
    return Number(parts[2]) + ' ' + months[Number(parts[1]) - 1] + ' ' + parts[0];
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
    const top = state.mode === 'directory' ? 'market' : state.mode;
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
    header.innerHTML = '<div class="gh-brand"><a class="lc-brand" href="#board" id="gh-brand"><img src="' + esc(mark) + '" alt="Laurito Capital"></a><div class="gh-wordmark"><b>Mack Living</b></div></div><label class="gh-region">Area <select id="gh-region">' + BoardroomModel.REGIONS.map((row) => '<option value="' + row.id + '"' + (row.id === state.region ? ' selected' : '') + '>' + esc(row.label) + '</option>').join('') + '</select></label><a class="an-deals" href="https://pgrahamlc.github.io/ecosystem-deals/#entry/checklist" target="_blank" rel="noopener">Go / No-Go checklist</a><div id="status">Dated research, not credit approval</div>';
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
    const today = new Date().toISOString().slice(0, 10);
    const pack = MlCommercial.build({living: state.living, frameworks: {items: state.fwItems || []}, v4: state.v4, manchester: state.evidence && state.evidence.manchesterCas, today});
    const query = state.ml;
    const area = regionNow();
    const regionCards = MlCommercial.filterCards(pack.cards, {region: query.region, lease: '', status: ''});
    const summary = MlCommercial.summarise(regionCards, today);
    let visible = MlCommercial.sortCards(MlCommercial.filterCards(pack.cards, query), query.sort);
    if (query.focus) visible = visible.filter((row) => row.id === query.focus);
    const leases = countsOf(regionCards, (row) => row.leaseType);
    const statuses = countsOf(regionCards, (row) => row.bucket);
    const dated = regionCards.filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.deadline || ''));
    const times = dated.map((row) => Date.parse(row.deadline));
    const min = times.length ? Math.min(...times) : 0;
    const span = times.length ? Math.max(1, Math.max(...times) - min) : 1;
    const timeline = dated.length ? '<div class="an-chart">' + dated.slice().sort((a, b) => a.deadline.localeCompare(b.deadline)).map((row) => {
      const left = (Date.parse(row.deadline) - min) / span * 92;
      return '<button type="button" class="bd-row' + (query.focus === row.id ? ' on' : '') + '" data-ml-focus="' + esc(row.id) + '"><span>' + esc(row.name) + '</span><i><b style="left:' + left + '%;width:8%"></b></i></button>';
    }).join('') + '</div>' : '<p class="bd-empty">No firm deadline is recorded in this area.</p>';
    const nearest = summary.nearest ? ukWhen(summary.nearest) : 'Not yet recorded';
    const host = $('#mack-body');
    host.innerHTML = '<div class="ms-hero"><p class="lc-kicker">Mack Living</p><h1>Lease picture for ' + esc(area.label) + '</h1><p class="lc-purpose">Length, rent, voids and repairs, shown only where a source states them. The area follows the header.</p></div>'
      + '<section class="card" id="ms-analytics">' + kpiRow([
        {label: 'Open records', value: String(summary.live)},
        {label: 'Nearest deadline', value: nearest},
        {label: 'Stated units', value: summary.units == null ? 'Not yet recorded' : String(summary.units)},
        {label: 'Longest stated term', value: summary.longest && summary.longest !== MlCommercial.NOT_STATED ? summary.longest : 'Not yet recorded'}
      ])
      + takeList([
        summary.live + ' open records in ' + area.label + '. Open excludes historical, forthcoming, appointed and to confirm rows.',
        summary.nearest ? 'The nearest dated deadline from today is ' + nearest + '.' : 'No deadline on or after today is recorded in this area.',
        (function () { const unitCards = regionCards.filter((row) => row.unitsNumber); return unitCards.length === 1 ? 'The only stated unit count in this view is ' + unitCards[0].unitsNumber + ' on ' + unitCards[0].name + '.' : (unitCards.length ? 'Stated unit counts in this view sum to ' + summary.units + '.' : 'No unit count is written on the records in this area.'); })()
      ])
      + '<div class="an-grid"><article><h2>Lease type</h2>' + barChart(leases, 'ml-lease', query.lease) + '</article><article><h2>Status</h2>' + barChart(statuses, 'ml-status', query.status) + '</article></div>'
      + '<h2>Deadlines</h2>' + timeline
      + (query.lease || query.status || query.focus ? '<p class="an-note"><button type="button" class="btn sec" id="ml-clear">Clear chart filter</button></p>' : '')
      + '</section>'
      + fold('gh-deals', 'Show detail', '<div class="ctl"><label>Sort <select id="ml-sort"><option value="deadline"' + (query.sort === 'deadline' ? ' selected' : '') + '>Deadline</option><option value="term"' + (query.sort === 'term' ? ' selected' : '') + '>Term length</option></select></label><span class="foot">' + visible.length + ' of ' + regionCards.length + ' in this area</span></div>'
        + (visible.length ? visible.map((row) => '<article class="gh-deal" id="ml-' + esc(row.id || '') + '"><div class="gh-deal-h"><h3>' + esc(row.name) + '</h3><span class="tag">' + esc(row.bucket) + '</span></div><p>' + esc(row.leaseType) + ', ' + esc(row.region) + ', ' + esc(row.source) + '</p><p class="foot">' + esc(row.status) + '</p><dl class="gh-deal-grid">' + dealField('Length', row.length) + dealField('Start', row.start) + dealField('End', row.end) + dealField('Breaks or extensions', row.breaks) + dealField('Rent basis', row.rentBasis) + dealField('Rent level', row.rentLevel) + dealField('Voids', row.voids) + dealField('Repairs', row.repairs) + dealField('Buyer', row.buyer) + dealField('Units sought', row.units) + dealField('Deadline', row.deadlineLabel) + '</dl><p><b>Next step. </b>' + esc(row.next) + '</p><p>BiP ' + ((row.bip || []).length ? row.bip.map((id) => '<button type="button" class="btn sec" data-bip="' + esc(id) + '">' + esc(id) + '</button>').join(' ') : esc(MlCommercial.NOT_STATED)) + '</p>' + (row.evidence ? '<details><summary>Source wording</summary><p>' + esc(row.evidence) + '</p></details>' : '') + '</article>').join('') : '<p class="bd-empty">No lease record matches this filter.</p>'), query.show)
      + fold('gh-agenda', 'Show Monday discussion', '<p>' + esc(state.monday.meeting.purpose) + '</p><ol>' + state.monday.agenda.map((item) => '<li><b>' + esc(item.item) + '</b><p>' + esc(item.note) + '</p></li>').join('') + '</ol><p class="foot">' + esc(state.monday.notesHelp) + '</p><label class="gh-notes">Shared file notes<textarea readonly>' + esc(state.monday.notes || '') + '</textarea></label><label class="gh-notes">' + esc(COPY.notesLocal) + '<textarea id="gh-local-notes">' + esc(state.localNotes) + '</textarea></label>', false);
    host.querySelectorAll('[data-bip]').forEach((button) => button.onclick = () => openBip(button.dataset.bip));
    host.querySelectorAll('[data-ml-lease]').forEach((button) => button.onclick = () => {
      state.ml.lease = state.ml.lease === button.dataset.mlLease ? '' : button.dataset.mlLease;
      state.ml.focus = '';
      state.ml.show = true;
      renderMack();
    });
    host.querySelectorAll('[data-ml-status]').forEach((button) => button.onclick = () => {
      state.ml.status = state.ml.status === button.dataset.mlStatus ? '' : button.dataset.mlStatus;
      state.ml.focus = '';
      state.ml.show = true;
      renderMack();
    });
    host.querySelectorAll('[data-ml-focus]').forEach((button) => button.onclick = () => {
      state.ml.focus = state.ml.focus === button.dataset.mlFocus ? '' : button.dataset.mlFocus;
      state.ml.show = true;
      renderMack();
    });
    const clearer = $('#ml-clear');
    if (clearer) clearer.onclick = () => { state.ml.lease = ''; state.ml.status = ''; state.ml.focus = ''; state.ml.show = false; renderMack(); };
    const sort = $('#ml-sort');
    if (sort) sort.onchange = (event) => { state.ml.sort = event.target.value; state.ml.show = true; renderMack(); };
    const box = $('#gh-local-notes');
    if (box) box.oninput = () => { state.localNotes = box.value; try { localStorage.setItem(NOTES_KEY, box.value); } catch (error) {} };
    if (query.show) { const node = document.getElementById('gh-deals'); if (node) node.open = true; }
  }
  function lhaTable(rows) {
    return '<div class="scroll"><table id="lha-table"><thead><tr><th class="l">BRMA</th><th>Shared</th><th>1 bed</th><th>2 bed</th><th>3 bed</th><th>4 bed</th></tr></thead><tbody>'
      + rows.map((row) => '<tr><td class="l">' + esc(row.name) + '<small>' + esc(row.country) + '</small></td><td>' + money(row.SAR) + '</td><td>' + money(row['1']) + '</td><td>' + money(row['2']) + '</td><td>' + money(row['3']) + '</td><td>' + money(row['4']) + '</td></tr>').join('')
      + '</tbody></table></div>';
  }
  function renderAnalysis() {
    const area = regionNow();
    const compName = competitorRegionName(area.id);
    const frameworks = frameworksHere();
    const statuses = countsOf(frameworks, (item) => item.status_n || 'Not yet recorded');
    const allComps = (state.competitors && state.competitors.competitors) || [];
    const comps = GroupModel.filterCompetitors(allComps, compName);
    const types = countsOf(comps, (row) => row.type);
    const withBip = comps.filter((row) => (row.bip || []).length).length;
    const benches = (state.evidence.benchmarks || []).filter((row) => row.regionId === area.id);
    const missing = benches.filter((row) => row.value === 'to be supplied');
    const lhaNames = BoardroomModel.LHA_NAMES[area.id] || [];
    const lhaRows = lhaNames.map((label) => (state.lha.rates || []).find((row) => row.name === label && row.country === 'England')).filter(Boolean);
    const lhaBars = lhaRows.filter((row) => typeof row['2'] === 'number').map((row) => ({id: row.name, label: row.name, amount: row['2'], text: money(row['2'])}));
    const open = state.ax.open || (['lha', 'benchmarks', 'competitors'].includes(state.section) ? state.section : '');
    const fwShown = state.ax.status ? frameworks.filter((item) => (item.status_n || 'Not yet recorded') === state.ax.status) : frameworks;
    const compShown = state.ax.type ? comps.filter((row) => row.type === state.ax.type) : comps;
    const lhaShown = state.ax.brma ? lhaRows.filter((row) => row.name === state.ax.brma) : lhaRows;
    const topStatus = statuses[0];
    const bip = state.evidence.bip;
    let benchLine = !benches.length ? 'No commercial benchmark is recorded for this area.' : (missing.length ? missing.map((row) => row.topic).join(' and ') + (missing.length > 1 ? ' are still to be supplied.' : ' is still to be supplied.') : 'Every recorded benchmark in this area has a cited figure.');
    if (area.id === 'BRS' && state.ons && state.ons.areas && state.ons.areas['Bristol, City of']) benchLine += ' The council rent table and the ONS September 2026 Bristol rents are different series, and the figures do not match.';
    const host = $('#analysis-body');
    host.innerHTML = '<div class="ms-hero"><p class="lc-kicker">Analysis Dashboard</p><h1>Evidence for ' + esc(area.label) + '</h1><p class="lc-purpose">Framework status, competitors and the allowance spread for this area. Lease cards stay on Mack Living. Rent gap stays on the boardroom.</p></div>'
      + '<section class="card" id="ms-analytics">' + kpiRow([
        {label: 'Framework records', value: String(frameworks.length)},
        {label: 'Competitors', value: String(comps.length)},
        {label: 'Competitors with a BiP award', value: String(withBip)},
        {label: 'BiP file built', value: bip && bip.built ? ukWhen(bip.built) : 'Not yet recorded'}
      ])
      + takeList([
        topStatus ? topStatus.count + ' of ' + frameworks.length + ' framework records that list ' + area.label + ' are ' + topStatus.label + '.' : 'No framework record lists ' + area.label + '.',
        comps.length + ' competitors are recorded for ' + (compName || area.label) + '. ' + (withBip === 1 ? '1 of them links a BiP award.' : withBip + ' of them link a BiP award.'),
        benchLine
      ])
      + '<div class="an-grid"><article><h2>Framework status</h2>' + barChart(statuses, 'an-status', state.ax.status) + '</article><article><h2>Competitor type</h2>' + barChart(types, 'an-type', state.ax.type) + '</article></div>'
      + '<h2>2 bed LHA in this area</h2>' + valueChart(lhaBars, 'an-brma', state.ax.brma)
      + '<p class="foot">DWP Universal Credit 2026/27 monthly rates. The boardroom shows one reference row. This chart is the 2 bed rate for each BRMA named for the area.</p>'
      + (bip ? '<p class="foot">BiP awards and spend stay on Framework records. Last build ' + esc(bip.built) + '.</p><button type="button" class="btn sec" data-gh-go="records/frameworks">' + esc(COPY.bipOpen) + '</button>' : '')
      + (state.ax.status || state.ax.type || state.ax.brma ? '<p class="an-note"><button type="button" class="btn sec" id="an-clear">Clear chart filter</button></p>' : '')
      + '</section>'
      + fold('gh-frameworks', 'Show detail', '<p class="foot">' + fwShown.length + ' framework records. File ' + esc(state.frameworksUpdated) + '.</p><div class="scroll"><table><thead><tr><th class="l">Framework</th><th class="l">Status</th><th class="l">Route</th></tr></thead><tbody>'
        + fwShown.map((item) => '<tr><td class="l">' + shown(item.name) + '</td><td class="l">' + shown(item.status_n || 'Not yet recorded') + '</td><td class="l">' + shown(item.investor_route || 'Not yet recorded') + '</td></tr>').join('')
        + '</tbody></table></div><p><button type="button" class="btn sec" data-gh-go="records/frameworks">Open the full framework records</button></p>', open === 'frameworks' || !!state.ax.status)
      + fold('gh-competitors', 'Show competitor detail', '<p class="foot">' + esc(COPY.competitorsIntro) + '</p>' + (compShown.length ? compShown.map((row) => {
        const awards = (row.bip || []).map((id) => '<button type="button" class="btn sec" data-bip="' + esc(id) + '">' + esc(id) + '</button>').join(' ');
        const opps = (row.competesOn || []).map((link) => link.id ? '<b>' + esc(link.id) + '</b> ' + esc(link.name) : esc(link.name) + ' <span class="foot">' + esc(COPY.noCurrentOpp) + '</span>').join('<br>');
        return '<article class="gh-comp"><h3>' + esc(row.name) + ' <span class="foot">' + esc(row.id) + '</span></h3><p>' + esc(row.entity || 'Not yet recorded') + '</p><p>' + esc(row.type) + '</p><p>BiP awards ' + (awards || 'Not yet recorded') + '</p><p>Competes on<br>' + (opps || 'Not yet recorded') + '</p><details><summary>Note</summary><p>' + shownText(row.note) + (row.also ? '</p><p class="foot">' + shownText(row.also) : '') + '</p></details></article>';
      }).join('') : '<p class="bd-empty">No competitor is recorded for this area.</p>'), open === 'competitors' || !!state.ax.type)
      + fold('gh-lha', 'Show LHA detail', '<p>' + esc(state.evidence.lha.guidance) + '</p>' + (lhaShown.length ? lhaTable(lhaShown) : '<p class="bd-empty">Not yet recorded</p>') + '<p><a href="' + esc(state.evidence.lha.publicationUrl) + '" target="_blank" rel="noopener">GOV.UK publication</a></p>', open === 'lha' || !!state.ax.brma)
      + fold('gh-benchmarks', 'Show benchmark detail', '<p>' + esc(COPY.benchmarksIntro) + '</p>' + (benches.length ? '<div class="scroll"><table><thead><tr><th class="l">Benchmark</th><th class="l">Figure</th><th class="l">Source</th><th>Date</th></tr></thead><tbody>'
        + benches.map((row) => '<tr><td class="l">' + esc(row.topic) + '</td><td class="l">' + esc(row.value) + '</td><td class="l">' + (row.sourceUrl ? '<a href="' + esc(row.sourceUrl) + '" target="_blank" rel="noopener">' + esc(row.sourceTitle || row.sourceUrl) + '</a>' : 'Not yet recorded') + '</td><td>' + esc(row.observedAt || 'Not yet recorded') + '</td></tr><tr><td class="l foot" colspan="4">' + esc(row.note || '') + '</td></tr>').join('')
        + '</tbody></table></div>' : '<p class="bd-empty">Not yet recorded</p>'), open === 'benchmarks');
    host.querySelectorAll('[data-gh-go]').forEach((button) => button.onclick = () => viewMode(button.dataset.ghGo));
    host.querySelectorAll('[data-bip]').forEach((button) => button.onclick = () => openBip(button.dataset.bip));
    host.querySelectorAll('[data-an-status]').forEach((button) => button.onclick = () => {
      state.ax.status = state.ax.status === button.dataset.anStatus ? '' : button.dataset.anStatus;
      state.ax.open = state.ax.status ? 'frameworks' : '';
      renderAnalysis();
    });
    host.querySelectorAll('[data-an-type]').forEach((button) => button.onclick = () => {
      state.ax.type = state.ax.type === button.dataset.anType ? '' : button.dataset.anType;
      state.ax.open = state.ax.type ? 'competitors' : '';
      renderAnalysis();
    });
    host.querySelectorAll('[data-an-brma]').forEach((button) => button.onclick = () => {
      state.ax.brma = state.ax.brma === button.dataset.anBrma ? '' : button.dataset.anBrma;
      state.ax.open = state.ax.brma ? 'lha' : '';
      renderAnalysis();
    });
    const clearer = $('#an-clear');
    if (clearer) clearer.onclick = () => { state.ax = {status:'', type:'', brma:'', open:''}; renderAnalysis(); };
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
    const anchor = host.querySelector('#ms-analytics') || hero;
    anchor.insertAdjacentHTML('beforeend', '<div id="gh-market-extra">' + (state.shortlist ? '<p class="gh-proposed">' + esc(COPY.shortlist) + (host.querySelectorAll('#ms-matrix tbody tr').length ? '' : ' ' + esc(COPY.shortlistEmpty)) + '</p>' : '') + '<p class="foot"><b>' + esc(COPY.weightsInUse) + '.</b> ' + esc(setNote) + '</p>' + (bip ? '<p class="foot">BiP awards stay on Framework records. Last build ' + esc(bip.built) + '.</p><button type="button" class="btn sec" data-gh-go="records/frameworks">' + esc(COPY.bipOpen) + '</button>' : '') + '</div>');
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
    if (window.PartnersHub && PartnersHub.state) PartnersHub.state.city = region.city || '';
    state.flowSynced = false;
  }
  function setRegion(id) {
    state.region = id;
    state.boardPick = '';
    state.ax = {status:'', type:'', brma:'', open:''};
    state.ml.focus = '';
    state.ml.lease = '';
    state.ml.status = '';
    state.ml.show = false;
    state.recOpen = '';
    try { localStorage.setItem('gh-region', id); } catch (error) {}
    applyRegion();
    if (window.MarketScreen) {
      MarketScreen.state.testKey = '';
      MarketScreen.state.detailOpen = false;
      if (!state.shortlist) MarketScreen.state.status = '';
    }
    const header = document.getElementById('gh-region');
    if (header) header.value = id;
    if (state.mode === 'board') renderBoard();
    else if (state.mode === 'mack') renderMack();
    else if (state.mode === 'analysis') renderAnalysis();
    else if (state.mode === 'market' && window.MarketScreen) MarketScreen.render();
    else if (state.mode === 'records') viewMode('records/' + (state.section || 'position'));
    else if (state.mode === 'directory') viewMode(window.PartnersHub && PartnersHub.state.top ? 'market/top' : 'market/directory');
  }
  function tuck(root, selector, marker) {
    const node = root && root.querySelector(selector);
    if (!node || root.querySelector('[data-tuck="' + marker + '"]')) return false;
    const details = document.createElement('details');
    details.className = 'ms-fold';
    details.dataset.tuck = marker;
    details.innerHTML = '<summary>Show detail</summary>';
    node.parentNode.insertBefore(details, node);
    details.appendChild(node);
    return true;
  }
  function chartInto(host, rows, onPick) {
    if (!host || host.querySelector('.an-chart') || !rows.length) return;
    const box = document.createElement('div');
    box.className = 'an-chart';
    box.innerHTML = barChart(rows, 'tuck', '');
    host.insertBefore(box, host.firstChild);
    box.querySelectorAll('[data-tuck]').forEach((button) => button.onclick = () => onPick(button.dataset.tuck));
  }
  function tuckFrameworks() {
    const root = document.getElementById('fw_body');
    if (!root) return;
    const fw = document.getElementById('fw_reg');
    if (fw && typeof FWF !== 'undefined' && fw.value !== (FWF.reg || '')) fw.value = FWF.reg || '';
    const pieces = ['[data-v4-fw]', '[data-v4-fw2]', '.opgrid'].map((selector) => root.querySelector(selector));
    const lease = root.querySelector('#fwlt');
    if (lease) pieces.push(lease.closest('.card'));
    const loose = pieces.filter((node) => node && !node.closest('details'));
    if (!loose.length) return;
    let details = root.querySelector('details[data-tuck="fw"]');
    if (!details) {
      details = document.createElement('details');
      details.className = 'ms-fold';
      details.dataset.tuck = 'fw';
      details.innerHTML = '<summary>Show detail</summary>';
      const anchor = root.querySelector('#fw_detail');
      if (anchor && !anchor.closest('details')) root.insertBefore(details, anchor);
      else root.appendChild(details);
    }
    loose.forEach((node) => details.appendChild(node));
  }
  function tuckFlow() {
    const root = document.getElementById('flow_body');
    if (!root || !root.querySelector('#pf-table')) return;
    const select = root.querySelector('#pf-region');
    const want = {GM: 'Greater Manchester', BRS: 'Bristol', GLOS: 'Gloucestershire', National: ''}[state.region] || '';
    if (!state.flowSynced && select && [...select.options].some((option) => option.value === want) && select.value !== want) {
      state.flowSynced = true;
      select.value = want;
      select.dispatchEvent(new Event('change'));
      return;
    }
    state.flowSynced = true;
    if (root.querySelector('[data-tuck="flow"]')) return;
    const counts = new Map();
    root.querySelectorAll('#pf-table tbody tr').forEach((row) => {
      const badge = row.querySelector('.tag');
      const label = badge ? badge.textContent : 'Not yet recorded';
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    const rows = [...counts.entries()].map(([label, count]) => ({id: label, label, count})).sort((a, b) => b.count - a.count);
    const intro = root.querySelector('.pf-intro');
    if (intro) chartInto(intro, rows, (label) => {
      const map = {'Gate failed': 'failed', 'Demand paused': 'paused', 'Some demand paused': 'paused', 'Review overdue': 'review'};
      const filter = root.querySelector('#pf-filter');
      if (!filter) return;
      filter.value = map[label] || '';
      filter.dispatchEvent(new Event('change'));
    });
    tuck(root, '#pf-table', 'flow');
  }
  function tuckWho() {
    const root = document.getElementById('who_body');
    if (!root || !root.querySelector('#who-table') || root.querySelector('[data-tuck="who"]')) return;
    const card = root.querySelector('.card');
    if (card) {
      const counts = [...root.querySelectorAll('.kpi')].map((kpi) => ({id: kpi.querySelector('small') ? kpi.querySelector('small').textContent : '', label: kpi.querySelector('small') ? kpi.querySelector('small').textContent : '', count: Number(kpi.querySelector('b') && kpi.querySelector('b').textContent) || 0}));
      chartInto(card, counts.filter((row) => row.count), (label) => {
        const button = [...root.querySelectorAll('[data-seg]')].find((item) => item.textContent.indexOf(label.split(' ')[0]) === 0 || item.textContent.indexOf(label) !== -1);
        if (button) button.click();
      });
    }
    tuck(root, '#who-table', 'who');
  }
  function tuckSheets() {
    const root = document.getElementById('sheets_body');
    if (!root || !root.querySelector('#sheets_table') || !window.SHEETBOOKS) return;
    const book = window.SHEETBOOKS.books[Number(document.querySelector('#sheets_book') && document.querySelector('#sheets_book').value) || 0];
    if (book && !root.querySelector('.an-chart')) {
      const rows = book.sheets.map((sheet) => ({id: sheet.name, label: sheet.name, count: (sheet.rows || []).length}));
      const card = root.querySelector('.card');
      chartInto(card || root, rows, (name) => {
        const sheet = document.querySelector('#sheets_sheet');
        if (!sheet) return;
        const option = [...sheet.options].find((item) => item.textContent === name);
        if (!option) return;
        sheet.value = option.value;
        sheet.dispatchEvent(new Event('change'));
      });
    }
    tuck(root, '#sheets_table', 'sheets');
  }
  function watchSheets() {
    ['fw_body', 'flow_body', 'who_body', 'sheets_body'].forEach((id) => {
      const node = document.getElementById(id);
      if (!node || node.dataset.watch) return;
      node.dataset.watch = '1';
      new MutationObserver(() => {
        if (id === 'fw_body') tuckFrameworks();
        if (id === 'flow_body') tuckFlow();
        if (id === 'who_body') tuckWho();
        if (id === 'sheets_body') tuckSheets();
      }).observe(node, {childList: true});
    });
  }
  function togglePresent() {
    const on = document.body.classList.toggle('bd-present');
    if (on && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) return;
    document.body.classList.remove('bd-present');
    const button = document.getElementById('bd-present');
    if (button) button.textContent = 'Present';
  });
  async function refreshAuctions() {
    if (!window.AuctionCounts) return;
    try {
      const response = await fetch(AuctionCounts.LIVE, {cache: 'no-store'});
      if (!response.ok) return;
      const file = await response.json();
      const today = new Date().toISOString().slice(0, 10);
      state.auctions = AuctionCounts.pack(file, today, 'live');
      if (state.mode === 'board') renderBoard();
    } catch (error) {}
  }
  function renderBoard() {
    document.body.classList.add('bd-on');
    const host = document.getElementById('board-body');
    const built = BoardroomModel.build({today: new Date().toISOString().slice(0, 10), region: state.region, frameworks: {items: state.fwItems || []}, v4: state.v4, lha: state.lha, position: positionData(), ons: state.ons, auctions: state.auctions});
    BoardroomUI.render(host, built, {selected: state.boardPick, onRegion: setRegion, onPresent: togglePresent, onGo: (hash) => { if (hash === 'records/position') state.recOpen = 'position'; viewMode(hash); }, onSelect: (id) => { state.boardPick = id; renderBoard(); }});
  }
  function openBoard() {
    state.mode = 'board';
    state.section = '';
    show('board_view');
    renderBoard();
    paint();
    setHash('board');
  }
  function renderRecords() {
    const area = regionNow();
    const pos = positionData()[area.id] || {};
    const deals = pos.dealsExecuted == null ? 'Not yet recorded' : String(pos.dealsExecuted);
    const held = pos.propertiesHeld == null ? 'Not yet recorded' : String(pos.propertiesHeld);
    const datasets = (state.evidence && state.evidence.datasets) || [];
    const dated = datasets.filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.updated || ''));
    const times = dated.map((row) => Date.parse(row.updated));
    const min = times.length ? Math.min(...times) : 0;
    const span = times.length ? Math.max(1, Math.max(...times) - min) : 1;
    const timeline = dated.length ? '<div class="an-chart">' + dated.map((row) => {
      const left = (Date.parse(row.updated) - min) / span * 92;
      return '<button type="button" class="bd-row' + (state.recOpen === row.file ? ' on' : '') + '" data-rec-file="' + esc(row.file) + '"><span>' + esc(row.label) + '</span><i><b style="left:' + left + '%;width:8%"></b></i></button>';
    }).join('') + '</div>' : '<p class="bd-empty">Not yet recorded</p>';
    const counts = [
      {id: 'frameworks', label: 'Framework records', count: (state.fwItems || []).length},
      {id: 'competitors', label: 'Competitors', count: ((state.competitors && state.competitors.competitors) || []).length},
      {id: 'routes', label: 'Mack routes', count: (state.routes || []).length},
      {id: 'datasets', label: 'Dataset files', count: datasets.length}
    ];
    const newest = dated.slice().sort((a, b) => b.updated.localeCompare(a.updated))[0];
    const host = document.getElementById('records-body');
    host.innerHTML = '<div class="an-start"><p class="bd-kicker">Records</p><h1>Data appendix for ' + esc(area.label) + '</h1><p>Catalogue dates and the position sheet. Raw framework, opportunity and workbook rows open from a chart or a button.</p></div>'
      + '<section class="card">' + kpiRow([
        {label: 'Deals executed', value: deals},
        {label: 'Properties held', value: held},
        {label: 'Dataset files', value: String(datasets.length)},
        {label: 'Newest file date', value: newest ? ukWhen(newest.updated) : 'Not yet recorded'}
      ])
      + takeList([
        'Deals executed and properties held for ' + area.label + ' are ' + (pos.dealsExecuted == null && pos.propertiesHeld == null ? 'not yet recorded. Enter them under Show position sheet.' : 'taken from the position sheet in this browser.'),
        datasets.length + ' dataset files are catalogued. ' + (newest ? 'The newest date in the catalogue is ' + ukWhen(newest.updated) + ' on ' + newest.label + '.' : 'No catalogue date is recorded.'),
        'Framework records, opportunity records and the workbook are the raw tables. They stay off this page until you open them.'
      ])
      + '<h2>How many records are on file</h2>' + barChart(counts, 'rec-kind', '')
      + '<h2>When each dataset was last updated</h2>' + timeline
      + '</section>'
      + fold('gh-datasets', 'Show detail', '<ul class="gh-dates">' + datasets.map((row) => '<li id="rec-' + esc(row.file) + '"><b>' + esc(row.label) + '</b> ' + esc(row.updated) + (row.also ? ' <span class="foot">' + esc(row.also) + '</span>' : '') + ' <span class="foot">' + esc(row.file) + '</span></li>').join('') + '</ul>', state.recOpen === 'datasets' || datasets.some((row) => row.file === state.recOpen))
      + fold('gh-position', 'Show position sheet', '<div id="pos-slot"></div>', state.recOpen === 'position');
    host.querySelectorAll('[data-rec-kind]').forEach((button) => button.onclick = () => {
      const kind = button.dataset.recKind;
      if (kind === 'datasets') { state.recOpen = 'datasets'; renderRecords(); return; }
      if (kind === 'frameworks') viewMode('records/frameworks');
      else if (kind === 'competitors') viewMode('analysis/competitors');
      else if (kind === 'routes') viewMode('mack');
    });
    host.querySelectorAll('[data-rec-file]').forEach((button) => button.onclick = () => {
      state.recOpen = button.dataset.recFile;
      renderRecords();
      const node = document.getElementById('rec-' + button.dataset.recFile);
      if (node) node.scrollIntoView({block:'center'});
    });
    BoardroomUI.positionForm(document.getElementById('pos-slot'), area.id, positionData(), (saved) => {
      if (!saved) { viewMode('board'); return; }
      const all = positionData();
      all[area.id] = saved;
      try { localStorage.setItem('gh-position', JSON.stringify(all)); } catch (error) {}
      state.recOpen = 'position';
      renderRecords();
    });
  }
  function openPosition() {
    leaveBoard();
    state.mode = 'records';
    state.section = 'position';
    show('records_view');
    renderRecords();
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
    const [scores, monday, evidence, living, lha, frameworks, competitors, v4, positionFile, auctions, ons] = await Promise.all([
      loadJson('scoring-weights.json'), loadJson('mack-monday.json'), loadJson('analysis-evidence.json'), loadJson('mack-living.json'), loadJson('market-lha.json'), loadJson('frameworks.json'), loadJson('competitors.json'), loadJson('v4-enrich.json'), loadJson('portfolio-position.json'), loadJson('auction-targets.json'),
      fetch('https://raw.githubusercontent.com/pgrahamLC/ecosystem-deals/main/rents.json', {cache: 'no-store'}).then((response) => response.ok ? response.json() : null).catch(() => null)
    ]);
    state.positionFile = positionFile;
    state.auctions = auctions;
    refreshAuctions();
    state.ons = ons;
    try { state.region = localStorage.getItem('gh-region') || 'GM'; } catch (error) { state.region = 'GM'; }
    applyRegion();
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
  if (typeof sheetsStart === 'function') {
    const oldSheets = sheetsStart;
    sheetsStart = async function () {
      await oldSheets();
      tuckSheets();
    };
  }
  watchSheets();
  window.GroupHub = {ownsNav: true, ready, paint, get state() { return state; }};
})();
