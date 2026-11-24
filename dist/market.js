import { REGISTER, isStated, caValue } from './register.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BRAND_LOGO = './assets/mark-128.png';
const POLL_MS = 60000;

/* ---------- network: exponential backoff, jitter, timeout ---------- */
export async function jget(url, { tries = 4, base = 600, timeout = 10000 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), timeout);
    try {
      const r = await fetch(url, { signal: ac.signal, headers: { accept: 'application/json' } });
      clearTimeout(to);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      clearTimeout(to); last = e;
      if (i < tries - 1) await sleep(base * 2 ** i + Math.random() * 250);
    }
  }
  throw last;
}

/* ---------- formatting ---------- */
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
export function fmtPrice(p) {
  if (p == null) return '—';
  if (p >= 1000) return '$' + p.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (p >= 1) return '$' + p.toFixed(2);
  if (p >= 0.01) return '$' + p.toFixed(4);
  if (p === 0) return '$0.00';
  const d = Math.min(12, 3 - Math.floor(Math.log10(p)));
  return '$' + p.toFixed(d);
}
export const fmtCompact = (v) => (v == null ? '—' : '$' + Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(v));
export const fmtChg = (v) => (v == null ? '—' : (v > 0 ? '+' : '') + v.toFixed(2) + '%');

/* ---------- normalise a DexScreener pair ---------- */
function pairToItem(pairs, address) {
  if (!Array.isArray(pairs) || !pairs.length) return null;
  const sorted = [...pairs].sort((a, b) => (num(b?.volume?.h24) ?? 0) - (num(a?.volume?.h24) ?? 0));
  const p = sorted[0];
  const tok = p.baseToken?.address === address ? p.baseToken : (p.quoteToken?.address === address ? p.quoteToken : p.baseToken);
  return {
    address,
    symbol: tok?.symbol || '?', name: tok?.name || '',
    img: p.info?.imageUrl || null,
    price: num(p.priceUsd), chg: num(p.priceChange?.h24),
    vol: num(p.volume?.h24), liq: num(p.liquidity?.usd), ok: true,
  };
}

/* ---------- trending: boosts -> top 10 solana -> per-token pair ---------- */
async function fetchTrending() {
  const M = REGISTER.market;
  const boosts = await jget(M.boosts);
  const seen = new Map();
  for (const b of Array.isArray(boosts) ? boosts : []) {
    if (b.chainId !== 'solana' || !b.tokenAddress) continue;
    const prev = seen.get(b.tokenAddress);
    if (!prev || (b.totalAmount ?? 0) > (prev.totalAmount ?? 0)) seen.set(b.tokenAddress, b);
  }
  const top = [...seen.values()].sort((a, b) => (b.totalAmount ?? 0) - (a.totalAmount ?? 0)).slice(0, 10);
  const res = await Promise.allSettled(top.map((b) => jget(M.tokens + b.tokenAddress, { tries: 3 })));
  return top.map((b, i) => {
    const it = res[i].status === 'fulfilled' ? pairToItem(res[i].value, b.tokenAddress) : null;
    if (it) { it.img = it.img || b.icon || null; return it; }
    return { address: b.tokenAddress, symbol: '?', name: '', img: b.icon || null, price: null, chg: null, vol: null, liq: null, ok: false };
  });
}

/* ---------- own token: DexScreener + pump.fun in parallel, never blocking each other ---------- */
async function fetchOwn(ca) {
  const M = REGISTER.market;
  const [dex, pump] = await Promise.allSettled([jget(M.ownDex + ca, { tries: 3 }), jget(M.ownPump + ca, { tries: 2 })]);
  const d = dex.status === 'fulfilled' ? pairToItem(dex.value?.pairs, ca) : null;
  const p = pump.status === 'fulfilled' && pump.value ? pump.value : null;
  if (!d && !p) throw new Error('own token sources down');
  return {
    address: ca,
    symbol: d?.symbol && d.symbol !== '?' ? d.symbol : (p?.symbol || '?'),
    name: d?.name || p?.name || '',
    imgs: [p?.image_uri, d?.img, BRAND_LOGO].filter(Boolean),   // pump.fun -> DexScreener -> brand/ -> letter tile
    price: d?.price ?? null, chg: d?.chg ?? null, vol: d?.vol ?? null, liq: d?.liq ?? null, ok: true, own: true,
  };
}

