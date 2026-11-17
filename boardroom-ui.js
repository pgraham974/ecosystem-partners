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
  const AXIS_START = Date.UTC(2024, 0, 1);
  const AXIS_END = Date.UTC(2036, 0, 1);
  function money(value) {
    return value == null ? 'Not yet recorded' : root.BoardroomModel.money(value);
  }
  function when(date, id) {
    if (date && date.firm) return root.BoardroomModel.ukDate(date.iso) + (id ? ' (' + id + ')' : '');
    return 'Unknown';
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
    }
    const open = hooks.selected ? screen.schemes.find((row) => row.id === hooks.selected) : null;
    if (open) healthKey = '';
    const shown = typeFilter ? screen.schemes.filter((row) => row.type === typeFilter) : screen.schemes;
    const types = screen.contracts.types.map(([label, count]) => '<button type="button" class="bd-chip' + (typeFilter === label ? ' on' : '') + '" data-type="' + esc(label) + '" title="' + esc(label) + '"><b>' + count + '</b> ' + esc(label) + '</button>').join('');
    const presenting = document.body.classList.contains('bd-present');
    const health = screen.lights.find((item) => item.label === healthKey);
    host.innerHTML = '<div class="bd' + (open || health ? ' has-drill' : '') + '">'
      + '<div class="bd-top"><div><p class="bd-kicker">Boardroom</p><h1>' + esc(screen.region.label) + '</h1></div>'
      + '<div class="bd-tools"><button type="button" class="btn sec" id="bd-present">' + (presenting ? 'Exit' : 'Present') + '</button></div></div>'
      + '<ul class="an-takes">' + screen.lights.slice(0, 3).map((item) => '<li>' + esc(item.label + '. ' + item.detail) + '</li>').join('') + '</ul>'
      + '<div class="bd-counts"><button type="button" class="bd-count" data-type="" title="Show every scheme"><b>' + screen.contracts.schemes + '</b><span>schemes</span></button><span><b>' + screen.contracts.withBip + '</b> with BiP</span><span><b>1</b> area</span><button type="button" class="bd-count" data-go="records/position" title="Enter deals executed"><b>' + (screen.portfolio.deals == null ? 'Not yet recorded' : screen.portfolio.deals) + '</b><span>deals executed</span></button><button type="button" class="bd-count" data-go="records/position" title="Enter properties held"><b>' + (screen.portfolio.held == null ? 'Not yet recorded' : screen.portfolio.held) + '</b><span>properties held</span></button><span title="Places on framework records. A firm on two frameworks counts twice. This is not the Market Screen provider count."><b>' + screen.portfolio.operators + '</b> operator places</span></div>'
      + '<section class="bd-mid" aria-label="Timeline and health"><div class="bd-time"><h2>Timeline</h2>' + timeline(screen.timeline) + '<h2>Operator places</h2><div class="bd-bars">' + bars(screen.ranked) + '</div></div>'
      + '<article class="bd-health"><h2>Region health</h2><ul>' + screen.lights.map((item) => '<li class="bd-' + item.tone + '"><button type="button" class="bd-health-btn" data-health="' + esc(item.label) + '" title="' + esc(item.detail) + '"><b>' + esc(item.label) + '</b><span>' + esc(item.detail) + '</span></button></li>').join('') + '</ul><p class="bd-verdict">' + esc(screen.verdict) + '</p></article></section>'
      + '<section class="bd-matrix" aria-label="Scheme matrix"><h2>What exists here</h2><div class="bd-chips"><button type="button" class="bd-chip' + (typeFilter ? '' : ' on') + '" data-type="">All <b>' + screen.schemes.length + '</b></button>' + types + '</div><p class="bd-src">' + shown.length + ' schemes shown. Select a row for dates, operators and BiP.</p>' + schemeRows(shown) + '</section>'
      + '<section class="bd-three" aria-label="Rates">'
      + '<article><h2>LHA</h2><p>' + esc(screen.region.reference || 'No reference BRMA') + '</p><ul>' + screen.rates.map((bed) => '<li><span>' + esc(bed.label) + '</span><b>' + esc(rateCell(bed, 'reference')) + '</b></li>').join('') + '</ul><p class="bd-src">' + esc(screen.lhaProvenance) + '</p></article>'
      + '<article><h2>Open market</h2><p>' + esc(screen.ons.area ? screen.ons.area + ', ' + screen.ons.month : 'No ONS area for this selection') + '</p><ul>' + screen.rates.map((bed) => '<li><span>' + esc(bed.onsLabel || bed.label) + '</span><b>' + esc(rateCell(bed, 'omr')) + '</b></li>').join('') + '</ul><p class="bd-src">ONS Price Index of Private Rents, 21 Oct 2026 release. ' + esc(screen.ons.note) + '</p></article>'
      + '<article><h2>Gap</h2><p>LHA minus open market.</p><ul>' + screen.rates.map((bed) => '<li><span>' + esc(bed.onsLabel || bed.label) + '</span><b>' + esc(rateCell(bed, 'gap')) + '</b></li>').join('') + '</ul><p>' + (screen.auctions ? '<a class="bd-out" href="' + esc(screen.auctionsLive || 'https://pgrahamlc.github.io/ecosystem-deals/#auctions') + '" target="_blank" rel="noopener">' + screen.auctions.matched + ' current auction lots matching criteria (Ecosystem Deals)</a>. ' + screen.auctions.unknown + ' have no bed count.' : 'Current auction lots are not loaded.') + '</p><p class="bd-src">' + (screen.auctionsFrom === 'live' ? 'Counted just now from the live Ecosystem Deals lots file. Allsop is excluded.' : 'Saved count' + (screen.auctionsUpdated ? ', lots file ' + esc(screen.auctionsUpdated.slice(0, 10)) : '') + '. The live lots file has not loaded yet.') + '</p></article>'
      + '</section>'
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
    host.querySelectorAll('[data-health]').forEach((button) => button.onclick = () => {
      healthKey = healthKey === button.dataset.health ? '' : button.dataset.health;
      if (hooks.onSelect) hooks.onSelect('');
      else render(hostEl, screen, hooks);
    });
    const back = host.querySelector('#bd-back');
    if (back) back.onclick = () => hooks.onSelect && hooks.onSelect('');
    const healthBack = host.querySelector('#bd-health-back');
    if (healthBack) healthBack.onclick = () => { healthKey = ''; render(hostEl, screen, hooks); };
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
  root.BoardroomUI = {render, positionForm};
})(typeof window !== 'undefined' ? window : globalThis);
