/* SVG and HTML charts. Tables stay behind Show detail. */
(function (root) {
  'use strict';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));
  function money(value) {
    return new Intl.NumberFormat('en-GB', {style: 'currency', currency: 'GBP', maximumFractionDigits: 0}).format(value);
  }
  function pos(iso, min, max) {
    const a = Date.parse(min);
    const b = Date.parse(max);
    const t = Date.parse(iso);
    if (!Number.isFinite(t) || b === a) return 0;
    return Math.max(0, Math.min(100, (t - a) / (b - a) * 100));
  }
  function heatmap(pack) {
    const head = '<tr><th>Area</th><th>1 bed</th><th>2 bed</th><th>3 bed</th><th>4 bed</th></tr>';
    const body = pack.heatmap.map((row) => '<tr><th><button type="button" data-an-region="' + esc(row.id) + '">' + esc(row.label) + '</button></th>' + row.cells.map((cell) => '<td class="bd-gap ' + esc(cell.band) + '" title="' + esc(cell.title) + '">' + esc(cell.text) + '</td>').join('') + '</tr>').join('');
    return '<section class="bd-rent an-pack"><h2>LHA gap by area</h2><p class="bd-src">Gap percent is LHA minus the ONS open market rent. Under 10% is green, 10 to 25% is amber, over 25% is red. n/a means one side is not recorded. Shared rooms have no ONS series.</p><table class="hm-table"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></section>';
  }
  function gapBars(pack) {
    const rows = pack.gaps.filter((row) => row.pounds != null);
    if (!rows.length) return '<section class="bd-targets an-pack"><h2>Widest LHA gap</h2><p class="is-blank">Not yet recorded</p></section>';
    const max = Math.max(...rows.map((row) => row.pounds));
    const bars = rows.map((row) => '<button type="button" class="bd-bed" data-an-region="' + esc(row.id) + '"><span>' + esc(row.label) + '<small>' + esc(row.bed) + '</small></span><i><b class="bd-gap ' + esc(row.band) + '" style="width:' + Math.round(row.pounds / max * 100) + '%"></b></i><em>' + esc(money(row.pounds)) + '</em></button>').join('');
    return '<section class="bd-targets an-pack"><h2>Widest LHA gap</h2><p class="bd-src">Each bar is the largest absolute gap in that area. Areas without both figures are omitted.</p><div class="bd-beds">' + bars + '</div></section>';
  }
  function gantt(pack) {
    const chart = pack.gantt;
    if (!chart.rows.length) return '<section class="bd-targets an-pack"><h2>Contract timeline</h2><p class="is-blank">No firm start or end is recorded in this area.</p></section>';
    const today = pos(chart.today, chart.min, chart.max);
    const rows = chart.rows.map((row) => {
      const start = row.start ? pos(row.start, chart.min, chart.max) : (row.end ? pos(row.end, chart.min, chart.max) : 0);
      const end = row.end ? pos(row.end, chart.min, chart.max) : start + 2;
      const left = Math.min(start, end);
      const width = Math.max(2, Math.abs(end - start));
      return '<div class="an-gantt-row"><span>' + esc(row.name) + '</span><svg viewBox="0 0 100 16" preserveAspectRatio="none"><line x1="' + today + '" y1="0" x2="' + today + '" y2="16" stroke="#1f4d3a"/><rect x="' + left + '" y="4" width="' + width + '" height="8" rx="2" fill="#3d6b4f"><title>' + esc(row.status) + '</title></rect></svg></div>';
    }).join('');
    return '<section class="bd-targets an-pack"><h2>Contract timeline</h2><p class="bd-src">Firm dates only. The green line is today. The first 12 dated schemes are drawn. The rest stay in Show detail.</p>' + rows + '</section>';
  }
  function donut(pack) {
    const t = pack.targets;
    if (t.below == null) return '<section class="bd-targets an-pack"><h2>Acquisition targets</h2><p class="is-blank">' + esc(t.note) + '</p></section>';
    const parts = [{n: t.below, colour: '#1f7a4d', label: 'Below'}, {n: t.above, colour: '#a33b3b', label: 'Above'}, {n: t.untested, colour: '#c5ced6', label: 'Not testable'}];
    const total = parts.reduce((sum, part) => sum + part.n, 0);
    let angle = -Math.PI / 2;
    const paths = parts.map((part) => {
      if (!part.n || !total) return '';
      const sweep = part.n / total * Math.PI * 2;
      const x1 = 50 + 36 * Math.cos(angle);
      const y1 = 50 + 36 * Math.sin(angle);
      angle += sweep;
      const x2 = 50 + 36 * Math.cos(angle);
      const y2 = 50 + 36 * Math.sin(angle);
      if (part.n === total) return '<circle cx="50" cy="50" r="36" fill="' + part.colour + '"/>';
      const large = sweep > Math.PI ? 1 : 0;
      return '<path d="M50 50 L' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' A36 36 0 ' + large + ' 1 ' + x2.toFixed(2) + ' ' + y2.toFixed(2) + ' Z" fill="' + part.colour + '"/>';
    }).join('');
    const legend = parts.map((part) => '<span><i style="background:' + part.colour + '"></i>' + part.label + ' ' + part.n + '</span>').join('');
    return '<section class="bd-targets an-pack"><h2>Acquisition targets</h2><div class="an-donut-wrap"><svg viewBox="0 0 100 100" class="an-donut">' + paths + '<circle cx="50" cy="50" r="20" fill="#fff"/></svg><div class="bd-legend">' + legend + '</div></div><p class="bd-src">' + esc(t.note) + '</p></section>';
  }
  function bubbles(pack) {
    if (!pack.demand.length) return '<section class="bd-targets an-pack"><h2>Demand signals</h2><p class="is-blank">Not yet recorded</p></section>';
    const max = Math.max(1, ...pack.demand.map((row) => row.units || 0));
    const marks = pack.demand.map((row, index) => {
      const r = row.units ? 8 + (row.units / max) * 28 : 8;
      const cx = 30 + index * (pack.demand.length > 1 ? 220 / (pack.demand.length - 1) : 110);
      return '<g><circle cx="' + cx + '" cy="70" r="' + r.toFixed(1) + '" fill="' + (row.unverified ? 'none' : '#1f4d3a') + '" stroke="#1f4d3a" stroke-dasharray="' + (row.unverified ? '3 2' : '0') + '"/><text x="' + cx + '" y="118" text-anchor="middle" font-size="11">' + esc(row.name) + '</text><text x="' + cx + '" y="' + (70 - r - 4) + '" text-anchor="middle" font-size="10">' + (row.units ? esc(String(row.units)) : 'n/a') + '</text></g>';
    }).join('');
    return '<section class="bd-targets an-pack"><h2>Demand signals</h2><svg viewBox="0 0 280 130" class="an-bubbles" role="img">' + marks + '</svg><p class="bd-src">Circle size is the stated unit count. A dashed circle is unverified. n/a means no unit count is recorded. This is not a supply comparison.</p><details><summary>Show detail</summary><ul>' + pack.demand.map((row) => '<li>' + esc(row.name) + '. ' + esc(row.note) + (row.units ? '. ' + row.units + ' units stated.' : '. Units not yet recorded.') + (row.unverified ? ' Unverified.' : '') + '</li>').join('') + '</ul></details></section>';
  }
  function concentration(pack) {
    const chart = pack.concentration;
    if (!chart.groups.length) return '<section class="bd-targets an-pack"><h2>Supplier concentration</h2><p class="is-blank">' + esc(chart.note) + '</p></section>';
    const max = Math.max(...chart.groups.map((row) => row.share));
    const bars = chart.groups.map((row) => '<div class="bd-bed"><span>' + esc(row.name) + '</span><i><b style="width:' + Math.round(row.share / max * 100) + '%"></b></i><em>' + row.share + '%</em></div>').join('');
    return '<section class="bd-targets an-pack"><h2>Supplier concentration</h2><p class="bd-src">' + esc(chart.label) + (chart.note ? '. ' + esc(chart.note) : '') + '</p><div class="bd-beds">' + bars + '</div></section>';
  }
  function partners(pack) {
    if (!pack.partners.length) return '<section class="bd-targets an-pack"><h2>Operators named</h2><p class="is-blank">Not yet recorded</p></section>';
    const max = Math.max(...pack.partners.map((row) => row.count));
    const bars = pack.partners.map((row) => '<div class="bd-bed"><span>' + esc(row.name) + '</span><i><b style="width:' + Math.round(row.count / max * 100) + '%"></b></i><em>' + row.count + '</em></div>').join('');
    return '<section class="bd-targets an-pack"><h2>Operators named</h2><p class="bd-src">Count of schemes that name the firm. This is not contract value.</p><div class="bd-beds">' + bars + '</div></section>';
  }
  function kpis(pack) {
    return '<div class="bd-tiles an-pack">' + pack.kpis.map((row) => '<span title="' + esc(row.note) + '"><b>' + esc(row.value) + '</b> ' + esc(row.label) + '</span>').join('') + '</div>';
  }
  function html(pack, focus) {
    const want = focus || ['kpis', 'heatmap', 'gaps', 'gantt', 'donut', 'share', 'concentration', 'bubbles', 'partners'];
    const blocks = {kpis: () => kpis(pack), heatmap: () => heatmap(pack), gaps: () => gapBars(pack), gantt: () => gantt(pack), donut: () => donut(pack), concentration: () => concentration(pack), bubbles: () => bubbles(pack), partners: () => partners(pack)};
    return '<div class="an-pack-wrap">' + want.map((key) => blocks[key] ? blocks[key]() : '').join('') + '</div>';
  }
  function bind(rootNode, onRegion) {
    rootNode.querySelectorAll('[data-an-region]').forEach((button) => button.onclick = () => onRegion && onRegion(button.dataset.anRegion));
  }
  root.AnalyticsUI = Object.freeze({html, bind});
})(typeof window !== 'undefined' ? window : globalThis);
