/* One-screen boardroom. Every control opens a drawer, a filter or another screen. */
(function (root) {
  'use strict';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const tidy = (value) => String(value ?? '').replace(/\s*;\s*/g, '. ').replace(/[\u2014\u2013]/g, ', ');
  let screen = null;
  let hooks = {};
  let hostEl = null;
  let typeFilter = '';
  let healthKey = '';
  let regionSeen = '';
  let bedFilter = '';
  let targetMode = 'lha';
  let channelId = '';
  let detailOpen = false;
  let openAll = false;
  let showUntested = false;
  let hurdleOverride = null;
  const AXIS_START = Date.UTC(2024, 0, 1);
  const AXIS_END = Date.UTC(2036, 0, 1);
  function money(value) {
    return value == null ? 'Not yet recorded' : root.BoardroomModel.money(value);
  }
  function when(date, id) {
    if (date && date.firm) return root.BoardroomModel.ukDate(date.iso) + (id ? ' (' + id + ')' : '');
    return 'Unknown';
  }
  function figure(text) {
    const raw = String(text);
    const blank = /not stated|not yet recorded|to confirm|not published|^unknown$|not in file|not in this ons|not in the ons/i.test(raw);
    return '<b class="' + (blank ? 'is-blank' : '') + '">' + esc(raw) + '</b>';
  }
  function rateCell(bed, field) {
    if (field === 'reference') return bed.reference == null ? 'Not in file' : root.BoardroomModel.money(bed.reference);
    if (field === 'omr') {
      if (!bed.onsLabel) return 'Not in this ONS series';
      return bed.omr == null ? 'Not in the ONS file' : root.BoardroomModel.money(bed.omr);
    }
    if (bed.gap == null) return 'Not yet recorded';
    const sign = bed.gap > 0 ? '+' : '';
    return sign + root.BoardroomModel.money(bed.gap) + ' (' + (bed.gapPercent > 0 ? '+' : '') + bed.gapPercent + '%)';
  }
  function xOf(iso) {
    const [year, month, day] = iso.split('-').map(Number);
    return Math.max(0, Math.min(100, (Date.UTC(year, month - 1, day) - AXIS_START) / (AXIS_END - AXIS_START) * 100));
  }
  function axis() {
    const marks = [];
    for (let year = 2024; year <= 2036; year += 2) marks.push(year);
    return '<div class="bd-axis-row" aria-hidden="true"><span></span><div class="bd-axis">' + marks.map((year) => '<span style="left:' + xOf(year + '-01-01') + '%">' + year + '</span>').join('') + '</div></div>';
  }
  function timeline(rows) {
    const today = xOf(screen.today);
    const dated = rows.filter((row) => row.start.firm || row.end.firm);
    const body = dated.map((row) => {
      const left = row.start.firm ? xOf(row.start.iso) : (row.end.firm ? xOf(row.end.iso) : 0);
      const right = row.end.firm ? xOf(row.end.iso) : left;
      const width = Math.max(1.5, right - left);
      return '<button type="button" class="bd-row" data-id="' + esc(row.id) + '" title="' + esc(row.name) + '"><span>' + esc(row.name) + '</span><i><b style="left:' + left + '%;width:' + width + '%"></b><em style="left:' + today + '%" title="Today"></em></i></button>';
    }).join('') || '<p class="bd-empty">No firm dates in this area.</p>';
    return body + axis();
  }
  function bars(rows) {
    const max = Math.max(1, ...rows.map((row) => row.operators.count));
    return rows.map((row) => '<button type="button" class="bd-bar" data-id="' + esc(row.id) + '" title="' + esc(row.name) + '"><span>' + esc(row.name) + '</span><i><b style="width:' + (row.operators.count / max * 100) + '%"></b></i><em>' + row.operators.count + '</em></button>').join('') || '<p class="bd-empty">No operator count is recorded.</p>';
  }
  function schemeRows(rows) {
    const head = '<div class="bd-scheme bd-scheme-head"><span>Scheme</span><span>Type</span><span>Status</span><span>Operators</span></div>';
    const body = rows.map((row) => '<button type="button" class="bd-scheme" data-id="' + esc(row.id) + '" title="' + esc(row.name) + '"><span>' + esc(row.name) + '</span><span>' + esc(row.type) + '</span><span>' + esc(tidy(row.status)) + '</span><span>' + row.operators.count + '</span></button>').join('');
    return '<div class="bd-matrix-body">' + head + (body || '<p class="bd-empty">No scheme of this type is recorded.</p>') + '</div>';
  }
  function drill(row) {
    if (!row) return '';
    const names = row.operators.names.length ? row.operators.names.map((name) => '<li>' + esc(name) + '</li>').join('') : '<li>Names are not listed.</li>';
    const stated = row.operators.stated ? '<p>' + row.operators.stated + ' is the count stated on the BiP record.</p>' : '';
    return '<div class="bd-drill" id="bd-drill"><p class="bd-crumb">Boardroom / ' + esc(screen.region.label) + '</p><button type="button" class="bd-back" id="bd-back">Back to the board</button><h2>' + esc(row.name) + '</h2><p>' + esc(tidy(row.status)) + '</p><dl><dt>Type</dt><dd>' + esc(row.type) + '</dd><dt>Start</dt><dd>' + esc(when(row.start, row.startId)) + '</dd><dt>End</dt><dd>' + esc(when(row.end, '')) + '</dd><dt>Lease term</dt><dd>' + esc(tidy(row.term) || 'Not published') + '</dd><dt>Lease rent</dt><dd>' + esc(tidy(row.rent) || 'Not published') + '</dd><dt>Operators</dt><dd>' + row.operators.count + '</dd><dt>BiP</dt><dd>' + esc(row.bip.join(', ') || 'None linked') + '</dd></dl>' + stated + '<ol>' + names + '</ol></div>';
  }
  function healthDrill(item) {
    if (!item) return '';
    let extra = '';
    if (item.label === 'Supply of targets' && screen.auctions) {
      extra = '<p><a href="' + esc(screen.auctionsLive || 'https://pgrahamlc.github.io/ecosystem-deals/#auctions') + '" target="_blank" rel="noopener">' + screen.auctions.matched + ' current auction lots matching criteria (Ecosystem Deals)</a></p><p class="bd-src">' + screen.auctions.unknown + ' have no bed count.</p>';
    }
    if (item.label === 'Deals and holdings') {
      extra = '<p><button type="button" class="btn sec" data-go="records/position">Enter deals and properties held</button></p>';
    }
    if (item.label === 'Rent gap') {
      extra = '<ul>' + screen.rates.map((bed) => '<li><span>' + esc(bed.onsLabel || bed.label) + '</span> ' + esc(rateCell(bed, 'gap')) + '</li>').join('') + '</ul>';
    }
    return '<div class="bd-drill" id="bd-drill"><p class="bd-crumb">Boardroom / ' + esc(screen.region.label) + '</p><button type="button" class="bd-back" id="bd-health-back">Back to the board</button><h2>' + esc(item.label) + '</h2><p>' + esc(item.detail) + '</p>' + extra + '</div>';
  }
  function render(host, next, nextHooks) {
    screen = next;
    hooks = nextHooks || {};
    hostEl = host;
    if (screen.region.id !== regionSeen) {
      regionSeen = screen.region.id;
      typeFilter = '';
      healthKey = '';
      bedFilter = '';
      targetMode = 'lha';
      channelId = '';
      detailOpen = false;
      openAll = false;
      showUntested = false;
    }
    const open = hooks.selected ? screen.schemes.find((row) => row.id === hooks.selected) : null;
    if (open) healthKey = '';
    const shown = typeFilter ? screen.schemes.filter((row) => row.type === typeFilter) : screen.schemes;
    const types = screen.contracts.types.map(([label, count]) => '<button type="button" class="bd-chip' + (typeFilter === label ? ' on' : '') + '" data-type="' + esc(label) + '" title="' + esc(label) + '"><b>' + count + '</b> ' + esc(label) + '</button>').join('');
    const presenting = document.body.classList.contains('bd-present');
    const health = screen.lights.find((item) => item.label === healthKey);
    host.innerHTML = '<div class="bd' + (open || health ? ' has-drill' : '') + '" id="bd-exec">'
      + '<div class="bd-top"><div><p class="bd-kicker">Executive snapshot</p><h1>' + esc(screen.region.label) + '</h1></div>'
      + '<div class="bd-tools"><button type="button" class="btn sec" id="bd-present">' + (presenting ? 'Exit' : 'Present') + '</button></div></div>'
      + regionPicks(screen)
      + '<p class="bd-note">' + esc(screen.executive.note) + '</p>'
      + execKpis(screen)
      + '<p class="bd-links"><button type="button" class="btn sec" data-go="records/frameworks">Framework records</button><button type="button" class="btn sec" data-go="records/position">Deals and properties</button><button type="button" class="btn sec" data-go="triage">Triage watch</button><button type="button" class="btn sec" data-go="market">Market Screen</button><button type="button" class="btn sec" id="bd-detail-toggle">' + (detailOpen ? 'Hide detailed board' : 'Detailed board') + '</button></p>'
      + '<section class="bd-matrix" aria-label="Open frameworks"><h2>Open frameworks</h2><p class="bd-src">Status and dates for frameworks that are open to join, live, and forthcoming. Closed records stay in the detailed board.</p>' + openTable(screen) + '</section>'
      + rentTable(screen, bedFilter)
      + channelsPanel(screen)
      + detailedBoard(shown, types)
      + (open ? drill(open) : healthDrill(health))
      + '</div>';
    const present = host.querySelector('#bd-present');
    if (present) present.onclick = () => {
      if (hooks.onPresent) hooks.onPresent();
      present.textContent = document.body.classList.contains('bd-present') ? 'Exit' : 'Present';
    };
    host.querySelectorAll('[data-go]').forEach((button) => button.onclick = () => hooks.onGo && hooks.onGo(button.dataset.go));
    host.querySelectorAll('[data-id]').forEach((button) => button.onclick = () => hooks.onSelect && hooks.onSelect(button.dataset.id));
    host.querySelectorAll('[data-type]').forEach((button) => button.onclick = () => {
      typeFilter = button.dataset.type || '';
      render(hostEl, screen, hooks);
    });
    host.querySelectorAll('[data-bed]').forEach((row) => row.onclick = () => {
      bedFilter = bedFilter === row.dataset.bed ? '' : row.dataset.bed;
      render(hostEl, screen, hooks);
    });
    host.querySelectorAll('[data-mode]').forEach((button) => button.onclick = () => {
      targetMode = button.dataset.mode === 'om' ? 'om' : 'lha';
      render(hostEl, screen, hooks);
    });
    host.querySelectorAll('[data-lot]').forEach((button) => button.onclick = (event) => {
      event.stopPropagation();
      const url = button.dataset.lot;
      if (url) window.open(url, '_blank', 'noopener');
    });
    host.querySelectorAll('[data-health]').forEach((button) => button.onclick = () => {
      healthKey = healthKey === button.dataset.health ? '' : button.dataset.health;
      if (hooks.onSelect) hooks.onSelect('');
      else render(hostEl, screen, hooks);
    });
    const back = host.querySelector('#bd-back');
    if (back) back.onclick = () => hooks.onSelect && hooks.onSelect('');
    const healthBack = host.querySelector('#bd-health-back');
    if (healthBack) healthBack.onclick = () => { healthKey = ''; render(hostEl, screen, hooks); };
    host.querySelectorAll('[data-region]').forEach((button) => button.onclick = () => hooks.onRegion && hooks.onRegion(button.dataset.region));
    host.querySelectorAll('[data-channel]').forEach((button) => button.onclick = () => {
      channelId = channelId === button.dataset.channel ? '' : button.dataset.channel;
      render(hostEl, screen, hooks);
    });
    const detailToggle = host.querySelector('#bd-detail-toggle');
    if (detailToggle) detailToggle.onclick = () => { detailOpen = !detailOpen; render(hostEl, screen, hooks); };
    const openToggle = host.querySelector('#bd-open-all');
    if (openToggle) openToggle.onclick = () => { openAll = !openAll; render(hostEl, screen, hooks); };
    const untested = host.querySelector('#bd-untested');
    if (untested) untested.onclick = () => { showUntested = !showUntested; render(hostEl, screen, hooks); };
    const apply = host.querySelector('#bd-threshold-apply');
    if (apply) apply.onclick = () => {
      const field = host.querySelector('#bd-threshold');
      const raw = field ? field.value.trim() : '';
      hurdleOverride = raw === '' ? null : raw;
      render(hostEl, screen, hooks);
    };
  }
  function positionForm(host, regionId, saved, onSave) {
    const row = (saved && saved[regionId]) || {dealsExecuted: null, propertiesHeld: null};
    const field = (key, label, value) => '<label>' + label + '<input data-k="' + key + '" inputmode="decimal" value="' + esc(value == null ? '' : value) + '" placeholder="Not yet recorded"></label>';
    host.innerHTML = '<div class="an-start"><p class="bd-kicker">Records</p><h1>Position sheet</h1><p>Enter only a figure you have. A blank stays Not yet recorded on the boardroom. This stays in this browser.</p><p><button type="button" class="btn sec" id="pos-back">Back to the boardroom</button></p></div><form class="bd-form" id="pos-form">'
      + field('deals', 'Deals executed', row.dealsExecuted)
      + field('held', 'Properties held', row.propertiesHeld)
      + '<p>Open market rents come from the ONS file. Auction lots come from Ecosystem Deals. This sheet is only for deals executed and properties held.</p>'
      + '<button class="btn" type="submit">Save to this browser</button><p id="pos-msg" role="status"></p></form>';
    host.querySelector('#pos-back').onclick = () => onSave(null);
    host.querySelector('#pos-form').onsubmit = (event) => {
      event.preventDefault();
      const read = (key) => host.querySelector('[data-k="' + key + '"]').value.trim();
      const numberOrNull = (key) => { const value = read(key); if (value === '') return null; const number = Number(value); return Number.isFinite(number) ? number : null; };
      onSave({
        dealsExecuted: numberOrNull('deals'),
        propertiesHeld: numberOrNull('held')
      });
      host.querySelector('#pos-msg').textContent = 'Saved. The boardroom will use these figures.';
    };
  }
  function upcomingTile(next) {
    const watched = root.TriageModel ? root.TriageModel.watch(next.schemes || [], next.today) : {items: []};
    const extra = root.TriageModel && root.TriageModel.signalItems ? root.TriageModel.signalItems(next.signals, next.region && next.region.id) : [];
    const watch = root.TriageModel && root.TriageModel.mergeWatch ? root.TriageModel.mergeWatch(watched, extra) : watched;
    const first = (watch.items || []).find((row) => row.date) || watch.items[0];
    const when = first && first.date ? root.BoardroomModel.ukDate(first.date) : '';
    const label = first ? ((first.name.length > 36 ? first.name.slice(0, 34) + '...' : first.name) + (when ? ', ' + when : ', date not firm')) : 'Nothing in the next 18 months';
    return '<button type="button" class="bd-count" data-go="triage" title="Open the upcoming frameworks watch"><b>' + watch.items.length + '</b><span>upcoming frameworks</span><span>' + esc(label) + '</span></button>';
  }
  function pounds(value) {
    if (value == null || !Number.isFinite(Number(value))) return '';
    return root.BoardroomModel.money(Number(value));
  }
  function shade(value, low, high) {
    if (value == null || high == null || low == null || high === low) return '';
    const scale = Math.max(0, Math.min(1, (value - low) / (high - low)));
    return ' style="background:rgba(31,77,58,' + (0.08 + scale * 0.2).toFixed(2) + ')"';
  }
  function rentTable(next, active) {
    const clickable = active !== undefined;
    const order = ['1', '2', '3', '4', 'shared'];
    const rates = order.map((key) => (next.rates || []).find((row) => row.key === key)).filter(Boolean);
    const lhaValues = rates.map((row) => row.reference).filter((value) => value != null);
    const omValues = rates.map((row) => row.omr).filter((value) => value != null);
    const lhaLow = lhaValues.length ? Math.min(...lhaValues) : null;
    const lhaHigh = lhaValues.length ? Math.max(...lhaValues) : null;
    const omLow = omValues.length ? Math.min(...omValues) : null;
    const omHigh = omValues.length ? Math.max(...omValues) : null;
    const widest = rates.filter((row) => row.gap != null).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))[0];
    const take = widest
      ? 'Widest gap: ' + widest.label + ', ' + pounds(Math.abs(widest.gap)) + ' pcm (' + Math.abs(widest.gapPercent) + '% ' + (widest.gap < 0 ? 'below open market' : 'above open market') + ').'
      : 'Widest gap: not yet recorded.';
    const area = next.ons && next.ons.area ? next.ons.area + (next.ons.month ? ', ' + next.ons.month : '') : 'not yet recorded';
    const rows = rates.map((bed) => {
      const lhaMissing = bed.reference == null;
      const omMissing = bed.omr == null;
      const omTitle = !bed.onsLabel ? 'ONS does not publish a shared room rent' : 'Not yet recorded';
      const gapTitle = bed.gap == null ? 'Not yet recorded' : 'LHA minus open market';
      const gapText = bed.gap == null ? 'n/a' : ((bed.gap > 0 ? '+' : '') + pounds(bed.gap));
      const pctText = bed.gapPercent == null ? 'n/a' : ((bed.gapPercent > 0 ? '+' : '') + bed.gapPercent + '%');
      return '<tr' + (clickable ? ' data-bed="' + esc(bed.key) + '"' : '') + (active === bed.key ? ' class="on"' : '') + '>'
        + '<th scope="row" data-h="Beds">' + esc(bed.label) + '</th>'
        + '<td data-h="LHA 2026/27 (pcm)"' + (lhaMissing ? ' class="na" title="Not yet recorded"' : shade(bed.reference, lhaLow, lhaHigh)) + '>' + (lhaMissing ? 'n/a' : esc(pounds(bed.reference))) + '</td>'
        + '<td data-h="Open market (pcm)"' + (omMissing ? ' class="na" title="' + esc(omTitle) + '"' : shade(bed.omr, omLow, omHigh)) + '>' + (omMissing ? 'n/a' : esc(pounds(bed.omr))) + '</td>'
        + '<td class="bd-gap ' + root.BoardroomModel.gapBand(bed.gapPercent) + '" data-h="Gap £ (pcm)" title="' + esc(gapTitle) + '">' + esc(gapText) + '</td>'
        + '<td class="bd-gap ' + root.BoardroomModel.gapBand(bed.gapPercent) + '" data-h="Gap %" title="' + esc(gapTitle) + '">' + esc(pctText) + '</td>'
        + '</tr>';
    }).join('');
    return '<section class="bd-rent" id="bd-rent" aria-label="Rent matrix">'
      + '<h2>Rent matrix</h2>'
      + '<p class="bd-take">' + esc(take) + '</p>'
      + '<table><thead><tr><th>Beds</th><th>LHA 2026/27 (pcm)</th><th>Open market (pcm)</th><th>Gap £ (pcm)</th><th>Gap %</th></tr></thead><tbody>'
      + rows + '</tbody></table>'
      + '<p class="bd-legend"><span class="bd-gap good">Under 10%</span><span class="bd-gap mid">10 to 25%</span><span class="bd-gap bad">Over 25%</span><span class="na">n/a is not in the source</span></p>'
      + '<p class="bd-src">LHA reference: ' + esc(next.region.reference || 'not yet recorded') + '. Open market: ' + esc(area) + '. ' + esc(next.lhaProvenance || '') + ' ' + esc((next.ons && next.ons.note) || '') + '</p>'
      + '</section>';
  }
  function targetsBox(next, active, mode, nested) {
    const counts = root.AuctionCounts;
    const lots = next.lots || [];
    const hurdle = next.hurdle;
    const assessed = counts && counts.assess ? counts.assess(lots, next.rates, hurdle) : {byBed: {}, lha: {rows: []}, om: {rows: []}};
    const view = mode === 'om' ? assessed.om : assessed.lha;
    const modeName = mode === 'om' ? 'open market' : 'LHA';
    const order = ['1', '2', '3', '4', 'shared'];
    const labels = {'1': '1 bed', '2': '2 bed', '3': '3 bed', '4': '4 bed', shared: 'HMO / shared'};
    const byBed = assessed.byBed || {};
    const maxBar = Math.max(1, ...order.map((key) => byBed[key] || 0));
    const bars = order.map((key) => '<button type="button" class="bd-bed' + (active === key ? ' on' : '') + '" data-bed="' + key + '"><span>' + labels[key] + '</span><i><b style="width:' + Math.round(((byBed[key] || 0) / maxBar) * 100) + '%"></b></i><em>' + (byBed[key] || 0) + '</em></button>').join('');
    const shown = (view.rows || []).filter((row) => !active || row.beds === active);
    const tested = shown.filter((row) => row.result !== 'not testable');
    const below = tested.filter((row) => row.result === 'below');
    const viable = tested.length ? Math.round((below.length / tested.length) * 1000) / 10 : null;
    const wide = (next.rates || []).filter((row) => row.gap != null).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))[0];
    const focusKey = active || (wide && wide.key) || '';
    const focus = (view.rows || []).filter((row) => row.beds === focusKey && row.result !== 'not testable');
    const focusBelow = focus.filter((row) => row.result === 'below').length;
    const focusLabel = labels[focusKey] || 'these';
    const focusThreshold = focus.length ? focus[0].threshold : null;
    const wideCount = wide ? (byBed[wide.key] || 0) : 0;
    const linkLine = wide
      ? 'The widest LHA gap is ' + wide.label + '. ' + wideCount + ' current ' + (wideCount === 1 ? 'lot is' : 'lots are') + ' ' + wide.label + '.'
      : 'The widest LHA gap is not yet recorded.';
    const take = !hurdle
      ? 'Yield hurdle not yet recorded.'
      : (focus.length ? focusBelow + ' of ' + focus.length + ' ' + focusLabel + ' lots sit below the ' + pounds(focusThreshold) + ' ' + modeName + ' threshold.' : 'No ' + focusLabel + ' lot can be tested against the ' + modeName + ' rent.');
    const hurdleText = hurdle ? (Math.round(hurdle * 1000) / 10) + '%' : 'not yet recorded';
    const matched = next.auctions ? next.auctions.matched : null;
    const unknown = next.auctions ? next.auctions.unknown : (byBed.unknown || 0);
    const headline = matched == null ? 'Current lots are not loaded.' : matched + ' current ' + (matched === 1 ? 'lot matches' : 'lots match') + ' a 3 or 4 bed home. ' + unknown + (unknown === 1 ? ' has' : ' have') + ' no bed count.';
    const groups = {};
    for (const row of shown) {
      if (!groups[row.beds]) groups[row.beds] = [];
      groups[row.beds].push(row);
    }
    const strips = order.filter((key) => !active || active === key).map((key) => {
      const group = (groups[key] || []).filter((row) => row.threshold != null && row.price != null);
      if (!group.length) return '<div class="bd-strip-row"><span>' + labels[key] + '</span><p class="is-blank">Not testable</p></div>';
      const top = Math.max(...group.map((row) => Math.max(row.price, row.threshold))) * 1.05;
      const line = (group[0].threshold / top) * 100;
      const dots = group.map((row) => {
        const left = Math.max(0, Math.min(100, (row.price / top) * 100));
        const tip = row.title + '. Guide ' + pounds(row.price) + '. Threshold ' + pounds(row.threshold) + '. ' + (row.headroom >= 0 ? pounds(row.headroom) + ' headroom' : pounds(Math.abs(row.headroom)) + ' shortfall');
        return '<button type="button" class="bd-dot ' + (row.result === 'below' ? 'ok' : 'over') + '" style="left:' + left.toFixed(2) + '%" data-lot="' + esc(row.url || 'https://pgrahamlc.github.io/ecosystem-deals/#auctions') + '" title="' + esc(tip) + '"></button>';
      }).join('');
      return '<div class="bd-strip-row"><span>' + labels[key] + '</span><div class="bd-track"><i class="bd-line" style="left:' + line.toFixed(2) + '%" title="Threshold ' + esc(pounds(group[0].threshold)) + '"></i>' + dots + '</div></div>';
    }).join('');
    const detail = shown.slice().sort((a, b) => String(a.result).localeCompare(String(b.result)) || (a.price || 0) - (b.price || 0)).map((row) => {
      const result = row.result === 'below' ? 'Below threshold' : (row.result === 'above' ? 'Above threshold' : 'Not testable');
      const room = row.headroom == null ? 'n/a' : ((row.headroom >= 0 ? pounds(row.headroom) + ' headroom' : pounds(Math.abs(row.headroom)) + ' shortfall') + (row.headroomPct != null ? ' (' + Math.abs(row.headroomPct) + '%)' : ''));
      const name = row.url ? '<a href="' + esc(row.url) + '" target="_blank" rel="noopener">' + esc(row.title) + '</a>' : esc(row.title);
      return '<tr><td>' + name + '</td><td>' + esc(labels[row.beds] || 'Not testable') + '</td><td>' + (row.price == null ? 'n/a' : esc(pounds(row.price))) + '</td><td>' + (row.threshold == null ? 'n/a' : esc(pounds(row.threshold))) + '</td><td>' + (room === 'n/a' ? '<span class="is-blank" title="Not yet recorded">n/a</span>' : esc(room)) + '</td><td>' + result + '</td></tr>';
    }).join('');
    const plot = lots.length ? strips : '<p class="is-blank">' + (next.auctionsFrom === 'live' ? 'No current lots in this area.' : 'The live lots file has not loaded yet.') + '</p>';
    const source = next.auctionsFrom === 'live'
      ? 'Counted just now from the live Ecosystem Deals lots file. Allsop is excluded.'
      : 'Saved count' + (next.auctionsUpdated ? ', lots file ' + String(next.auctionsUpdated).slice(0, 10) : '') + '. The live lots file has not loaded yet.';
    const inner = '<p class="bd-take">' + esc(headline) + '</p>'
      + '<div class="bd-beds">' + bars + '</div>'
      + '<p class="bd-src">' + (byBed.unknown || 0) + ' lots have no bed count, so they are not in the bars. ' + esc(linkLine) + ' <a href="' + esc(next.auctionsLive || 'https://pgrahamlc.github.io/ecosystem-deals/#auctions') + '" target="_blank" rel="noopener">Open matching lots</a></p>'
      + '<div class="bd-modes"><button type="button" class="bd-chip' + (mode === 'lha' ? ' on' : '') + '" data-mode="lha">LHA threshold</button><button type="button" class="bd-chip' + (mode === 'om' ? ' on' : '') + '" data-mode="om">Open market threshold</button><span class="foot">Gross yield hurdle ' + esc(hurdleText) + '</span></div>'
      + '<p class="bd-take">' + esc(take) + '</p>'
      + '<p class="foot">' + (active ? 'Counts for this bed size.' : 'Counts for every bed size. The line above is the widest LHA gap.') + '</p>'
      + '<div class="bd-tiles"><span><b>' + (hurdle ? below.length : 'n/a') + '</b> below threshold</span><span><b>' + (hurdle ? (tested.length - below.length) : 'n/a') + '</b> above threshold</span><span><b>' + (shown.length - tested.length) + '</b> not testable</span><span><b>' + (viable == null ? 'n/a' : viable + '%') + '</b> viable among tested</span></div>'
      + '<div class="bd-strip">' + plot + '</div>'
      + '<details><summary>Show detail</summary><div class="bd-detail"><table><thead><tr><th>Lot</th><th>Beds</th><th>Guide</th><th>Threshold</th><th>Headroom</th><th>Result</th></tr></thead><tbody>'
      + (detail || '<tr><td colspan="6">Not yet recorded</td></tr>') + '</tbody></table></div></details>'
      + '<p class="bd-src">' + esc(source) + ' A lot is viable when its guide price is at or under the price that makes the monthly rent a gross yield of ' + esc(hurdleText) + '. No bed count or no guide price is not testable. Lot areas follow the Ecosystem Deals city field. Warrington lots tagged Cheshire stay in Cheshire, and Warrington lots tagged Manchester stay in Greater Manchester.</p>';
    if (nested) return '<div class="bd-inline">' + inner + '</div>';
    return '<section class="bd-targets" aria-label="Potential acquisition targets"><h2>Potential acquisition targets</h2>' + inner + '</section>';
  }
  function pctShown(next) {
    if (hurdleOverride != null) return String(hurdleOverride);
    if (!(next.hurdle > 0)) return '';
    return String(Math.round(next.hurdle * 1000) / 10);
  }
  function hurdleNow(next) {
    const raw = pctShown(next);
    if (raw === '') return null;
    const number = Number(raw);
    return Number.isFinite(number) && number > 0 ? number / 100 : null;
  }
  function withHurdle(next) {
    const hurdle = hurdleNow(next);
    return Object.assign({}, next, {hurdle: hurdle == null ? null : hurdle});
  }
  function regionPicks(next) {
    const executive = next.executive || {priorityIds: [], priorityRegion: ''};
    const picks = (executive.priorityIds || []).map((id) => {
      const region = root.BoardroomModel.regionById(id);
      const on = next.region.id === id ? ' on' : '';
      const tag = id === executive.priorityRegion ? ' <i>Priority</i>' : '';
      return '<button type="button" class="bd-pick' + on + '" data-region="' + esc(id) + '">' + esc(region.city || region.label) + tag + '</button>';
    }).join('');
    const priority = root.BoardroomModel.regionById(executive.priorityRegion);
    return '<div class="bd-picks" role="group" aria-label="Priority regions">' + picks + '</div><p class="bd-src">Priority regions: Manchester, Edinburgh, Birmingham, Liverpool and Cheshire. The priority setting is ' + esc(priority.city || priority.label) + ' until that choice is confirmed. Other areas stay in the area menu.</p>';
  }
  function kpi(value, label, hint, go) {
    const text = value == null || value === '' ? 'Not yet recorded' : String(value);
    const inner = figure(text) + '<span>' + esc(label) + '</span><span>' + esc(hint) + '</span>';
    if (!go) return '<div class="bd-count">' + inner + '</div>';
    return '<button type="button" class="bd-count" data-go="' + go + '" title="' + esc(hint) + '">' + inner + '</button>';
  }
  function execKpis(next) {
    const executive = next.executive;
    const operators = executive.operatorPlaces ? executive.operatorPlaces : (executive.schemes ? 'None recorded' : null);
    return '<div class="bd-counts bd-exec-counts">'
      + kpi(executive.open.length, 'Open frameworks', 'With status and dates below', '')
      + kpi(executive.schemes, 'Available schemes', executive.fromBip + ' from BiP Tracker', 'records/frameworks')
      + kpi(executive.deals, 'Deals executed', 'Entered on the position sheet', 'records/position')
      + kpi(executive.held, 'Properties held', 'Entered on the position sheet', 'records/position')
      + kpi(operators, 'Operator coverage', 'Businesses operating in this space', '')
      + '</div><p class="bd-src">' + esc(executive.operatorLine) + '</p>';
  }
  function openTable(next) {
    const rows = (next.executive && next.executive.open) || [];
    if (!rows.length) return '<p class="bd-empty">No open framework is recorded for this area yet.</p>';
    const shown = openAll ? rows : rows.slice(0, 6);
    const body = shown.map((row) => {
      const source = row.source && row.source.url
        ? '<a href="' + esc(row.source.url) + '" target="_blank" rel="noopener">' + esc(row.source.label || 'Source') + '</a>'
        : '<span class="is-blank">No source link</span>';
      return '<tr><td class="l"><button type="button" class="bd-text" data-id="' + esc(row.id) + '">' + esc(row.name) + '</button></td><td class="l">' + esc(tidy(row.status)) + '</td><td>' + esc(when(row.start, '')) + '</td><td>' + esc(when(row.end, '')) + '</td><td>' + (row.fromBip ? 'Yes' : 'No') + '</td><td>' + source + '</td></tr>';
    }).join('');
    const more = rows.length > 6 ? '<p><button type="button" class="btn sec" id="bd-open-all">' + (openAll ? 'Show the first six' : 'Show all ' + rows.length + ' open frameworks') + '</button></p>' : '';
    return '<div class="bd-matrix-body"><table class="bd-open"><thead><tr><th>Framework</th><th>Status</th><th>Start</th><th>End</th><th>BiP Tracker</th><th>Source</th></tr></thead><tbody>' + body + '</tbody></table></div>' + more;
  }
  function detailedBoard(shown, types) {
    if (!detailOpen) return '';
    const health = screen.lights.map((item) => {
      const blank = /^(not yet recorded|not stated|to confirm|not published|unknown)$/i.test(item.detail);
      return '<li class="bd-' + item.tone + '"><button type="button" class="bd-health-btn" data-health="' + esc(item.label) + '" title="' + esc(item.detail) + '"><b>' + esc(item.label) + '</b><span class="' + (blank ? 'is-blank' : '') + '">' + esc(item.detail) + '</span></button></li>';
    }).join('');
    return '<section class="bd-more" id="bd-more" aria-label="Detailed board"><h2>Detailed board</h2><div class="bd-counts">' + upcomingTile(screen) + '</div>'
      + '<section class="bd-split" aria-label="Timeline and health"><div class="bd-time"><h2>Timeline</h2>' + timeline(screen.timeline) + '<h2>Operator places</h2><p class="bd-src">Each bar is a framework. The count is businesses operating in this space, and a business on two frameworks is counted twice.</p><div class="bd-bars">' + bars(screen.ranked) + '</div></div>'
      + '<article class="bd-health"><h2>Region health</h2><ul>' + health + '</ul><p class="bd-verdict">' + esc(screen.verdict) + '</p></article></section>'
      + '<section class="bd-matrix" aria-label="Scheme matrix"><h2>What exists here</h2><div class="bd-chips"><button type="button" class="bd-chip' + (typeFilter ? '' : ' on') + '" data-type="">All <b>' + screen.schemes.length + '</b></button>' + types + '</div><p class="bd-src">' + shown.length + ' schemes shown. Select a row for dates, operators and BiP.</p>' + schemeRows(shown) + '</section></section>';
  }
  function thresholdControl() {
    return '<div class="bd-modes"><label>Gross yield threshold % <input id="bd-threshold" inputmode="decimal" value="' + esc(pctShown(screen)) + '" placeholder="Not yet recorded"></label><button type="button" class="btn sec" id="bd-threshold-apply">Apply threshold</button></div><p class="bd-src">A price at or under annual rent divided by this gross yield is below the threshold. Clear the box and apply it to use the gates file when that file has loaded.</p>';
  }
  function splitTiles(view, hurdle) {
    const below = hurdle ? view.below : 'n/a';
    const above = hurdle ? view.above : 'n/a';
    return '<div class="bd-tiles"><span><b>' + below + '</b> below threshold</span><span><b>' + above + '</b> above threshold</span><span><b>' + view.untested + '</b> not testable</span></div>';
  }
  function incomeDrill(row) {
    const hurdle = hurdleNow(screen);
    const view = root.AcquisitionChannels.assessIncome(row.items || [], hurdle);
    const shown = showUntested ? view.rows : view.rows.filter((item) => item.result !== 'not testable');
    const detail = shown.map((item) => {
      const result = item.result === 'below' ? 'Below threshold' : (item.result === 'above' ? 'Above threshold' : 'Not testable');
      const name = item.url ? '<a href="' + esc(item.url) + '" target="_blank" rel="noopener">' + esc(item.title || item.address) + '</a>' : esc(item.address || 'Listing');
      const room = item.headroom == null ? 'n/a' : (item.headroom >= 0 ? pounds(item.headroom) + ' headroom' : pounds(Math.abs(item.headroom)) + ' shortfall');
      return '<tr><td>' + name + '</td><td>' + (item.price == null ? 'n/a' : esc(pounds(item.price))) + '</td><td>' + (item.income == null ? 'n/a' : esc(pounds(item.income))) + '</td><td>' + (item.threshold == null ? 'n/a' : esc(pounds(item.threshold))) + '</td><td>' + (room === 'n/a' ? '<span class="is-blank">n/a</span>' : esc(room)) + '</td><td>' + result + '</td></tr>';
    }).join('') || '<tr><td colspan="6">No tested listing. A listing with no price or no stated income is not testable.</td></tr>';
    const link = row.page ? '<p class="bd-src"><a href="' + esc(row.page) + '" target="_blank" rel="noopener">Open the blocks file</a></p>' : '';
    return '<div class="bd-inline">' + thresholdControl() + '<p class="bd-src">' + esc(row.note) + ' On-market rows use the stated annual income. They are not tested against a bedroom LHA rate, because the listing does not give one rent for one bedroom size.</p>' + splitTiles(view, hurdle) + '<p><button type="button" class="btn sec" id="bd-untested">' + (showUntested ? 'Hide listings that cannot be tested' : 'Show listings that cannot be tested') + '</button></p><div class="bd-detail"><table><thead><tr><th>Listing</th><th>Asking price</th><th>Stated income</th><th>Threshold</th><th>Headroom</th><th>Result</th></tr></thead><tbody>' + detail + '</tbody></table></div>' + link + '</div>';
  }
  function channelHint(row) {
    if (!row.feed) return 'no feed yet';
    if (!row.loaded || row.count == null) return 'Not loaded';
    if (!row.count) return row.id === 'on-market' ? 'None in the blocks file' : 'None in this area';
    if (row.id === 'auction') return 'Current lots';
    return 'Private treaty listings';
  }
  function channelDrill(row) {
    if (!row.feed) return '<div class="bd-inline"><p>no feed yet. Off-market opportunities are not in a source file, so none are listed.</p></div>';
    if (!row.loaded || row.count == null) return '<div class="bd-inline"><p>' + esc(row.note) + '</p></div>';
    if (row.id === 'on-market') return incomeDrill(row);
    if (row.id === 'auction') return '<div class="bd-inline"><p class="bd-src">' + esc(row.note) + '</p>' + thresholdControl() + targetsBox(withHurdle(screen), bedFilter, targetMode, true) + '</div>';
    return '';
  }
  function channelsPanel(next) {
    const pack = next.channels || {};
    const order = [pack.offMarket, pack.auction, pack.onMarket].filter(Boolean);
    const cards = order.map((row) => {
      const count = row.count == null ? 'Not loaded' : String(row.count);
      return '<button type="button" class="bd-channel' + (channelId === row.id ? ' on' : '') + '" data-channel="' + esc(row.id) + '"><small>' + esc(row.label) + '</small><b class="' + (row.count == null ? 'is-blank' : '') + '">' + esc(count) + '</b><span>' + esc(channelHint(row)) + '</span></button>';
    }).join('');
    const open = order.find((row) => row.id === channelId);
    return '<section class="bd-targets" id="bd-targets" aria-label="Target acquisitions"><h2>Target acquisitions</h2><p class="bd-src">Off-market, auction and on-market. Select a channel for items above and below the threshold.</p><div class="bd-channels">' + cards + '</div>' + (open ? channelDrill(open) : '') + '</section>';
  }
  root.BoardroomUI = {render, positionForm, rentTable};
})(typeof window !== 'undefined' ? window : globalThis);
