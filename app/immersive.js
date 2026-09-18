// Immersive viewer: the specimen, full-bleed, with zoom and pan.
//
// A century-scale tree packs 101 annual bands into the sidebar-sized canvas, so a
// single ring is sub-pixel — unreadable and un-hoverable. Here the tree is redrawn
// at the zoomed resolution (never CSS-scaled into blur), so magnification buys real
// detail. Hairlines and year type are pinned to screen size while the wood itself
// scales, which is why zooming in reveals MORE years rather than fatter lines.
(function () {
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const DPR = () => Math.min(window.devicePixelRatio || 1, 2);

  let host, stage, layers, base, over, readoutEl, zoomEl, hintEl, titleEl;
  let hooks = null, open = false;
  let zoom = 1, panX = 0, panY = 0;              // live view state
  let shown = { zoom: 1, panX: 0, panY: 0 };     // state the sharp bitmap was drawn for
  let W = 0, H = 0, baseR = 0, maxZoom = 8, geo = null;
  let settleTimer = 0, raf = 0, hoverYear = null;
  const pointers = new Map();
  let drag = null, pinch = null;

  const tree = () => hooks && hooks.state().tree;
  const centerX = () => W / 2 + panX;
  const centerY = () => H / 2 + panY;

  function limits() {
    const t = tree();
    const rings = t ? t.rings.length : 30;
    // Deep enough that one band of this tree spans ~46px; never less than 6×.
    maxZoom = clamp((46 * rings) / Math.max(80, baseR * 0.945), 6, 26);
  }

  function clampPan() {
    const R = baseR * zoom, mx = W / 2 + R - 40, my = H / 2 + R - 40;
    panX = clamp(panX, -mx, mx);
    panY = clamp(panY, -my, my);
  }

  function measure() {
    W = window.innerWidth; H = window.innerHeight;
    baseR = Math.min(W, H) * 0.44;
    limits();
  }

  function sizeCanvas(c) {
    const dpr = DPR();
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    c.style.width = W + 'px'; c.style.height = H + 'px';
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); return g;
  }

  // Year labels ride one radius out from the pith. At fit-to-screen that rail is
  // the familiar 12 o'clock column; once panning pushes the pith off screen, aim
  // the rail at the viewport instead so the years follow you.
  function labelAngle() {
    const dx = W / 2 - centerX(), dy = H / 2 - centerY();
    return Math.hypot(dx, dy) < Math.min(W, H) * 0.22 ? -Math.PI / 2 : Math.atan2(dy, dx);
  }

  // Sharp render at the current zoom: full resolution, clipped to the viewport.
  function render() {
    const t = tree(); if (!t || !open) return;
    const s = hooks.state(), g = sizeCanvas(base), R = baseR * zoom;
    g.clearRect(0, 0, W, H);
    geo = LivingTrees.drawDetailedRings(g, t, centerX(), centerY(), R, 9999, {
      // Full view always carries year labels: it is the one view with room for them,
      // and without them a reader cannot name a single ring without hovering.
      palette: s.palette, years: true, fibers: true,
      labelPx: 12, labelAngle: labelAngle(), strokeR: Math.min(R, baseR * 1.6),
      clip: { x0: 0, y0: 0, x1: W, y1: H }
    });
    shown = { zoom, panX, panY };
    layers.style.transform = '';
    sizeCanvas(over);
    drawOverlay();
    syncHud();
  }

  // Cheap feedback while a gesture is in flight: transform the already-drawn
  // bitmap, then re-render sharply once the gesture settles.
  function apply() {
    clampPan();
    const k = zoom / shown.zoom;
    layers.style.transform = `translate(${panX - shown.panX * k}px, ${panY - shown.panY * k}px) scale(${k})`;
    syncHud();
    clearTimeout(settleTimer);
    settleTimer = setTimeout(render, 90);
  }

  function trace(g, pts, reverse) {
    const n = pts.length;
    if (reverse) { g.moveTo(pts[n - 1][0], pts[n - 1][1]); for (let i = n - 2; i >= 0; i--) g.lineTo(pts[i][0], pts[i][1]); }
    else { g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < n; i++) g.lineTo(pts[i][0], pts[i][1]); }
  }

  // Highlight lives on its own canvas so hovering never repaints the wood.
  function drawOverlay() {
    const g = over.getContext('2d');
    g.clearRect(0, 0, W, H);
    const year = hoverYear || (hooks && hooks.state().selectedYear);
    if (!year || !geo) return;
    const b = geo.bands.find(x => x.year === year); if (!b) return;
    const cx = W / 2 + shown.panX, cy = H / 2 + shown.panY;
    g.beginPath();
    if (b.outerPts && b.innerPts) { trace(g, b.outerPts); trace(g, b.innerPts, true); }
    else { g.arc(cx, cy, b.r1, 0, Math.PI * 2); g.arc(cx, cy, b.r0, Math.PI * 2, 0, true); }
    g.closePath();
    g.fillStyle = 'rgba(245,215,142,.20)'; g.fill();
    g.strokeStyle = 'rgba(255,232,170,.92)'; g.lineWidth = 2; g.stroke();
  }

  function bandAt(x, y) {
    if (!geo) return null;
    // Hit-test against the bitmap's geometry, corrected for any in-flight gesture.
    const k = shown.zoom / zoom, cx = W / 2 + shown.panX, cy = H / 2 + shown.panY;
    return LivingTrees.detailedRingAt(geo, cx, cy, cx + (x - centerX()) * k, cy + (y - centerY()) * k);
  }

  function pct(x) { return (x * 100).toFixed(1) + '%'; }
  function readout(year) {
    const t = tree(), ring = t && t.rings.find(r => r.year === year);
    if (!ring) { readoutEl.innerHTML = '<span class="imm-dim">hover or arrow-key a ring to inspect it</span>'; return; }
    readoutEl.innerHTML = `<b>${t.id.toUpperCase()} · ${ring.year}${ring.partial ? ' partial' : ''}</b>` +
      `<span>return <i>${ring.ret >= 0 ? '+' : ''}${pct(ring.ret)}</i></span>` +
      `<span>vol <i>${pct(ring.vol)}</i></span>` +
      `<span>max dd <i>${pct(ring.max_dd)}</i></span>`;
  }

  function syncHud() {
    zoomEl.textContent = zoom.toFixed(1) + '×';
    const t = tree();
    if (t) {
      const band = (baseR * zoom * 0.945) / t.rings.length;
      zoomEl.title = `${band.toFixed(1)}px per annual band`;
    }
  }

  function zoomAt(sx, sy, factor) {
    const z0 = zoom, z1 = clamp(z0 * factor, 1, maxZoom);
    if (z1 === z0) return;
    const cx = centerX(), cy = centerY(), k = z1 / z0;
    panX = sx - W / 2 - (sx - cx) * k;
    panY = sy - H / 2 - (sy - cy) * k;
    zoom = z1; apply();
  }

  function reset() { zoom = 1; panX = 0; panY = 0; apply(); }

  function selectYear(year) {
    hoverYear = null;
    if (hooks.selectYear(year)) { readout(year); drawOverlay(); }
  }

  function stepYear(dir) {
    const t = tree(); if (!t) return;
    const years = t.rings.map(r => r.year), cur = hooks.state().selectedYear || hoverYear || years[years.length - 1];
    const i = Math.max(0, years.indexOf(cur));
    selectYear(years[clamp(i + dir, 0, years.length - 1)]);
  }

  function onWheel(e) {
    e.preventDefault();
    // Trackpad pinch arrives as ctrl+wheel; plain wheel is a gentler zoom.
    const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022));
    zoomAt(e.clientX, e.clientY, f);
  }

  function onPointerDown(e) {
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, panX, panY };
      drag = null;
    } else if (pointers.size === 1) {
      drag = { x: e.clientX, y: e.clientY, panX, panY, moved: 0 };
    }
  }

  function onPointerMove(e) {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (!d) return;
      zoom = pinch.zoom; panX = pinch.panX; panY = pinch.panY;   // re-derive from gesture start
      zoomAt(pinch.mx, pinch.my, d / pinch.d);
      return;
    }
    if (drag) {
      drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.x, e.clientY - drag.y));
      panX = drag.panX + (e.clientX - drag.x); panY = drag.panY + (e.clientY - drag.y);
      apply();
      return;
    }
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const b = bandAt(e.clientX, e.clientY), year = b ? b.year : null;
      if (year === hoverYear) return;
      hoverYear = year;
      readout(year || hooks.state().selectedYear);
      drawOverlay();
    });
  }

  function onPointerUp(e) {
    const wasDrag = drag && drag.moved > 4;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!pointers.size) {
      if (drag && !wasDrag) { const b = bandAt(e.clientX, e.clientY); if (b) selectYear(b.year); }
      drag = null;
    }
  }

  // One owner for the F toggle, so a single keydown can't both open and close.
  function onKey(e) {
    const t = e.target.tagName;
    if (t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA') return;
    if (!open) { if (e.key === 'f' || e.key === 'F') { e.preventDefault(); show(); } return; }
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); stepYear(e.key === 'ArrowLeft' ? -1 : 1); return; }
    if (e.key === '0') { e.preventDefault(); reset(); return; }
    if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAt(W / 2, H / 2, 1.4); return; }
    if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomAt(W / 2, H / 2, 1 / 1.4); return; }
    if (e.key === 'f' || e.key === 'F') { e.preventDefault(); close(); }
  }

  function onResize() { if (!open) return; measure(); clampPan(); render(); }

  function show() {
    if (open) return;
    open = true;
    host.hidden = false;
    document.body.classList.add('immersed');
    measure(); zoom = 1; panX = 0; panY = 0;
    const t = tree();
    titleEl.textContent = t ? `${t.name} · ${t.first_year}–${t.last_year} · ${t.rings.length} rings · moneytreeforest.com` : '';
    hoverYear = null;
    readout(hooks.state().selectedYear);
    render();
    hintEl.classList.remove('faded');
    setTimeout(() => hintEl.classList.add('faded'), 5200);
    stage.focus();
    hooks.onChange(true);
  }

  function close() {
    if (!open) return;
    open = false; host.hidden = true;
    document.body.classList.remove('immersed');
    hooks.onChange(false);
  }

  function mount(h) {
    hooks = h;
    host = document.getElementById('immersive');
    stage = document.getElementById('imm-stage');
    layers = document.getElementById('imm-layers');
    base = document.getElementById('imm-canvas');
    over = document.getElementById('imm-overlay');
    readoutEl = document.getElementById('imm-readout');
    zoomEl = document.getElementById('imm-zoom');
    hintEl = document.getElementById('imm-hint');
    titleEl = document.getElementById('imm-title');
    stage.addEventListener('wheel', onWheel, { passive: false });
    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerup', onPointerUp);
    stage.addEventListener('pointercancel', onPointerUp);
    stage.addEventListener('dblclick', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, 1.9); });
    host.querySelector('.imm-controls').addEventListener('click', e => {
      const b = e.target.closest('[data-imm]'); if (!b) return;
      const a = b.dataset.imm;
      if (a === 'in') zoomAt(W / 2, H / 2, 1.4);
      else if (a === 'out') zoomAt(W / 2, H / 2, 1 / 1.4);
      else if (a === 'reset') reset();
      else if (a === 'exit') close();
    });
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
  }

  window.Immersive = {
    mount, open: show, close,
    isOpen: () => open,
    // Palette / year-label / specimen changes from the host page.
    refresh() { if (!open) return; const t = tree(); if (t) titleEl.textContent = `${t.name} · ${t.first_year}–${t.last_year} · ${t.rings.length} rings · moneytreeforest.com`; limits(); render(); readout(hooks.state().selectedYear); },
    syncYear() { if (!open) return; hoverYear = null; readout(hooks.state().selectedYear); drawOverlay(); }
  };
})();