/* ---------- DOM helpers ---------- */
function logo(srcs, letter) {
  const el = document.createElement('i'); el.className = 'lt';
  const list = (srcs || []).filter(Boolean);
  const tile = () => { el.textContent = (letter || '?').slice(0, 1).toUpperCase(); };
  if (!list.length) { tile(); return el; }
  const img = new Image(); img.alt = ''; img.referrerPolicy = 'no-referrer'; img.loading = 'lazy';
  let i = 0;
  img.onerror = () => { i++; if (i < list.length) img.src = list[i]; else { img.remove(); tile(); } };
  img.src = list[0]; el.appendChild(img);
  return el;
}
function tween(el, from, to, fmt) {
  if (reduced() || from == null || to == null || from === to) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), D = 700;
  const step = (t) => {
    const k = Math.min(1, (t - t0) / D), e = 1 - (1 - k) ** 3;
    el.textContent = fmt(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function setNum(cell, key, val, fmt, cls) {
  const prev = cell._v;
  cell._v = val;
  if (cls) cell.classList.toggle('up', val != null && val > 0), cell.classList.toggle('dn', val != null && val <= 0);
  if (val == null) { cell.textContent = '—'; return; }
  tween(cell, prev, val, fmt);
  if (prev != null && prev !== val && !reduced()) {
    cell.classList.remove('flash-up', 'flash-dn'); void cell.offsetWidth;
    cell.classList.add(val > prev ? 'flash-up' : 'flash-dn');
    setTimeout(() => cell.classList.remove('flash-up', 'flash-dn'), 80);
  }
}
function buildRow(rank) {
  const r = document.createElement('div'); r.className = 'row spot'; r.setAttribute('role', 'row');
  r.innerHTML = '<span class="rk"></span><div class="tok"></div><span class="num px-c"></span><span class="num chg"></span><span class="num vol"></span><span class="num liq"></span>';
  r.querySelector('.px-c').classList.add('px');
  r.querySelector('.rk').textContent = rank;
  return r;
}
function fillRow(r, it) {
  const tok = r.querySelector('.tok');
  if (r._key !== it.address) {
    r._key = it.address; r._v = {};
    tok.replaceChildren(logo(it.imgs || [it.img], it.symbol));
    const tn = document.createElement('div'); tn.className = 'tn';
    const b = document.createElement('b'); b.textContent = it.symbol;
    const s = document.createElement('small'); s.textContent = it.name || '—';
    tn.append(b, s); tok.appendChild(tn);
    if (it.own) { const t = document.createElement('span'); t.className = 'own-tag'; t.textContent = 'OURS'; b.appendChild(t); }
  }
  setNum(r.querySelector('.px'), 'p', it.price, fmtPrice);
  setNum(r.querySelector('.chg'), 'c', it.chg, fmtChg, true);
  setNum(r.querySelector('.vol'), 'v', it.vol, fmtCompact);
  setNum(r.querySelector('.liq'), 'l', it.liq, fmtCompact);
}
function skelRow(rank) {
  const r = document.createElement('div'); r.className = 'row sk-row';
  r.innerHTML = '<span class="rk"></span><div class="tok"><i class="lt sk"></i><div class="tn"><span class="sk" style="width:84px;height:14px"></span><span class="sk" style="width:56px;height:10px;margin-top:6px"></span></div></div><span class="sk" style="height:14px"></span><span class="sk" style="height:14px"></span><span class="sk" style="height:14px"></span><span class="sk" style="height:14px"></span>';
  r.querySelector('.rk').textContent = rank;
  return r;
}

/* ---------- own row: placeholder (brand logo) or live ---------- */
function placeholderOwn() {
  const r = document.createElement('div'); r.className = 'row own ph in'; r.dataset.own = 'placeholder'; r.setAttribute('aria-disabled', 'true');
  r.innerHTML = '<span class="rk">1</span><div class="tok"><i class="lt"><img src="' + BRAND_LOGO + '" alt="Offbank"></i><div class="tn"><b>OFFBANK<span class="own-tag">OURS</span></b><small>Awaiting contract address</small></div></div><span class="num px">· · · · ·</span><span class="num chg">· · · · ·</span><span class="num vol">· · · · ·</span><span class="num liq">· · · · ·</span>';
  return r;
}

/* ---------- ticker ---------- */
function renderTicker(items) {
  const track = document.getElementById('ticker-track');
  if (!track) return;
  const mk = (it) => {
    const s = document.createElement('span'); s.className = 'tk';
    const l = logo(it.imgs || [it.img], it.symbol); l.classList.add('lt');
    const sym = document.createElement('span'); sym.textContent = it.symbol;
    const p = document.createElement('span'); p.textContent = fmtPrice(it.price);
    const c = document.createElement('span'); c.className = it.chg != null && it.chg > 0 ? 'up' : 'dn';
    c.textContent = it.chg == null ? '—' : (it.chg > 0 ? '▲ ' : '▼ ') + Math.abs(it.chg).toFixed(1) + '%';
    s.append(l, sym, p, c); return s;
  };
  const once = items.map(mk), twice = items.map(mk);
  track.replaceChildren(...once, ...twice);
}

/* ---------- controller ---------- */
export function startMarket({ onStatus }) {
  if (!isStated(REGISTER.market)) return;               // market follows its own record only; CA never consulted here
  const rows = document.getElementById('rows');
  const errEl = document.getElementById('err');
  const ownSlot = document.createElement('div'); ownSlot.style.display = 'contents';
  const listSlot = document.createElement('div'); listSlot.style.display = 'contents';
  const state = { trending: null, own: null, busy: false, timer: null, ownRow: null, rowEls: new Map() };

  // initial paint: own row (placeholder or skeleton) + 10 skeletons
  const ca = caValue();
  if (ca) ownSlot.appendChild(skelRow(1)); else ownSlot.appendChild(placeholderOwn());
  for (let i = 0; i < 10; i++) listSlot.appendChild(skelRow(i + 2));
  rows.replaceChildren(ownSlot, listSlot);
  renderTicker(Array.from({ length: 8 }, () => ({ symbol: '···', price: null, chg: null })));

  function paint() {
    const own = caValue() ? state.own : null;
    const trending = (state.trending || []).filter((t) => !ca || t.address !== ca);   // dedup own from rows 2-10
    if (caValue()) {
      if (own) {
        if (!state.ownRow) { state.ownRow = buildRow(1); state.ownRow.classList.add('own'); ownSlot.replaceChildren(state.ownRow); requestAnimationFrame(() => state.ownRow.classList.add('in')); }
        fillRow(state.ownRow, own);
      } else if (state.ownRow) { /* keep last good */ }
      else if (state.ownErr) {
        const r = buildRow(1); r.classList.add('own', 'in');
        fillRow(r, { address: ca, symbol: 'OFFBANK', name: 'Feed unavailable', imgs: [BRAND_LOGO], price: null, chg: null, vol: null, liq: null, own: true });
        ownSlot.replaceChildren(r);
      }
    }
    if (state.trending) {
      const list = trending.slice(0, caValue() ? 9 : 10);
      const first = !state.rowEls.size;
      const keep = new Set(list.map((t) => t.address));
      for (const [k, el] of state.rowEls) if (!keep.has(k)) { el.remove(); state.rowEls.delete(k); }
      if (first) listSlot.replaceChildren();
      list.forEach((it, idx) => {
        let el = state.rowEls.get(it.address);
        if (!el) { el = buildRow(); state.rowEls.set(it.address, el); listSlot.appendChild(el); el.style.setProperty('--i', idx); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in'))); }
        el.querySelector('.rk').textContent = idx + 2;
        fillRow(el, it);
        listSlot.appendChild(el);   // keeps order
      });
    }
    const tk = [...(caValue() && state.own ? [state.own] : []), ...(state.trending || []).filter((t) => t.ok && (!ca || t.address !== ca))];
    if (tk.length) renderTicker(tk);
  }

  async function refresh() {
    if (state.busy) return; state.busy = true;
    const jobs = [fetchTrending().then((v) => { state.trending = v; state.trErr = false; }, () => { state.trErr = true; })];
    if (ca) jobs.push(fetchOwn(ca).then((v) => { state.own = v; state.ownErr = false; }, () => { state.ownErr = true; }));
    await Promise.all(jobs);
    paint();
    const failed = state.trErr && !state.trending;
    errEl.hidden = !(state.trErr || state.ownErr);
    if (!errEl.hidden) errEl.textContent = state.trending ? 'Source hiccup. Showing the last good numbers; retrying next cycle.' : 'Market source unreachable. Dashes shown until it answers.';
    if (failed && !state.rowEls.size) {
      listSlot.replaceChildren(...Array.from({ length: 10 }, (_, i) => { const r = buildRow(i + 2); r.classList.add('in'); fillRow(r, { address: 'x' + i, symbol: '—', name: '—', price: null, chg: null, vol: null, liq: null }); return r; }));
    }
    onStatus(state.trErr ? 'err' : 'ok');
    state.busy = false;
  }
  function schedule() { clearTimeout(state.timer); state.timer = setTimeout(async () => { if (!document.hidden) { await refresh(); } schedule(); }, POLL_MS); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(state.timer); else { refresh().then(schedule); } });
  refresh().then(schedule);
}
