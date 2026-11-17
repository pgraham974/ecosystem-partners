/* One-screen boardroom. Detail opens only when a bar or row is clicked. */
(function (root) {
  'use strict';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let screen = null;
  let hooks = {};
  function money(value) {
    return value == null ? 'Not yet recorded' : root.BoardroomModel.money(value);
  }
  function when(date, id) {
    if (date && date.firm) return root.BoardroomModel.ukDate(date.iso) + (id ? ' (' + id + ')' : '');
    return 'Unknown';
  }
  function rateCell(bed, field) {
    if (field === 'reference') return bed.reference == null ? 'Not in file' : root.BoardroomModel.money(bed.reference);
    if (field === 'omr') return bed.omr == null ? 'Not yet recorded' : root.BoardroomModel.money(bed.omr);
    return bed.gap == null ? 'Not yet recorded' : (bed.gap > 0 ? '+' : '') + root.BoardroomModel.money(bed.gap);
  }
  function timeline(rows) {
    const start = Date.UTC(2024, 0, 1);
    const end = Date.UTC(2036, 0, 1);
    const x = (iso) => {
      const [year, month, day] = iso.split('-').map(Number);
      return Math.max(0, Math.min(100, (Date.UTC(year, month - 1, day) - start) / (end - start) * 100));
    };
    const today = x(screen.today);
    return rows.slice(0, 6).map((row) => {
      const left = row.start.firm ? x(row.start.iso) : (row.end.firm ? x(row.end.iso) : 0);
      const right = row.end.firm ? x(row.end.iso) : left;
      const width = Math.max(1.5, right - left);
      return '<button type="button" class="bd-row" data-id="' + esc(row.id) + '"><span>' + esc(row.short) + '</span><i><b style="left:' + left + '%;width:' + width + '%"></b><em style="left:' + today + '%"></em></i></button>';
    }).join('') || '<p class="bd-empty">No firm dates in this area.</p>';
  }
  function bars(rows) {
    const max = Math.max(1, ...rows.map((row) => row.operators.count));
    return rows.slice(0, 5).map((row) => '<button type="button" class="bd-bar" data-id="' + esc(row.id) + '"><span>' + esc(row.short) + '</span><i><b style="width:' + (row.operators.count / max * 100) + '%"></b></i><em>' + row.operators.count + '</em></button>').join('') || '<p class="bd-empty">No operator count is recorded.</p>';
  }
  function drill(row) {
    if (!row) return '';
    const names = row.operators.names.length ? row.operators.names.map((name) => '<li>' + esc(name) + '</li>').join('') : '<li>Names are not listed.</li>';
    const stated = row.operators.stated ? '<p>' + row.operators.stated + ' is the count stated on the BiP record.</p>' : '';
    return '<div class="bd-drill" id="bd-drill"><p class="bd-crumb">Boardroom / ' + esc(screen.region.label) + ' / ' + esc(row.short) + '</p><button type="button" class="bd-back" id="bd-back">Back to the board</button><h2>' + esc(row.name) + '</h2><p>' + esc(row.status) + '</p><dl><dt>Start</dt><dd>' + esc(when(row.start, row.startId)) + '</dd><dt>End</dt><dd>' + esc(when(row.end, '')) + '</dd><dt>Lease term</dt><dd>' + esc(row.term || 'Not published') + '</dd><dt>Lease rent</dt><dd>' + esc(row.rent || 'Not published') + '</dd><dt>Operators</dt><dd>' + row.operators.count + '</dd><dt>BiP</dt><dd>' + esc(row.bip.join(', ') || 'None linked') + '</dd></dl>' + stated + '<ol>' + names + '</ol></div>';
  }
  function render(host, next, nextHooks) {
    screen = next;
    hooks = nextHooks || {};
    const open = hooks.selected ? screen.schemes.find((row) => row.id === hooks.selected) : null;
    const types = screen.contracts.types.map(([label, count]) => '<b>' + count + '</b> ' + esc(label)).join('');
    host.innerHTML = '<div class="bd' + (open ? ' has-drill' : '') + '">'
      + '<div class="bd-top"><div><p class="bd-kicker">Boardroom</p><h1>' + esc(screen.region.label) + '</h1></div>'
      + '<div class="bd-tools"><button type="button" class="btn sec" id="bd-present">Present</button></div></div>'
      + '<section class="bd-contracts" aria-label="Contracts"><div class="bd-counts"><span><b>' + screen.contracts.schemes + '</b> schemes</span><span><b>' + screen.contracts.withBip + '</b> with BiP</span><span><b>1</b> area</span><div class="bd-matrix"><h2>What exists here</h2><p>' + (types || 'None recorded') + '</p></div></div><div class="bd-time"><h2>Timeline</h2>' + timeline(screen.timeline) + '</div></section>'
      + '<section class="bd-three" aria-label="Rates">'
      + '<article><h2>LHA</h2><p>' + esc(screen.region.reference || 'No reference BRMA') + '</p><ul>' + screen.rates.map((bed) => '<li><span>' + esc(bed.label) + '</span><b>' + esc(rateCell(bed, 'reference')) + '</b></li>').join('') + '</ul><p class="bd-src">' + esc(screen.lhaProvenance) + '</p></article>'
      + '<article><h2>Open market</h2><p>ONS rents are not in the file.</p><ul>' + screen.rates.map((bed) => '<li><span>' + esc(bed.label) + '</span><b>' + esc(rateCell(bed, 'omr')) + '</b></li>').join('') + '</ul><button type="button" class="btn sec" data-go="records/position">Enter rents</button></article>'
      + '<article><h2>Gap</h2><p>Open market minus the reference LHA.</p><ul>' + screen.rates.map((bed) => '<li><span>' + esc(bed.label) + '</span><b>' + esc(rateCell(bed, 'gap')) + '</b></li>').join('') + '</ul><p>Targets this gap implies: <b>' + (screen.portfolio.targets == null ? 'Not yet recorded' : screen.portfolio.targets) + '</b></p></article>'
      + '</section>'
      + '<section class="bd-bottom"><article><h2>Portfolio</h2><div class="bd-counts"><span><b>' + (screen.portfolio.deals == null ? 'Not yet recorded' : screen.portfolio.deals) + '</b> deals executed</span><span><b>' + (screen.portfolio.held == null ? 'Not yet recorded' : screen.portfolio.held) + '</b> properties held</span><span><b>' + screen.portfolio.operators + '</b> operators on frameworks</span></div>' + bars(screen.ranked) + '</article>'
      + '<article class="bd-health"><h2>Region health</h2><ul>' + screen.lights.map((item) => '<li class="bd-' + item.tone + '"><b>' + esc(item.label) + '</b><span>' + esc(item.detail) + '</span></li>').join('') + '</ul><p class="bd-verdict">' + esc(screen.verdict) + '</p></article></section>'
      + drill(open)
      + '</div>';
    const region = host.querySelector('#bd-region');
    if (region) region.onchange = () => hooks.onRegion && hooks.onRegion(region.value);
    const present = host.querySelector('#bd-present');
    if (present) present.onclick = () => hooks.onPresent && hooks.onPresent();
    host.querySelectorAll('[data-go]').forEach((button) => button.onclick = () => hooks.onGo && hooks.onGo(button.dataset.go));
    host.querySelectorAll('[data-id]').forEach((button) => button.onclick = () => hooks.onSelect && hooks.onSelect(button.dataset.id));
    const back = host.querySelector('#bd-back');
    if (back) back.onclick = () => hooks.onSelect && hooks.onSelect('');
  }
  function positionForm(host, regionId, saved, onSave) {
    const row = (saved && saved[regionId]) || {dealsExecuted: null, propertiesHeld: null, targets: null, omr: {}};
    const omr = row.omr || {};
    const field = (key, label, value) => '<label>' + label + '<input data-k="' + key + '" inputmode="decimal" value="' + esc(value == null ? '' : value) + '" placeholder="Not yet recorded"></label>';
    host.innerHTML = '<div class="an-start"><p class="bd-kicker">Records</p><h1>Position sheet</h1><p>Enter only a figure you have. A blank stays Not yet recorded on the boardroom. This stays in this browser.</p><p><button type="button" class="btn sec" id="pos-back">Back to the boardroom</button></p></div><form class="bd-form" id="pos-form">'
      + field('deals', 'Deals executed', row.dealsExecuted)
      + field('held', 'Properties held', row.propertiesHeld)
      + field('targets', 'Acquisition targets implied', row.targets)
      + '<h2>Open market rent, £ a month</h2><p>Source, if you have one. ONS is not already in the file.</p>'
      + field('source', 'Source', omr.source || '')
      + field('shared', 'HMO / shared', omr.shared)
      + field('1', '1 bed', omr['1'])
      + field('2', '2 bed', omr['2'])
      + field('3', '3 bed', omr['3'])
      + field('4', '4 bed', omr['4'])
      + '<button class="btn" type="submit">Save to this browser</button><p id="pos-msg" role="status"></p></form>';
    host.querySelector('#pos-back').onclick = () => onSave(null);
    host.querySelector('#pos-form').onsubmit = (event) => {
      event.preventDefault();
      const read = (key) => host.querySelector('[data-k="' + key + '"]').value.trim();
      const numberOrNull = (key) => { const value = read(key); if (value === '') return null; const number = Number(value); return Number.isFinite(number) ? number : null; };
      onSave({
        dealsExecuted: numberOrNull('deals'),
        propertiesHeld: numberOrNull('held'),
        targets: numberOrNull('targets'),
        omr: {source: read('source'), observedAt: new Date().toISOString().slice(0, 10), shared: numberOrNull('shared'), '1': numberOrNull('1'), '2': numberOrNull('2'), '3': numberOrNull('3'), '4': numberOrNull('4')}
      });
      host.querySelector('#pos-msg').textContent = 'Saved. The boardroom will use these figures.';
    };
  }
  root.BoardroomUI = {render, positionForm};
})(typeof window !== 'undefined' ? window : globalThis);
