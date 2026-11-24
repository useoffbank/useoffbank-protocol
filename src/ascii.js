// ASCII canvas: port of the reference hero logic (12px cells, glyph ramp, 24 colour buckets,
// pointer glow, click ripples, idle ripples, shimmer, 33ms frame cap, pause off-screen, DPR cap 1.25).
// Source bitmap is the brand mark (alpha channel = intensity). Ramp colours are read from tokens.css vars.
const GLYPHS = ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$';

function tokenRGB(name) {
  const probe = document.createElement('i');
  probe.style.color = `var(${name})`; probe.style.display = 'none';
  document.body.appendChild(probe);
  const c = getComputedStyle(probe).color; probe.remove();
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.fillStyle = c; g.fillRect(0, 0, 1, 1);
  const d = g.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]];
}

export function asciiCanvas(canvas, { src, interact, baseGain = 0.92, scale = 1, offsetY = 0, clear }) {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stops = [[0, tokenRGB('--line-2')], [0.35, tokenRGB('--c-orange-3')], [0.7, tokenRGB('--c-orange')], [1, tokenRGB('--c-orange-d')]];
  const mono = getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim() || 'monospace';
  const colorAt = (t) => {
    for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) {
      const [a, A] = stops[i - 1], [b, B] = stops[i], k = (t - a) / (b - a);
      return `rgb(${Math.round(A[0] + (B[0] - A[0]) * k)},${Math.round(A[1] + (B[1] - A[1]) * k)},${Math.round(A[2] + (B[2] - A[2]) * k)})`;
    }
    return `rgb(${stops[3][1].join(',')})`;
  };
  const ramp = Array.from({ length: 24 }, (_, i) => colorAt(i / 23));

  let W = 0, H = 0, cols = 0, rows = 0, cw = 7.2, field = new Float32Array(0), phase = new Float32Array(0), jitter = new Uint8Array(0);
  let bmp = null, bw = 0, bh = 0, raf = 0, onScreen = true, lastT = 0, lastMove = 0, lastDrag = 0, lastIdle = 0;
  const ptr = { x: -9999, y: -9999, tx: -9999, ty: -9999, active: false }, ripples = [];

  const sample = () => {
    if (!bmp) return;
    field = new Float32Array(cols * rows);
    const aspect = cols * cw / (12 * rows), ia = bw / bh;
    let sw = bw, sh = bh, ox = 0, oy = 0;
    if (aspect > ia) { sh = bw / aspect; oy = (bh - sh) / 2; } else { sw = bh * aspect; ox = (bw - sw) / 2; }
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const u = 0.5 + ((x + 0.5) / cols - 0.5) / scale, v = 0.5 + ((y + 0.5) / rows - 0.5 - offsetY) / scale;
      if (u < 0 || u > 1 || v < 0 || v > 1) { field[y * cols + x] = 0; continue; }
      const px = Math.min(bw - 1, Math.floor(ox + u * sw)), py = Math.min(bh - 1, Math.floor(oy + v * sh));
      field[y * cols + x] = bmp[(py * bw + px) * 4 + 3] / 255;
    }
  };
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 1.25), r = canvas.getBoundingClientRect();
    W = r.width; H = r.height; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.font = `12px ${mono}`; ctx.textBaseline = 'top';
    cw = ctx.measureText('M').width || 7.2; cols = Math.ceil(W / cw); rows = Math.ceil(H / 12);
    phase = new Float32Array(cols * rows).map(() => Math.random() * Math.PI * 2); jitter = new Uint8Array(cols * rows); sample();
  };
  const draw = (ms) => {
    ctx.clearRect(0, 0, W, H);
    const t = ms / 1000; ptr.x += (ptr.tx - ptr.x) * 0.25; ptr.y += (ptr.ty - ptr.y) * 0.25;
    for (let i = ripples.length - 1; i >= 0; i--) if (t - ripples[i].t > 2.4) ripples.splice(i, 1);
    const radius = Math.max(110, 0.11 * Math.min(W, 1440)), hole = clear ? clear(W) : null;
    const buckets = Array.from({ length: 24 }, () => []), n = cols * rows;
    if (field.length !== n) return;
    for (let i = 0; i < n; i++) {
      const cx = (i % cols) * cw + cw / 2, cy = ((i / cols) | 0) * 12 + 6;
      let d = field[i] * baseGain; if (!(d >= 0)) continue;
      d += 0.035 * Math.sin(1.6 * t + phase[i]);
      let glow = 0;
      if (ptr.active) { const dx = cx - ptr.x, dy = cy - ptr.y, q = (dx * dx + dy * dy) / (radius * radius); if (q < 4) glow = Math.exp(-1.6 * q); }
      let wave = 0;
      for (const rp of ripples) {
        const age = t - rp.t, rr = 420 * age, dx = cx - rp.x, dy = cy - rp.y;
        if (Math.abs(dx) > rr + 80 || Math.abs(dy) > rr + 80) continue;
        const q = (Math.sqrt(dx * dx + dy * dy) - rr) / 26;
        if (q > -3 && q < 3) wave += Math.exp(-q * q) * rp.s * Math.max(0, 1 - age / 2.4);
      }
      let keep = 1;
      if (hole) { const ex = (cx - hole.cx) / hole.rx, ey = (cy - hole.cy) / hole.ry, a = Math.min(1, Math.max(0, (Math.sqrt(ex * ex + ey * ey) - 0.7) / 0.45)); keep = 0.12 + 0.88 * a * a * (3 - 2 * a); }
      d = d * keep + (0.5 * glow + 0.4 * wave) * (0.2 + 0.8 * keep);
      if (d < 0.06) continue; if (d > 1) d = 1;
      let g = Math.min(GLYPHS.length - 1, Math.max(1, Math.round(d * (GLYPHS.length - 1) * 0.9)));
      if (glow > 0.25 || wave > 0.3) { if (Math.random() < 0.35) jitter[i] = Math.min(GLYPHS.length - 1, g + (9 * Math.random() | 0) - 4); g = jitter[i] || g; } else jitter[i] = 0;
      buckets[Math.min(23, Math.round(23 * Math.min(1, 0.85 * d + 0.5 * glow + 0.3 * wave)))].push(i, g);
    }
    for (let b = 0; b < 24; b++) {
      const list = buckets[b]; if (!list.length) continue; ctx.fillStyle = ramp[b];
      for (let k = 0; k < list.length; k += 2) { const i = list[k]; ctx.fillText(GLYPHS[list[k + 1]], (i % cols) * cw, ((i / cols) | 0) * 12); }
    }
  };
  const frame = (ms) => {
    if (onScreen && !reduced) raf = requestAnimationFrame(frame);
    if (ms - lastT < 33) return; lastT = ms; const t = ms / 1000;
    if (!reduced && t - lastMove > 3.5 && t - lastIdle > 4.2 && W > 0) { lastIdle = t; ripples.push({ x: W * (0.3 + 0.4 * Math.random()), y: H * (0.35 + 0.35 * Math.random()), t, s: 0.7 }); }
    draw(ms);
  };
  const rel = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const onMove = (e) => { const p = rel(e), t = performance.now() / 1000; if (!ptr.active) { ptr.x = p.x; ptr.y = p.y; } const dist = Math.hypot(p.x - ptr.tx, p.y - ptr.ty); ptr.tx = p.x; ptr.ty = p.y; ptr.active = true; lastMove = t; if (dist > 6 && t - lastDrag > 0.09) { lastDrag = t; ripples.push({ x: p.x, y: p.y, t, s: 0.45 }); } };
  const onDown = (e) => { const p = rel(e), t = performance.now() / 1000; lastMove = t; ripples.push({ x: p.x, y: p.y, t, s: 1.3 }); };

  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0); bmp = g.getImageData(0, 0, c.width, c.height).data; bw = c.width; bh = c.height;
    sample(); if (reduced) draw(performance.now());
  };
  img.src = src;
  resize();
  new ResizeObserver(() => { resize(); if (reduced) draw(performance.now()); }).observe(canvas);
  if (!reduced) {
    const target = interact || canvas;
    target.addEventListener('pointermove', onMove, { passive: true });
    target.addEventListener('pointerdown', onDown, { passive: true });
    target.addEventListener('pointerleave', () => { ptr.active = false; });
    new IntersectionObserver(([e]) => { const was = onScreen; onScreen = e.isIntersecting; if (onScreen && !was) raf = requestAnimationFrame(frame); }).observe(canvas);
    raf = requestAnimationFrame(frame);
  }
}
