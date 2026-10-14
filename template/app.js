(function () {
  const fmt = d3.format(','), pct = d3.format('.1%'), sgn = d3.format('+.0%');
  const parse = d3.utcParse('%Y-%m-%d'), iso = d3.utcFormat('%Y-%m-%d');
  const fDay = d3.utcFormat('%b %-d, %Y'), fShort = d3.utcFormat('%b %-d'), fMon = d3.utcFormat('%b %Y');
  const compact = (n) => n >= 10000 ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n) : fmt(n);
  const $ = (s) => document.querySelector(s);
  const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let M = null, src = null, sort = { k: 'n', dir: -1 }, q = '';
  window.ppState = window.ppState || {};

  function model(dl, pk, em) {
    if (M && src === dl) return M;
    src = dl;
    const pkg = new Map(pk.map((p) => [Number(p.package_id), { id: Number(p.package_id), name: String(p.package), cat: String(p.category), code: String(p.code || '') }]));
    const rows = dl.map((r) => { const id = Number(r.package_id); const p = pkg.get(id); return { day: String(r.day).slice(0, 10), id, n: Number(r.downloads), cat: p ? p.cat : 'Unclassified / Test' }; });
    const days = rows.map((r) => r.day);
    const cats = [...new Set([...pkg.values()].map((p) => p.cat))].sort();
    M = { pkg, rows, cats, min: d3.min(days), max: d3.max(days), emails: em.map((e) => String(e.day).slice(0, 10)).sort() };
    return M;
  }
  const P = () => dash.params();
  function range() {
    const p = P();
    let s = p.start || M.min, e = p.end || M.max;
    if (s > e) [s, e] = [e, s];
    const L = d3.utcDay.count(parse(s), parse(e)) + 1;
    const ps = iso(d3.utcDay.offset(parse(s), -L)), pe = iso(d3.utcDay.offset(parse(s), -1));
    return { s, e, L, ps, pe, cat: p.cat || '' };
  }
  const inR = (r, s, e) => r.day >= s && r.day <= e;

  // ---------- controls ----------
  document.querySelectorAll('#presets button').forEach((b) => b.addEventListener('click', () => {
    if (!M) return;
    const p = b.dataset.p, mx = M.max;
    const v = p === 'all' ? { start: null, end: null } : p === '2026' ? { start: '2026-01-01', end: mx } : p === '2025' ? { start: '2025-01-01', end: '2025-12-31' }
      : p === '90' ? { start: iso(d3.utcDay.offset(parse(mx), -89)), end: mx } : { start: '2026-07-30', end: mx };
    dash.setParams({ ...v, preset: p });
  }));
  const dateIn = (el, key) => {
    el.addEventListener('change', () => { if (el.value && el.validity.valid) dash.setParams({ [key]: el.value, preset: null }); });
    el.addEventListener('blur', () => showDates());
  };
  dateIn($('#f-start'), 'start'); dateIn($('#f-end'), 'end');
  $('#f-cat').addEventListener('change', (e) => dash.setParams({ cat: e.target.value || null }));
  $('#f-reset').addEventListener('click', () => { dash.resetParams(); q = ''; $('#pk-search').value = ''; });
  document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => { dash.setParams({ tab: b.dataset.tab }); dash.setLink(b.dataset.tab); }));
  document.querySelectorAll('#grain button').forEach((b) => b.addEventListener('click', () => dash.setParams({ grain: b.dataset.g })));
  document.querySelectorAll('#cmpmode button').forEach((b) => b.addEventListener('click', () => dash.setParams({ cmp: b.dataset.m })));
  $('#pk-search').addEventListener('input', (e) => { q = e.target.value.toLowerCase(); drawTable(); });
  document.querySelectorAll('#pktable th').forEach((th) => th.querySelector('button').addEventListener('click', () => {
    const k = th.dataset.k; sort = { k, dir: sort.k === k ? -sort.dir : (k === 'package' || k === 'category' ? 1 : -1) }; drawTable();
  }));
  $('#pktable tbody').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-key]'); if (tr) togglePkg(Number(tr.dataset.key)); });
  $('#chips').addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (b) togglePkg(Number(b.dataset.id)); });
  $('#rank').addEventListener('click', (e) => { const b = e.target.closest('button[data-cat]'); if (b) dash.setParams({ cat: P().cat === b.dataset.cat ? null : b.dataset.cat }); });
  function picked() { const v = P().pkgs; return Array.isArray(v) ? v.map(Number) : []; }
  function togglePkg(id) {
    let l = picked();
    if (!l.length) l = (window.ppState.autoPk || []).slice();
    l = l.includes(id) ? l.filter((x) => x !== id) : [...l, id].slice(-6);
    dash.setParams({ pkgs: l.length ? l : [-1] });
  }
  function showDates() {
    if (!M) return;
    const r = range();
    for (const [el, v] of [[$('#f-start'), r.s], [$('#f-end'), r.e]]) if (el !== document.activeElement) { el.value = v; el.min = M.min; el.max = M.max; }
  }
  const press = (sel, attr, val) => document.querySelectorAll(sel).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[attr] === val)));

  // ---------- helpers ----------
  function tipFor(box) { let t = box.querySelector('.pp-tip'); if (!t) { t = document.createElement('div'); t.className = 'pp-tip'; t.hidden = true; box.appendChild(t); } return t; }
  function showTip(t, box, x, y, title, lines) {
    t.replaceChildren();
    const h = document.createElement('div'); h.className = 't'; h.textContent = title; t.appendChild(h);
    for (const l of lines) {
      const r = document.createElement('div'); r.className = 'r';
      if (l.color) { const s = document.createElement('span'); s.className = 'pp-sw'; s.style.background = l.color; r.appendChild(s); }
      const tx = document.createElement('span'); tx.textContent = l.text; r.appendChild(tx); t.appendChild(r);
    }
    t.hidden = false;
    const bw = box.clientWidth, tw = t.offsetWidth;
    t.style.left = Math.max(0, Math.min(bw - tw, x + 12)) + 'px';
    t.style.top = Math.max(0, y - t.offsetHeight - 8) + 'px';
  }
  function measure(svg, texts) {
    const g = svg.append('g').attr('visibility', 'hidden'); let w = 0;
    for (const s of texts) { const t = g.append('text').text(s); w = Math.max(w, t.node().getComputedTextLength()); }
    g.remove(); return w;
  }
  function fail(el, st) {
    el.classList.remove('dash-skeleton');
    if (st === 'error') { el.replaceChildren(); const d = document.createElement('div'); d.className = 'pp-fail'; d.innerHTML = '<i></i>'; d.append('Failed to load'); el.appendChild(d); }
  }
  function grainOf(L) { const g = P().grain || 'auto'; return g !== 'auto' ? g : L <= 120 ? 'day' : L <= 730 ? 'week' : 'month'; }
  const intervals = { day: d3.utcDay, week: d3.utcMonday, month: d3.utcMonth };
  function bins(rs, s, e, grain) {
    const iv = intervals[grain], a = iv.floor(parse(s)), b = parse(e);
    const list = iv.range(a, d3.utcDay.offset(b, 1));
    const map = new Map(list.map((d) => [+d, 0]));
    for (const r of rs) { const k = +iv.floor(parse(r.day)); if (map.has(k)) map.set(k, map.get(k) + r.n); }
    return list.map((d) => ({ d, end: iv.offset(d, 1), n: map.get(+d) }));
  }
  function frame(el, h) {
    el.classList.remove('dash-skeleton');
    const W = Math.max(280, el.clientWidth);
    el.querySelectorAll('svg').forEach((s) => s.remove());
    const svg = d3.select(el).insert('svg', ':first-child').attr('width', '100%').attr('viewBox', `0 0 ${W} ${h}`).attr('height', h);
    return { svg, W, H: h };
  }
  function yAxis(svg, y, W, ml, mr) {
    const ticks = y.ticks(4);
    const g = svg.append('g');
    g.selectAll('line').data(ticks).join('line').attr('x1', ml).attr('x2', W - mr).attr('y1', y).attr('y2', y).attr('stroke', 'var(--cds-chart-grid)');
    g.selectAll('text').data(ticks).join('text').attr('x', ml - 8).attr('y', y).attr('dy', '0.32em').attr('text-anchor', 'end').text((d) => compact(d));
  }
  function xAxis(svg, x, y0, W) {
    const n = Math.max(2, Math.floor(W / 110));
    const ticks = x.ticks(n), f = x.tickFormat(n);
    const g = svg.append('g');
    g.append('line').attr('x1', x.range()[0]).attr('x2', x.range()[1]).attr('y1', y0).attr('y2', y0).attr('stroke', 'var(--cds-chart-axis)');
    g.selectAll('text').data(ticks).join('text').attr('x', x).attr('y', y0 + 16).attr('text-anchor', 'middle').text(f);
  }
  const binLabel = (b, g) => g === 'month' ? fMon(b.d) : g === 'week' ? 'Week of ' + fDay(b.d) : fDay(b.d);

  // ---------- draws ----------
  function drawKpis(rs, prev, r) {
    const total = d3.sum(rs, (d) => d.n), ptotal = d3.sum(prev, (d) => d.n);
    const byDay = d3.rollup(rs, (v) => d3.sum(v, (d) => d.n), (d) => d.day);
    const byPk = d3.rollup(rs, (v) => d3.sum(v, (d) => d.n), (d) => d.id);
    const busy = d3.greatest(byDay, (d) => d[1]), top = d3.greatest(byPk, (d) => d[1]);
    const nPk = r.cat ? [...M.pkg.values()].filter((p) => p.cat === r.cat).length : M.pkg.size;
    const set = (id, v, sub, cls) => { const k = $(id); const val = k.querySelector('.val'); val.classList.remove('dash-skeleton'); val.textContent = v; const s = k.querySelector('.sub'); s.textContent = sub; s.className = 'sub ' + (cls || ''); };
    const hasPrev = r.ps >= M.min || prev.length;
    const ch = ptotal ? (total - ptotal) / ptotal : null;
    set('#k-total', fmt(total), hasPrev && ch !== null ? `${sgn(ch)} vs prior ${fmt(r.L)} days (${fmt(ptotal)})` : 'No earlier data to compare', ch === null ? '' : ch >= 0 ? 'up' : 'down');
    set('#k-pk', fmt(byPk.size), `of ${fmt(nPk)} packages${r.cat ? ' in this category' : ''}`);
    set('#k-avg', byDay.size ? d3.format(',.1f')(total / byDay.size) : '—', `${fmt(byDay.size)} of ${fmt(r.L)} days had downloads`);
    set('#k-busy', busy ? fmt(busy[1]) : '—', busy ? fDay(parse(busy[0])) : 'No downloads');
    set('#k-top', top ? M.pkg.get(top[0]).name : '—', top ? `${fmt(top[1])} downloads` + (M.pkg.get(top[0]).cat !== M.pkg.get(top[0]).name ? ` · ${M.pkg.get(top[0]).cat}` : '') : '');
    const byCat = d3.rollups(rs, (v) => d3.sum(v, (d) => d.n), (d) => d.cat).sort((a, b) => b[1] - a[1]);
    const tk = $('#takeaway'); tk.classList.remove('dash-skeleton');
    tk.textContent = !total ? `No downloads between ${fDay(parse(r.s))} and ${fDay(parse(r.e))}${r.cat ? ' in ' + r.cat : ''}.`
      : `${fmt(total)} downloads from ${fDay(parse(r.s))} to ${fDay(parse(r.e))}${r.cat ? ' in ' + r.cat : ''}` +
        (ch !== null ? `, ${ch >= 0 ? 'up' : 'down'} ${pct(Math.abs(ch))} on the ${fmt(r.L)} days before. ` : '. ') +
        (!r.cat && byCat.length ? `${byCat[0][0]} leads with ${pct(byCat[0][1] / total)} of all downloads.` : `Top package: ${top ? M.pkg.get(top[0]).name : ''}.`);
  }

  function drawTrend(rs, r) {
    const el = $('#chart-trend'), g = grainOf(r.L);
    press('#grain button', 'g', P().grain || 'auto');
    const bs = bins(rs, r.s, r.e, g);
    const { svg, W, H } = frame(el, 280);
    const y = d3.scaleLinear([0, d3.max(bs, (b) => b.n) || 1], [H - 28, 12]).nice();
    const ml = measure(svg, y.ticks(4).map(compact)) + 12, mr = 8;
    const x = d3.scaleUtc([bs[0].d, bs[bs.length - 1].end], [ml, W - mr]);
    yAxis(svg, y, W, ml, mr);
    const ems = M.emails.filter((d) => d >= r.s && d <= r.e);
    svg.append('g').selectAll('line').data(ems).join('line').attr('x1', (d) => x(parse(d))).attr('x2', (d) => x(parse(d))).attr('y1', 8).attr('y2', H - 28)
      .attr('stroke', 'var(--cds-chart-reference)').attr('stroke-dasharray', '3 3');
    const gap = bs.length > 200 ? 0 : 2;
    const bars = svg.append('g').selectAll('rect').data(bs).join('rect')
      .attr('x', (b) => x(b.d) + gap / 2).attr('width', (b) => Math.max(1, x(b.end) - x(b.d) - gap))
      .attr('y', (b) => y(b.n)).attr('height', (b) => Math.max(0, y(0) - y(b.n)))
      .attr('rx', (b) => Math.min(4, (x(b.end) - x(b.d)) / 2)).attr('fill', dash.colors[0]);
    xAxis(svg, x, H - 28, W);
    const t = tipFor(el);
    svg.append('rect').attr('x', ml).attr('y', 0).attr('width', W - ml - mr).attr('height', H - 28).attr('fill', 'transparent')
      .on('pointermove', (ev) => {
        const [px, py] = d3.pointer(ev); const d0 = x.invert(px);
        const b = bs.find((bb) => d0 >= bb.d && d0 < bb.end); if (!b) return;
        bars.attr('opacity', (bb) => bb === b ? 1 : 0.55);
        const em = ems.filter((d) => parse(d) >= b.d && parse(d) < b.end);
        showTip(t, el, px * el.clientWidth / W, py, binLabel(b, g), [{ text: fmt(b.n) + ' downloads' }, ...em.map((d) => ({ text: 'BP e-mail sent ' + fShort(parse(d)) }))]);
      })
      .on('pointerleave', () => { t.hidden = true; bars.attr('opacity', 1); });
    $('#trend-note').textContent = `Downloads per ${g}. ` + (ems.length ? `Dashed lines mark the ${ems.length} BP e-mail send date${ems.length > 1 ? 's' : ''} in this range.` : 'No BP e-mails were sent in this range (last recorded Dec 11, 2023).');
  }

  function lineChart(el, H, series, opts) {
    // series: [{name,color,pts:[{d,n}]}]
    const { svg, W } = frame(el, H);
    const all = series.flatMap((s) => s.pts);
    if (!all.length) return;
    const y = d3.scaleLinear([0, d3.max(all, (p) => p.n) || 1], [H - 28, 12]).nice();
    const ml = measure(svg, y.ticks(4).map(compact)) + 12, mr = 8;
    const x = d3.scaleUtc(d3.extent(all, (p) => p.d), [ml, W - mr]);
    yAxis(svg, y, W, ml, mr);
    const line = d3.line().x((p) => x(p.d)).y((p) => y(p.n));
    if (opts && opts.area && series.length === 1) {
      const id = 'grad-' + el.id;
      const lg = svg.append('defs').append('linearGradient').attr('id', id).attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 1);
      [[0, .26], [.25, .16], [.5, .08], [.75, .03], [1, 0]].forEach(([o, a]) => lg.append('stop').attr('offset', o).attr('style', `stop-color:${series[0].color};stop-opacity:${a}`));
      svg.append('path').datum(series[0].pts).attr('fill', `url(#${id})`).attr('d', d3.area().x((p) => x(p.d)).y0(y(0)).y1((p) => y(p.n)));
    }
    const paths = svg.append('g').selectAll('path').data(series).join('path').attr('fill', 'none').attr('stroke', (s) => s.color)
      .attr('stroke-width', 2).attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round').attr('d', (s) => line(s.pts));
    xAxis(svg, x, H - 28, W);
    const rule = svg.append('line').attr('y1', 12).attr('y2', H - 28).attr('stroke', 'var(--cds-chart-axis)').attr('visibility', 'hidden');
    const dots = svg.append('g').selectAll('circle').data(series).join('circle').attr('r', 4).attr('fill', (s) => s.color).attr('stroke', 'var(--color-panel)').attr('stroke-width', 2).attr('visibility', 'hidden');
    const t = tipFor(el), xs = series[0].pts.map((p) => p.d), bis = d3.bisector((d) => d).center;
    svg.append('rect').attr('x', ml).attr('y', 0).attr('width', W - ml - mr).attr('height', H - 28).attr('fill', 'transparent')
      .on('pointermove', (ev) => {
        const [px, py] = d3.pointer(ev); const i = bis(xs, x.invert(px)); const d = xs[i]; if (!d) return;
        rule.attr('x1', x(d)).attr('x2', x(d)).attr('visibility', 'visible');
        dots.attr('cx', x(d)).attr('cy', (s) => y(s.pts[i] ? s.pts[i].n : 0)).attr('visibility', 'visible');
        showTip(t, el, px * el.clientWidth / W, py, opts.label(d), series.map((s) => ({ color: series.length > 1 ? s.color : null, text: (series.length > 1 ? s.name + ': ' : '') + fmt(s.pts[i] ? s.pts[i].n : 0) })));
      })
      .on('pointerleave', () => { t.hidden = true; rule.attr('visibility', 'hidden'); dots.attr('visibility', 'hidden'); });
  }

  function drawCum(rs, r) {
    const bs = bins(rs, r.s, r.e, 'day'); let c = 0;
    const pts = bs.map((b) => ({ d: b.d, n: (c += b.n) }));
    lineChart($('#chart-cum'), 220, [{ name: 'Running total', color: dash.colors[0], pts }], { area: true, label: (d) => fDay(d) });
  }

  function legend(el, series) {
    let lg = el.querySelector('.pp-chips'); if (!lg) { lg = document.createElement('div'); lg.className = 'pp-chips'; el.appendChild(lg); }
    lg.replaceChildren(...series.map((s) => { const sp = document.createElement('span'); sp.className = 'pp-chip'; sp.style.cursor = 'default'; const w = document.createElement('span'); w.className = 'pp-sw'; w.style.background = s.color; const l = document.createElement('span'); l.className = 'l'; l.textContent = s.name; sp.append(w, l); return sp; }));
  }

  function drawCategories(rs, prev, r) {
    const cur = d3.rollup(rs.filter(() => true), (v) => d3.sum(v, (d) => d.n), (d) => d.cat);
    const pv = d3.rollup(prev, (v) => d3.sum(v, (d) => d.n), (d) => d.cat);
    const total = d3.sum(cur.values()) || 1;
    const list = M.cats.map((c) => ({ c, n: cur.get(c) || 0, p: pv.get(c) || 0 })).sort((a, b) => b.n - a.n || b.p - a.p);
    const mx = d3.max(list, (d) => Math.max(d.n, d.p)) || 1;
    const box = $('#rank'); box.replaceChildren();
    for (const d of list) {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.cat = d.c; b.setAttribute('aria-pressed', String(r.cat === d.c));
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = d.c; nm.title = d.c;
      const bars = document.createElement('span'); bars.className = 'pp-bars';
      const b1 = document.createElement('span'); b1.className = 'pp-bar'; b1.style.width = (100 * d.n / mx) + '%'; b1.style.background = dash.colors[0];
      const b2 = document.createElement('span'); b2.className = 'pp-bar prev'; b2.style.width = (100 * d.p / mx) + '%';
      bars.append(b1, b2);
      const nums = document.createElement('span'); nums.className = 'nums';
      const ch = d.p ? (d.n - d.p) / d.p : null;
      nums.textContent = `${fmt(d.n)} · ${pct(d.n / total)}`;
      if (ch !== null) { const c = document.createElement('span'); c.className = ch >= 0 ? 'up' : 'down'; c.textContent = ' ' + sgn(ch); nums.appendChild(c); }
      b.title = `${d.c}: ${fmt(d.n)} in range, ${fmt(d.p)} in prior ${fmt(r.L)} days`;
      b.append(nm, bars, nums); box.appendChild(b);
    }
    // category x year
    const allR = M.rows.filter((x) => inR(x, r.s, r.e));
    const years = [...new Set(allR.map((x) => x.day.slice(0, 4)))].sort();
    const cy = d3.rollup(allR, (v) => d3.sum(v, (d) => d.n), (d) => d.cat, (d) => d.day.slice(0, 4));
    const hmax = d3.max([...cy.values()].flatMap((m) => [...m.values()])) || 1;
    const hb = $('#catyear'); hb.replaceChildren();
    hb.style.gridTemplateColumns = `minmax(10rem,2.4fr) repeat(${years.length},minmax(2.8rem,1fr))`;
    const add = (cls, txt, st) => { const d = document.createElement('div'); d.className = cls; d.textContent = txt; if (st) Object.assign(d.style, st); hb.appendChild(d); return d; };
    add('h', ''); years.forEach((yv) => add('h', yv, { justifyContent: 'center' }));
    const order = [...cy.keys()].sort((a, b) => d3.sum(cy.get(b).values()) - d3.sum(cy.get(a).values()));
    for (const c of order) {
      const h = add('h', c, { overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontWeight: c === r.cat ? '600' : '' }); h.title = c;
      years.forEach((yv) => { const n = cy.get(c).get(yv) || 0; const cell = add('c', n ? compact(n) : '', { background: n ? `color-mix(in srgb, ${dash.colors[0]} ${Math.round(8 + 50 * n / hmax)}%, transparent)` : 'color-mix(in srgb, var(--color-fg) 3%, transparent)' }); cell.title = `${c}, ${yv}: ${fmt(n)}`; });
    }
    // top categories over time
    const top = list.filter((d) => d.n > 0).slice(0, 6).map((d) => d.c);
    const g = r.L <= 120 ? 'week' : 'month';
    const series = top.map((c, i) => ({ name: c, color: dash.colors[i], pts: bins(allR.filter((x) => x.cat === c), r.s, r.e, g).map((b) => ({ d: b.d, n: b.n })) }));
    const el = $('#chart-catline');
    if (series.length) { lineChart(el, 280, series, { label: (d) => g === 'month' ? fMon(d) : 'Week of ' + fDay(d) }); legend(el, series); }
    else { el.classList.remove('dash-skeleton'); el.replaceChildren(); }
    el.parentElement.querySelector('.muted').textContent = `The ${series.length} largest categories in the range, per ${g}${r.cat ? ' (ignores the category filter so you can compare)' : ''}.`;
  }

  function pkRows(rs, prev) {
    const cur = d3.rollup(rs, (v) => d3.sum(v, (d) => d.n), (d) => d.id), pv = d3.rollup(prev, (v) => d3.sum(v, (d) => d.n), (d) => d.id);
    const total = d3.sum(cur.values()) || 1, cat = P().cat || '';
    return [...M.pkg.values()].filter((p) => !cat || p.cat === cat).map((p) => {
      const n = cur.get(p.id) || 0, pr = pv.get(p.id) || 0;
      return { id: p.id, package: p.name, category: p.cat, n, share: n / total, prev: pr, chg: pr ? (n - pr) / pr : null };
    });
  }
  function drawTable() {
    if (!window.ppState.pk) return;
    const sel = new Set(window.ppState.sel || []);
    let rows = window.ppState.pk.filter((d) => !q || d.package.toLowerCase().includes(q) || d.category.toLowerCase().includes(q));
    const k = sort.k, dir = sort.dir;
    rows.sort((a, b) => { const x = a[k], y = b[k]; if (x === null) return 1; if (y === null) return -1; return (typeof x === 'string' ? x.localeCompare(y) : x - y) * dir; });
    document.querySelectorAll('#pktable th').forEach((th) => th.setAttribute('aria-sort', th.dataset.k === k ? (dir > 0 ? 'ascending' : 'descending') : 'none'));
    const tb = $('#pktable tbody'); tb.replaceChildren();
    for (const d of rows) {
      const tr = document.createElement('tr'); tr.dataset.key = d.id; if (sel.has(d.id)) tr.className = 'sel';
      const cells = [[d.package], [d.category], [fmt(d.n), 'n'], [pct(d.share), 'n'], [fmt(d.prev), 'n'], [d.chg === null ? '—' : sgn(d.chg), 'n ' + (d.chg === null ? '' : d.chg >= 0 ? 'up' : 'down')]];
      for (const [txt, cls] of cells) { const td = document.createElement('td'); td.textContent = txt; if (cls) td.className = cls; tr.appendChild(td); }
      tb.appendChild(tr);
    }
  }
  function drawPackages(rs, prev, r) {
    const pk = pkRows(rs, prev); window.ppState.pk = pk;
    const auto = pk.slice().sort((a, b) => b.n - a.n).slice(0, 3).map((d) => d.id); window.ppState.autoPk = auto;
    let sel = picked().filter((id) => M.pkg.has(id)); const isAuto = !picked().length;
    if (isAuto) sel = auto;
    window.ppState.sel = sel;
    const mode = P().cmp || 'period'; press('#cmpmode button', 'm', mode);
    const g = grainOf(r.L) === 'day' && r.L > 60 ? 'week' : grainOf(r.L);
    const allR = M.rows.filter((x) => inR(x, r.s, r.e));
    const series = sel.map((id, i) => {
      let bs = bins(allR.filter((x) => x.id === id), r.s, r.e, g).map((b) => ({ d: b.d, n: b.n }));
      if (mode === 'cum') { let c = 0; bs = bs.map((b) => ({ d: b.d, n: (c += b.n) })); }
      return { name: M.pkg.get(id).name, color: dash.colors[i], pts: bs, id };
    });
    const chips = $('#chips'); chips.replaceChildren();
    series.forEach((s) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'pp-chip'; b.dataset.id = s.id; b.setAttribute('aria-label', 'Remove ' + s.name); const w = document.createElement('span'); w.className = 'pp-sw'; w.style.background = s.color; const l = document.createElement('span'); l.className = 'l'; l.textContent = s.name; b.append(w, l, document.createTextNode('×')); chips.appendChild(b); });
    $('#cmp-note').textContent = (isAuto ? 'Showing the top 3 packages in this range. ' : '') + `Downloads per ${g}${mode === 'cum' ? ', added up over the range' : ''}. Pick up to six packages from the table below.`;
    const el = $('#chart-cmp');
    if (series.length) lineChart(el, 300, series, { label: (d) => g === 'month' ? fMon(d) : g === 'week' ? 'Week of ' + fDay(d) : fDay(d) });
    else { el.classList.remove('dash-skeleton'); el.querySelectorAll('svg').forEach((s) => s.remove()); }
    drawTable();
  }

  function drawPatterns(rs, r) {
    // weekday
    const days = d3.utcDay.range(parse(r.s), d3.utcDay.offset(parse(r.e), 1));
    const cnt = Array(7).fill(0), sum = Array(7).fill(0);
    days.forEach((d) => cnt[(d.getUTCDay() + 6) % 7]++);
    rs.forEach((x) => { sum[(parse(x.day).getUTCDay() + 6) % 7] += x.n; });
    const avg = sum.map((s, i) => cnt[i] ? s / cnt[i] : 0), mx = d3.max(avg) || 1;
    const wb = $('#weekday'); wb.replaceChildren();
    avg.forEach((a, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.style.cursor = 'default'; b.tabIndex = -1;
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = WD[i];
      const bars = document.createElement('span'); bars.className = 'pp-bars'; const b1 = document.createElement('span'); b1.className = 'pp-bar'; b1.style.width = (100 * a / mx) + '%'; b1.style.background = a === mx ? dash.colors[0] : 'var(--cds-chart-muted)'; bars.appendChild(b1);
      const nums = document.createElement('span'); nums.className = 'nums'; nums.textContent = d3.format(',.1f')(a) + ' / day';
      b.append(nm, bars, nums); wb.appendChild(b);
    });
    // email effect
    const eb = $('#email'); eb.replaceChildren();
    const first = M.emails[0], last = iso(d3.utcDay.offset(parse(M.emails[M.emails.length - 1]), 7));
    const s = r.s > first ? r.s : first, e = r.e < last ? r.e : last;
    if (s > e) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'No BP e-mails fall in this range. E-mails were recorded from Dec 20, 2021 to Dec 11, 2023; widen the dates to compare.'; eb.appendChild(p); return; }
    const near = new Set();
    M.emails.forEach((d) => { for (let k = 0; k <= 7; k++) near.add(iso(d3.utcDay.offset(parse(d), k))); });
    const byDay = d3.rollup(rs.filter((x) => x.day >= s && x.day <= e), (v) => d3.sum(v, (d) => d.n), (d) => d.day);
    let nIn = 0, dIn = 0, nOut = 0, dOut = 0;
    d3.utcDay.range(parse(s), d3.utcDay.offset(parse(e), 1)).forEach((d) => { const k = iso(d), v = byDay.get(k) || 0; if (near.has(k)) { nIn += v; dIn++; } else { nOut += v; dOut++; } });
    const a1 = dIn ? nIn / dIn : 0, a2 = dOut ? nOut / dOut : 0;
    const box = (lab, v, sub) => { const d = document.createElement('div'); const l = document.createElement('div'); l.className = 'muted'; l.textContent = lab; const n = document.createElement('div'); n.className = 'val'; n.textContent = d3.format(',.1f')(v); const sb = document.createElement('div'); sb.className = 'muted'; sb.textContent = sub; d.append(l, n, sb); return d; };
    eb.append(box('0–7 days after an e-mail', a1, `${fmt(dIn)} days, ${fmt(nIn)} downloads`), box('All other days', a2, `${fmt(dOut)} days, ${fmt(nOut)} downloads`));
    const p = document.createElement('p'); p.style.gridColumn = '1/-1';
    p.textContent = a2 ? `Days right after an e-mail average ${d3.format('.1f')(a1 / a2)}× the downloads of other days (${fDay(parse(s))} to ${fDay(parse(e))}${r.cat ? ', ' + r.cat : ''}).` : '';
    eb.appendChild(p);
    // heatmap
    const hb = $('#heat'); hb.replaceChildren();
    const ym = d3.rollup(rs, (v) => d3.sum(v, (d) => d.n), (d) => d.day.slice(0, 4), (d) => +d.day.slice(5, 7));
    const years = [...ym.keys()].sort(); const hmax = d3.max([...ym.values()].flatMap((m) => [...m.values()])) || 1;
    hb.style.gridTemplateColumns = `3.5rem repeat(12,minmax(2.6rem,1fr))`;
    const add = (cls, txt, st) => { const d = document.createElement('div'); d.className = cls; d.textContent = txt; if (st) Object.assign(d.style, st); hb.appendChild(d); return d; };
    add('h', ''); MON.forEach((m) => add('h', m, { justifyContent: 'center' }));
    years.forEach((yv) => { add('h', yv); for (let m = 1; m <= 12; m++) { const n = ym.get(yv).get(m) || 0; const c = add('c', n ? compact(n) : '', { background: n ? `color-mix(in srgb, ${dash.colors[0]} ${Math.round(8 + 50 * n / hmax)}%, transparent)` : 'color-mix(in srgb, var(--color-fg) 3%, transparent)' }); c.title = `${MON[m - 1]} ${yv}: ${fmt(n)} downloads`; } });
  }

  // ---------- main ----------
  dash.onData(() => {
    const a = dash.data('downloads'), b = dash.data('packages'), c = dash.data('emails');
    const st = [a, b, c].find((x) => x.status !== 'ok');
    if (st) { if (st.status === 'error') ['#chart-trend', '#chart-cum', '#chart-cmp', '#chart-catline'].forEach((s) => fail($(s), 'error')); return; }
    model(a.data, b.data, c.data);
    const p = P(), r = range();
    // controls
    const sel = $('#f-cat');
    if (sel.options.length !== M.cats.length + 1) sel.replaceChildren(new Option('All categories', ''), ...M.cats.map((x) => new Option(x, x)));
    sel.value = r.cat; showDates(); press('#presets button', 'p', p.preset || (p.start || p.end ? '' : 'all'));
    const tab = ['trend', 'categories', 'packages', 'patterns'].includes(p.tab) ? p.tab : 'trend';
    document.querySelectorAll('#tabs button').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === tab)));
    ['trend', 'categories', 'packages', 'patterns'].forEach((id) => { $('#' + id).hidden = id !== tab; });
    const keep = (x) => !r.cat || x.cat === r.cat;
    const rs = M.rows.filter((x) => inR(x, r.s, r.e) && keep(x));
    const prev = M.rows.filter((x) => inR(x, r.ps, r.pe) && keep(x));
    drawKpis(rs, prev, r);
    if (tab === 'trend') { drawTrend(rs, r); drawCum(rs, r); }
    if (tab === 'categories') drawCategories(M.rows.filter((x) => inR(x, r.s, r.e)), M.rows.filter((x) => inR(x, r.ps, r.pe)), r);
    if (tab === 'packages') drawPackages(rs, prev, r);
    if (tab === 'patterns') drawPatterns(rs, r);
    if (!window.ppState.linked) { window.ppState.linked = true; const h = location.hash.slice(1); if (['trend', 'categories', 'packages', 'patterns'].includes(h) && h !== tab) dash.setParams({ tab: h }); }
  });
})();
