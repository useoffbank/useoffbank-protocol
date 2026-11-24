import { asciiCanvas } from './ascii.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---- damped spring solver. Same parametrisation as the reference motion lib:
   stiffness = (2*PI/duration)^2, damping = 4*PI*(1-bounce)/duration, mass 1. ---- */
function spring(onFrame, { duration = 1, bounce = 0, delay = 0 } = {}) {
  const k = (2 * Math.PI / duration) ** 2, c = (4 * Math.PI * (1 - bounce)) / duration;
  let x = 0, v = 0, last = null;
  const t0 = performance.now() + delay * 1000;
  const tick = (t) => {
    if (t < t0) return requestAnimationFrame(tick);
    if (last === null) last = t;
    let dt = Math.min(0.05, (t - last) / 1000); last = t;
    while (dt > 0) { const h = Math.min(dt, 1 / 240); v += (-k * (x - 1) - c * v) * h; x += v * h; dt -= h; }
    const el = (t - t0) / 1000;
    if (Math.abs(1 - x) < 0.0008 && Math.abs(v) < 0.0008) return onFrame(1, el, true);
    onFrame(x, el, false); requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
const easeOut = (p) => 1 - (1 - Math.min(1, Math.max(0, p))) ** 3;

/* ---- reveal: default = reference Reveal (1s, y 40, blur 8, viewport amount .4, critically damped so it
   tracks the reference ease). data-mode="appear" = reference hero Appear (spring bounce .2, 1s, blur tween .8s). ---- */
function reveal() {
  const els = $$('.reveal');
  const done = (el) => { el.style.opacity = '1'; el.style.transform = 'none'; el.style.filter = 'none'; };
  if (reduced() || !('IntersectionObserver' in window)) return els.forEach(done);
  const play = (el) => {
    const y = Number(el.dataset.y || 40), blur = Number(el.dataset.blur || 8), delay = Number(el.dataset.delay || 0);
    const appear = el.dataset.mode === 'appear';
    spring((x, el_, fin) => {
      el.style.opacity = String(Math.min(1, Math.max(appear ? 0.001 : 0, x)));
      el.style.transform = fin ? 'none' : `translateY(${(1 - x) * y}px)`;
      const p = appear ? 1 - easeOut(el_ / 0.8) : 1 - Math.min(1, x);
      el.style.filter = fin || p <= 0 ? 'none' : `blur(${p * blur}px)`;
    }, appear ? { duration: 1, bounce: 0.2, delay } : { duration: 1, bounce: 0, delay });
  };
  els.forEach((el) => {
    const y = Number(el.dataset.y || 40), blur = Number(el.dataset.blur || 8), appear = el.dataset.mode === 'appear';
    el.style.opacity = appear ? '0.001' : '0'; el.style.transform = `translateY(${y}px)`; el.style.filter = `blur(${blur}px)`;
  });
  const hero = els.filter((e) => e.dataset.mode === 'appear'); hero.forEach(play);          // Appear fires on mount
  const io = new IntersectionObserver((es) => {
    for (const e of es) {
      const amount = Number(e.target.dataset.amount || 0.4);
      const ok = e.intersectionRatio >= amount || e.intersectionRect.height >= innerHeight * amount;   // tall elements can never reach .4 of themselves
      if (e.isIntersecting && ok) { io.unobserve(e.target); play(e.target); }
    }
  }, { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5] });
  els.filter((e) => e.dataset.mode !== 'appear').forEach((el) => io.observe(el));
}

/* ---- header: entrance spring (y -24, bounce .2, 1s); backdrop after scroll (white/75, blur 24px, 500ms) ---- */
function header() {
  const h = $('#top'), set = () => document.documentElement.style.setProperty('--hdr', h.offsetHeight + 'px');
  set(); new ResizeObserver(set).observe(h);
  // entrance runs on the nav row only: the CA bar must be visible at all times, with or without animation frames
  const nav = $('.nav-row');
  if (!reduced()) { nav.style.opacity = '0'; nav.style.transform = 'translateY(-24px)'; spring((x, _e, fin) => { nav.style.opacity = String(Math.min(1, Math.max(0, x))); nav.style.transform = fin ? 'none' : `translateY(${(1 - x) * -24}px)`; }, { duration: 1, bounce: 0.2 }); }
  const upd = () => h.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', upd, { passive: true }); upd();
}

function progress() {
  const bar = $('#progress'); let raf = 0;
  const upd = () => { raf = 0; const h = document.documentElement.scrollHeight - innerHeight; bar.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`; };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true }); upd();
}

function parallax() {
  if (reduced()) return;
  const layers = $$('.plx'), hero = $('#home');
  let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
  const loop = () => {
    cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
    const sy = Math.min(scrollY, 900);
    layers.forEach((l) => { const d = Number(l.dataset.depth || 1); l.style.transform = `translate3d(${cx * d * 14}px,${cy * d * 14 + sy * d * 0.05}px,0)`; });
    raf = (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001 || sy < 900) ? requestAnimationFrame(loop) : 0;
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
  hero.addEventListener('pointermove', (e) => { const r = hero.getBoundingClientRect(); tx = (e.clientX - r.left) / r.width - 0.5; ty = (e.clientY - r.top) / r.height - 0.5; kick(); });
  hero.addEventListener('pointerleave', () => { tx = ty = 0; kick(); });
  addEventListener('scroll', kick, { passive: true }); kick();
}

function spotlight() {
  document.addEventListener('pointermove', (e) => {
    const s = e.target.closest && e.target.closest('.spot'); if (!s) return;
    const r = s.getBoundingClientRect(); s.style.setProperty('--mx', e.clientX - r.left + 'px'); s.style.setProperty('--my', e.clientY - r.top + 'px');
  }, { passive: true });
}

/* typing timings from the reference: type 42+40*rand ms, hold 1800, delete 18ms/char, 250 between lines */
function typed() {
  const el = $('#typed'); if (!el) return;
  const lines = ['send 40 USDC to @nightowl', 'fund spending from my holdings', 'prove the win, mask the amount', 'open an invoice URL for 100 USDC'];
  if (reduced()) { el.textContent = lines[0]; return; }
  let li = 0, n = 0, del = false, t;
  const step = () => {
    const s = lines[li]; el.textContent = s.slice(0, n);
    if (!del && n < s.length) { n++; t = setTimeout(step, 42 + 40 * Math.random()); }
    else if (!del && n === s.length) { del = true; t = setTimeout(step, 1800); }
    else if (del && n > 0) { n--; t = setTimeout(step, 18); }
    else { del = false; li = (li + 1) % lines.length; t = setTimeout(step, 250); }
  };
  step();
}

/* tabs: sliding pill (reference layoutId spring, bounce .15, .5s) */
function tabs() {
  const wrap = $('#tabs'), tabEls = $$('#tabs [role=tab]'), pill = $('#pill-ind'), panels = $$('.tp'), mocks = $$('#mock-tabs .mp');
  let cur = { x: 0, w: 0 }, first = true;
  const place = (i, animate) => {
    const b = tabEls[i], to = { x: b.offsetLeft, w: b.offsetWidth }, from = { ...cur };
    const apply = (x, w) => { pill.style.transform = `translateX(${x}px)`; pill.style.width = w + 'px'; };
    if (!animate || reduced() || first) { apply(to.x, to.w); cur = to; first = false; return; }
    spring((p, _e, fin) => { apply(from.x + (to.x - from.x) * p, from.w + (to.w - from.w) * p); if (fin) cur = to; }, { duration: 0.5, bounce: 0.15 });
  };
  const sel = (i, focus, animate = true) => {
    tabEls.forEach((t, j) => { t.setAttribute('aria-selected', j === i); t.tabIndex = j === i ? 0 : -1; });
    panels.forEach((p, j) => { p.hidden = j !== i; p.classList.toggle('on', j === i); });
    mocks.forEach((m, j) => m.classList.toggle('on', j === i));
    place(i, animate); if (focus) tabEls[i].focus();
  };
  tabEls.forEach((t, i) => {
    t.addEventListener('click', () => sel(i));
    t.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') sel((i + 1) % 3, true); if (e.key === 'ArrowLeft') sel((i + 2) % 3, true); });
  });
  sel(0, false, false);
  new ResizeObserver(() => { const i = tabEls.findIndex((t) => t.getAttribute('aria-selected') === 'true'); first = true; place(i, false); }).observe(wrap);
}

function faq() {
  $$('.qa').forEach((q) => {
    const b = $('button', q), a = $('.ans', q);
    b.addEventListener('click', () => {
      const open = !q.classList.contains('open');
      q.classList.toggle('open', open); b.setAttribute('aria-expanded', open);
      a.style.height = open ? a.scrollHeight + 'px' : '0px';
    });
  });
}

function counts() {
  const els = $$('[data-count]');
  const run = (el) => {
    const to = Number(el.dataset.count);
    if (reduced() || to === 0) { el.textContent = to; return; }
    spring((x) => { el.textContent = Math.round(to * Math.min(x, 1)); }, { duration: 1.2, bounce: 0 });
  };
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); run(e.target); } }), { threshold: 0.6 });
  els.forEach((el) => { if (!reduced() && Number(el.dataset.count) > 0) el.textContent = '0'; io.observe(el); });
}

/* final CTA tile grid: reference pattern, spring bounce .35 / .8s, delay .015*(col+3*row), hover y-4 scale 1.06 */
function ctaGrid() {
  const host = $('#cta-grid'); if (!host) return;
  const rows = ['001011110011100110111101', '011111111111111111011101', '110111111111111111111011', '011001100000000100010111', '010000000000000000000110'];
  const letters = 'OFFBANK'; let n = 0; const tiles = [];
  rows.forEach((r, i) => [...r].forEach((ch, s) => {
    const cell = document.createElement(ch === '1' ? 'i' : 'span');
    if (s >= 12) cell.className = 'wide';
    if (ch === '1') { cell.className += ' cta-t t' + (n % 4); cell.textContent = letters[n % letters.length]; n++; tiles.push([cell, s + 3 * i]); }
    host.appendChild(cell);
  }));
  const fire = (cell, idx) => spring((x, _e, fin) => { const sc = 0.6 + 0.4 * x; cell.style.opacity = String(Math.min(1, Math.max(0, x))); cell.style.transform = fin ? '' : `translateY(${(1 - x) * 10}px) scale(${sc})`; }, { duration: 0.8, bounce: 0.35, delay: 0.015 * idx });
  if (reduced() || !('IntersectionObserver' in window)) return;
  tiles.forEach(([c]) => { c.style.opacity = '0'; c.style.transform = 'translateY(10px) scale(.6)'; });
  const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); tiles.forEach(([c, i]) => fire(c, i)); } }, { threshold: 0.2 });
  io.observe(host);
}

function ascii() {
  const hero = $('#ascii-hero'), art = $('#ascii-art');
  if (hero) asciiCanvas(hero, { src: './assets/mark-512.png', interact: $('#home'), baseGain: 0.72, scale: 1.12, offsetY: 0.1, clear: (w) => ({ cx: w / 2, cy: 210, rx: Math.min(380, w * 0.46), ry: 170 }) });
  if (art) asciiCanvas(art, { src: './assets/mark-512.png', interact: art.parentElement, baseGain: 0.92, scale: 0.9 });
}

export function initUI() { header(); reveal(); progress(); parallax(); spotlight(); typed(); tabs(); faq(); counts(); ctaGrid(); ascii(); }
