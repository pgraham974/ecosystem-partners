/* Ecosystem Partners shell. One directory, one opportunity surface, frameworks, workbook. */
(function () {
  'use strict';
  const $ = window.$ || (s => document.querySelector(s));
  const esc = window.esc || (s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  const state = {segment:'all', q:'', city:'', top:false, selected:'', oppMode:'records', entities:null, flow:null, frameworks:null, files:null, ready:null};
  const previous = viewMode;

  function asset(name) {
    const url = new URL(name, location.href);
    url.searchParams.set('v', 'partners-mece');
    return url.href;
  }
  async function loadJson(name) {
    const response = await fetch(asset(name), {cache:'no-store'});
    if (!response.ok) throw new Error(name + ' failed to load (' + response.status + ')');
    return response.json();
  }
  function ensure() {
    if (!state.ready) state.ready = (async () => {
      const [partners, rp, operators] = await Promise.all([loadJson('partners.json'), loadJson('rp_charities.json'), loadJson('operators.json')]);
      state.files = {partners, rp, operators};
      state.entities = PartnersMece.classify({partners, rp, operators}, {today: sfToday(), evaluate: (partner, options) => MarketScore.evaluate(partner, options)});
      if (window.partnerFlow) state.flow = await partnerFlow.load();
      if (typeof FW === 'undefined' || !FW) FW = await loadJson('frameworks.json');
      state.frameworks = (FW && FW.items) || [];
      state.sheets = typeof SHEETBOOKS === 'undefined' ? null : SHEETBOOKS;
      const status = $('#status');
      if (status) status.textContent = 'Accounts file ' + (partners.updated || 'date not recorded') + ' · RP research ' + (rp.updated || 'date not recorded') + ' · workbook imported ' + ((state.sheets && state.sheets.importedAt) || '2026-10-20');
      return state;
    })().catch((error) => { state.ready = null; throw error; });
    return state.ready;
  }
  function context() {
    return {entities: state.entities || [], opportunities: state.flow ? state.flow.opportunities : [], frameworks: state.frameworks || [], sheets: state.sheets || (typeof SHEETBOOKS === 'undefined' ? null : SHEETBOOKS)};
  }
  function hideAll() {
    document.querySelectorAll('[id$="_view"]').forEach((view) => view.classList.add('hidden'));
  }
  function setHash(hash) {
    if (window.GroupHub && window.GroupHub.ownsNav) return;
    const url = new URL(location.href);
    url.hash = hash;
    history.replaceState(null, '', url);
  }
  function safeUrl(value) {
    try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : ''; }
    catch (error) { return ''; }
  }
  function shellNav(active) {
    if (window.GroupHub && window.GroupHub.ownsNav) { window.GroupHub.paint(); return; }
    const nav = $('#nav2');
    if (!nav) return;
    const items = [['who','Counterparties'],['opportunities','Opportunities'],['frameworks','Frameworks'],['workbook','Workbook']];
    nav.innerHTML = '<div class="mainnav">' + items.map(([id, label]) => '<button type="button" class="mainb' + (active === id ? ' on' : '') + '" data-mece="' + id + '">' + label + '</button>').join('') + '<a class="mainb ms-analysis" href="https://pgraham974.github.io/ecosystem-deals/">Analysis dashboard ↗</a></div><div id="mecebar"></div>';
    nav.querySelectorAll('[data-mece]').forEach((button) => button.onclick = () => {
      if (button.dataset.mece === 'who') { state.oppMode = 'records'; state.top = false; viewMode('who'); }
      else if (button.dataset.mece === 'opportunities') { state.oppMode = 'records'; if (window.partnerFlow) partnerFlow.clear(); viewMode('flow'); }
      else if (button.dataset.mece === 'frameworks') viewMode('frameworks');
      else viewMode('sheets');
    });
    const bar = $('#mecebar');
    if (!bar) return;
    if (active === 'who') {
      bar.innerHTML = '<button type="button" class="segb' + (state.top ? '' : ' on') + '" data-mode="directory">Directory</button><button type="button" class="segb' + (state.top ? ' on' : '') + '" data-mode="top">Top 10</button><span class="foot">Top 10 sorts this segment. It is not a second list.</span>';
      bar.querySelector('[data-mode="directory"]').onclick = () => { state.top = false; viewMode('who'); };
      bar.querySelector('[data-mode="top"]').onclick = () => { state.top = true; if (state.segment === 'all') state.segment = 'rp'; viewMode('who'); };
    } else if (active === 'opportunities') {
      const modes = [['records','Records'],['rent','Rent reference'],['return','Return check']];
      bar.innerHTML = modes.map(([id, label]) => '<button type="button" class="segb' + (state.oppMode === id ? ' on' : '') + '" data-mode="' + id + '">' + label + '</button>').join('') + '<span class="foot">Rent reference and the return check sit on Opportunities. Blank inputs are not a yield.</span>';
      bar.querySelector('[data-mode="records"]').onclick = () => { state.oppMode = 'records'; viewMode('flow'); };
      bar.querySelector('[data-mode="rent"]').onclick = () => { state.oppMode = 'rent'; viewMode('lha'); };
      bar.querySelector('[data-mode="return"]').onclick = () => { state.oppMode = 'return'; viewMode('return'); };
    } else if (active === 'frameworks') bar.innerHTML = '<span class="foot">Frameworks own how accommodation is bought or leased. Counterparties and opportunity records are not repeated here.</span>';
    else bar.innerHTML = '<span class="foot">Workbook owns the imported sheets. Imported 2026-10-20. v4 build 2026-11-03. Core scores are not recalculated.</span>';
  }
  function routeOf(mode) {
    const raw = String(mode || 'who');
    const parts = raw.split('/').map((part) => { try { return decodeURIComponent(part); } catch (error) { return part; } });
    const head = parts[0] || 'who';
    const rest = parts.slice(1).join('/');
    if (head === 'flow' || head === 'opportunities') return {view:'opportunities', pass: head === 'flow' ? raw : (rest ? 'flow/' + rest : 'flow'), mode:'records'};
    if (head === 'lha' || head === 'rent') return {view:'opportunities', mode:'rent'};
    if (head === 'return') return {view:'opportunities', mode:'return'};
    if (head === 'frameworks') return {view:'frameworks'};
    if (head === 'sheets' || head === 'workbook') return {view:'workbook'};
    if (head === 'operators') return {view:'who', segment:'operator'};
    if (head === 'rp') return {view:'who', segment:'rp'};
    if (head === 'other') return {view:'who', segment:'other'};
    const segment = parts.find((part) => part === 'rp' || part === 'operator' || part === 'other') || '';
    return {view:'who', segment, top: parts.includes('top')};
  }
  function screenCell(entity) {
    if (entity.segment === 'operator' && entity.size) return 'Size ' + entity.size.result;
    if (entity.screen) return entity.screen.status;
    if (entity.size) return 'Size ' + entity.size.result;
    return 'No accounts screen';
  }
  function turnoverCell(entity) {
    const pair = entity.turnover;
    if (pair.accounts == null && pair.operator == null) return 'Not disclosed';
    if (pair.accounts != null && pair.operator != null && pair.accounts !== pair.operator) return PartnersMece.money(pair.accounts) + ' / ' + PartnersMece.money(pair.operator);
    return PartnersMece.money(pair.accounts != null ? pair.accounts : pair.operator);
  }
  function detail(entity) {
    const rows = PartnersMece.facts(entity).map((row) => '<dt>' + esc(row.label) + '</dt><dd>' + esc(row.value) + '</dd>').join('');
    const links = [];
    if (entity.rp && entity.rp.sources) for (const source of entity.rp.sources) {
      const href = safeUrl(source.url);
      if (href) links.push('<li><a href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(source.title || href) + '</a></li>');
    }
    if (entity.partner && entity.partner.no) links.push('<li><a href="https://find-and-update.company-information.service.gov.uk/company/' + esc(entity.partner.no) + '" target="_blank" rel="noopener">Companies House ' + esc(entity.partner.no) + '</a></li>');
    return '<div class="card" id="who-detail"><h2>' + esc(entity.name) + '</h2><p class="foot">' + esc(entity.segmentLabel) + '. ' + esc(PartnersMece.DISCLAIMER) + '</p><dl class="kv">' + rows + '</dl>' + (links.length ? '<ol>' + links.join('') + '</ol>' : '') + (entity.screen ? '<p class="foot">The accounts screen is the existing eight-test filing check. It is not a core investibility score. Unknown tests are not a pass and are not filled in.</p>' : '') + '</div>';
  }
  async function renderWho() {
    const host = $('#who_body');
    shellNav('who');
    if (!state.entities) {
      host.innerHTML = '<p role="status">Loading counterparties from this site...</p>';
      try { await ensure(); } catch (error) { host.innerHTML = '<div class="card"><h2>Counterparties unavailable</h2><p>' + esc(error.message) + '</p></div>'; return; }
    }
    const counts = Object.fromEntries(PartnersMece.SEGMENTS.map((segment) => [segment, state.entities.filter((entity) => entity.segment === segment).length]));
    const rows = PartnersMece.filterEntities(state.entities, state);
    const segments = [['all','All (' + state.entities.length + ')'], ['rp','Registered providers and charities (' + counts.rp + ')'], ['operator','Commercial operators (' + counts.operator + ')'], ['other','Other (' + counts.other + ')']];
    const cities = [...new Set(state.entities.flatMap((entity) => entity.cities))].sort((a, b) => a.localeCompare(b));
    const selected = state.entities.find((entity) => entity.id === state.selected);
    host.innerHTML = '<div class="ms-hero"><p class="lc-kicker">Market Screen</p><h1>Who might take the property?</h1><p class="lc-purpose">One directory for Mack Living and Laurito Capital. Registered providers and charities, commercial operators, and everyone else each appear once.</p></div>'
      + '<div class="card"><p>' + esc(PartnersMece.DISCLAIMER) + ' Accounts file ' + esc(state.files.partners.updated || '') + '. RP research ' + esc(state.files.rp.updated || '') + '. Operator file ' + esc(state.files.operators.updated || '') + '.</p><p class="foot">' + esc(PartnersMece.rankRule(state.segment === 'all' && state.top ? 'rp' : state.segment)) + '</p><div class="kpis"><div class="kpi"><small>Registered providers and charities</small><b>' + counts.rp + '</b></div><div class="kpi"><small>Commercial operators</small><b>' + counts.operator + '</b></div><div class="kpi"><small>Other</small><b>' + counts.other + '</b></div></div>'
      + '<div class="ctl"><span class="seg">' + segments.map(([id, label]) => '<button type="button" class="segb' + (state.segment === id ? ' on' : '') + '" data-seg="' + id + '">' + esc(label) + '</button>').join('') + '</span>'
      + '<label>Area <select id="who-city"><option value="">All areas</option>' + cities.map((city) => '<option' + (state.city === city ? ' selected' : '') + '>' + esc(city) + '</option>').join('') + '</select></label>'
      + '<label>Search <input id="who-q" type="search" value="' + esc(state.q) + '" placeholder="Name or registration"></label></div>'
      + '<p role="status">' + rows.length + ' shown' + (state.top ? ' (top 10 of ' + esc(PartnersMece.SEGMENT_LABEL[state.segment] || 'registered providers and charities') + ')' : '') + '. A superseded record is noted on its successor, not listed again.</p>'
      + '<div class="scroll"><table id="who-table"><thead><tr><th class="l">Counterparty</th><th class="l">Segment</th><th class="l">Recorded role</th><th class="l">Turnover</th><th class="l">Screen</th></tr></thead><tbody>'
      + rows.map((entity) => '<tr data-id="' + esc(entity.id) + '"><td class="l"><b>' + esc(entity.name) + '</b></td><td class="l">' + esc(entity.segmentLabel) + '</td><td class="l">' + esc(entity.subtype) + '</td><td class="l">' + esc(turnoverCell(entity)) + '</td><td class="l">' + esc(screenCell(entity)) + '</td></tr>').join('')
      + '</tbody></table></div></div>' + (selected ? detail(selected) : '');
    host.querySelectorAll('[data-seg]').forEach((button) => button.onclick = () => { state.segment = button.dataset.seg; state.selected = ''; renderWho(); });
    $('#who-city').onchange = (event) => { state.city = event.target.value; state.selected = ''; renderWho(); };
    $('#who-q').onchange = (event) => { state.q = event.target.value.trim(); state.selected = ''; renderWho(); };
    host.querySelectorAll('#who-table tbody tr').forEach((row) => row.onclick = () => { state.selected = row.dataset.id; renderWho(); document.getElementById('who-detail').scrollIntoView({block:'nearest'}); });
    const hash = 'who' + (state.segment !== 'all' ? '/' + state.segment : '') + (state.top ? '/top' : '');
    setHash(hash);
  }
  function renderReturn() {
    hideAll();
    $('#return_view').classList.remove('hidden');
    shellNav('opportunities');
    setHash('return');
    const host = $('#return_body');
    if (host.dataset.ready) return;
    host.dataset.ready = '1';
    host.innerHTML = '<div class="card"><h2>Return check</h2><p>Enter a written landlord rent and your costs. Framework spend is not your rent. Provider revenue is not a lease guarantee. Every field is required, including explicit zeroes. Blank fields produce no yield.</p><div class="g2" id="rc-inputs">'
      + [['rc_units','Units','1'],['rc_rent','Agreed annual rent per unit £','100'],['rc_price','Portfolio purchase price £','1000'],['rc_fees','Acquisition taxes and fees £','1000'],['rc_works','Works / compliance budget £','1000'],['rc_costs','Annual retained landlord costs £','100'],['rc_reserve','Annual repairs / capex reserve £','100'],['rc_loss','Rent loss / default stress %','1'],['rc_debt','Debt drawn £','1000'],['rc_interest','Debt interest %','0.1'],['rc_principal','Annual principal repayments £','100'],['rc_finance','Annual other financing fees £','100']].map(([id, label, step]) => '<label>' + label + ' <input id="' + id + '" type="number" min="0" step="' + step + '"></label>').join('')
      + '</div><div id="rc-result" class="legend" style="margin:16px 0 0">No yield until every input is filled, including zeroes.</div><p class="foot">' + esc(PartnersMece.DISCLAIMER) + ' Annual pre-tax figures only. Not IRR. Figures stay in this page.</p></div>';
    const fields = ['units','rent','price','fees','works','costs','reserve','loss','debt','interest','principal','finance'];
    const run = () => {
      const values = {};
      for (const key of fields) {
        const input = $('#rc_' + key);
        if (input.value.trim() === '') { $('#rc-result').textContent = 'Enter every input, including explicit zeroes. No yield is assumed.'; return; }
        values[key] = Number(input.value);
        if (!Number.isFinite(values[key]) || values[key] < 0) { $('#rc-result').textContent = 'Use non-negative numbers. Rent loss is a percentage from 0 to 100.'; return; }
      }
      if (values.loss > 100 || !Number.isInteger(values.units) || values.units < 1) { $('#rc-result').textContent = 'Units must be a positive whole number and rent loss must be from 0 to 100.'; return; }
      const result = PartnersMece.opportunityReturn(values);
      if (!(result.capital > 0) || !(result.equity > 0)) { $('#rc-result').textContent = 'All-in cost and equity must be positive. Debt must be below all-in cost.'; return; }
      const pct = (value) => value == null ? 'Not applicable' : (value * 100).toFixed(2) + '%';
      const money = (value) => value == null ? 'Not applicable' : '£' + Math.round(value).toLocaleString('en-GB');
      $('#rc-result').innerHTML = '<dl class="kv"><dt>All-in cost</dt><dd>' + money(result.capital) + '</dd><dt>Gross annual rent</dt><dd>' + money(result.gross) + '</dd><dt>Net operating income</dt><dd>' + money(result.noi) + '</dd><dt>Debt service</dt><dd>' + money(result.service) + '</dd><dt>Pre-tax cashflow</dt><dd>' + money(result.cash) + '</dd><dt>Gross yield</dt><dd>' + pct(result.grossYield) + '</dd><dt>Net yield</dt><dd>' + pct(result.netYield) + '</dd><dt>Cash on equity</dt><dd>' + pct(result.cashYield) + '</dd><dt>Debt service cover</dt><dd>' + (result.dscr == null ? 'Not applicable (no debt service)' : result.dscr.toFixed(2) + 'x') + '</dd></dl>';
    };
    host.querySelectorAll('input').forEach((input) => input.oninput = run);
  }
  async function openSheet(action) {
    viewMode('sheets');
    await ensure();
    for (let i = 0; i < 30 && !$('#sheets_book'); i++) await new Promise((resolve) => setTimeout(resolve, 50));
    if (!$('#sheets_book') || !window.SHEETBOOKS) return;
    const books = SHEETBOOKS.books;
    const bookIndex = books.findIndex((book) => book.id === action.bookId);
    if (bookIndex < 0) return;
    $('#sheets_book').value = String(bookIndex);
    sheetsChooseBook();
    const sheetIndex = books[bookIndex].sheets.findIndex((sheet) => sheet.name === action.sheet);
    if (sheetIndex >= 0) { $('#sheets_sheet').value = String(sheetIndex); $('#sheets_search').value = ''; sheetsRender(); }
  }
  viewMode = function (mode) {
    const route = routeOf(mode);
    if (route.view === 'who') {
      if (route.segment) state.segment = route.segment;
      if (route.top) state.top = true;
    }
    if (route.mode) state.oppMode = route.mode;
    if (route.view === 'who') { hideAll(); $('#who_view').classList.remove('hidden'); renderWho(); return; }
    if (route.view === 'opportunities' && state.oppMode === 'return') { renderReturn(); return; }
    if (route.view === 'opportunities' && state.oppMode === 'rent') { previous('lha'); shellNav('opportunities'); setHash('rent'); return; }
    if (route.view === 'opportunities') { previous(route.pass || 'flow'); shellNav('opportunities'); return; }
    if (route.view === 'frameworks') { previous('frameworks'); shellNav('frameworks'); return; }
    previous('sheets'); shellNav('workbook'); setHash('workbook');
  };
  function open(action) {
    action = action || {};
    if (action.segment) state.segment = action.segment;
    if (Object.prototype.hasOwnProperty.call(action, 'city') && action.city != null) state.city = action.city;
    if (action.top != null) state.top = !!action.top;
    if (action.q != null) state.q = action.q;
    if (action.mode) state.oppMode = action.mode;
    if (action.view === 'who' && action.id) state.selected = action.id;
    if (action.sheet) { openSheet(action); return; }
    if ((action.view === 'opportunities' || !action.view) && action.id && String(action.id).match(/^(GM|BR|GL)-/)) { state.oppMode = 'records'; viewMode('flow/' + action.id); return; }
    if (action.view === 'opportunities' && state.oppMode === 'rent') { viewMode('lha'); return; }
    if (action.view === 'opportunities' && state.oppMode === 'return') { viewMode('return'); return; }
    if (action.view === 'frameworks') { viewMode('frameworks'); return; }
    if (action.view === 'workbook') { viewMode('sheets'); return; }
    if (action.view === 'opportunities') { state.oppMode = 'records'; viewMode('flow'); return; }
    viewMode('who');
  }

  const style = document.createElement('style');
  style.textContent = '#mecebar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 0 0}#mecebar .segb{border:1px solid var(--line,#e3e7ec);background:#fff;border-radius:16px;padding:4px 12px;cursor:pointer;font:inherit}#mecebar .segb.on{background:#0f1a2e;color:#fff}#who-table tbody tr{cursor:pointer}#who_view .kv dd{font-weight:500;white-space:normal}#return_view label{display:flex;flex-direction:column;gap:4px;font-size:13px}#ask-fab{position:fixed;right:18px;bottom:18px;z-index:80;background:#0f1a2e;color:#fff;border:0;border-radius:22px;padding:11px 16px;font:600 14px inherit;cursor:pointer}#ask-pane{position:fixed;right:18px;bottom:68px;z-index:80;width:min(440px,calc(100vw - 24px));height:min(640px,calc(100vh - 96px));background:#fff;border:1px solid var(--line,#e3e7ec);border-radius:12px;box-shadow:0 12px 32px rgba(15,26,46,.18);display:flex;flex-direction:column}#ask-pane.hidden{display:none}#ask-log{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px}#ask-hd{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid var(--line,#e3e7ec)}#ask-f{display:flex;gap:6px;padding:8px;border-top:1px solid var(--line,#e3e7ec)}#ask-f textarea{flex:1;resize:none;height:46px;font:inherit;padding:8px;border:1px solid var(--line,#e3e7ec);border-radius:8px}#ask-go{background:#0b5fff;color:#fff;border:0;border-radius:8px;padding:0 12px;font-weight:600;cursor:pointer}.ask-m{padding:8px 10px;border-radius:8px;white-space:pre-wrap}.ask-u{align-self:flex-end;background:#0b5fff;color:#fff;max-width:88%}.ask-a{background:#f4f6f8;max-width:100%}.ask-tools{font-size:11px;color:#5b6472;margin-bottom:4px}.ask-cite{display:inline-block;margin:4px 4px 0 0;border:1px solid #cbdcff;background:#edf3ff;color:#1645a1;border-radius:6px;padding:3px 8px;cursor:pointer;font:inherit;font-size:12px}';
  document.head.appendChild(style);
  const who = document.createElement('div');
  who.id = 'who_view';
  who.className = 'hidden';
  who.innerHTML = '<main id="who_body"></main>';
  const ret = document.createElement('div');
  ret.id = 'return_view';
  ret.className = 'hidden';
  ret.innerHTML = '<main id="return_body"></main>';
  document.body.append(who, ret);
  document.title = 'Laurito Capital | Ecosystem Partners';
  const header = document.querySelector('header');
  if (header) {
    const mark = new URL('laurito-lockup.png', location.href).href;
    header.innerHTML = '<a class="lc-brand" href="#who" id="who-brand"><img src="' + esc(mark) + '" alt="Laurito Capital"></a><div class="lc-product">Ecosystem Partners<span>Counterparties, opportunities and frameworks</span></div><div id="status">Loading partner evidence from this site</div>';
    $('#who-brand').onclick = (event) => { event.preventDefault(); state.segment = 'all'; state.top = false; viewMode('who'); };
  }
  const disclaimer = document.querySelector('aside.card');
  if (disclaimer) disclaimer.innerHTML = '<b>Screening research, not an investment recommendation.</b> Provider financials, governance, footprint and published lease terms are source-dated evidence, not credit approval or a guaranteed rent offer. Confirm the rent-paying legal entity, current accounts, intake and written lease terms before relying on any provider. Core scores are not recalculated while Score Breakdown dimensions are empty. Seed totals, where shown, are historical workbook values. Use the Analysis dashboard for property comparisons.';
  window.viewMode = viewMode;
  window.PartnersHub = {open, ensure, context, get state() { return state; }};
  shellNav('who');
})();
