// REGISTER: every external fact is one record. state: stated | absent | unconfirmed.
// Absent / unconfirmed records render inert (no href, no copy, no fetch).
export const REGISTER = {
  ca:      { state: 'absent', value: null },                         // @@CA@@ build.mjs rewrites this line for the probe build
  chain:   { state: 'stated', value: 'solana', label: 'Solana mainnet' },
  rpc:     { state: 'stated', url: 'https://solana-rpc.publicnode.com' },
  x:       { state: 'stated', url: 'https://x.com/useoffbank' },
  github:  { state: 'absent', url: null },
  site:    { state: 'stated', url: 'https://offbank.xyz' },
  market:  {
    state: 'stated',
    boosts: 'https://api.dexscreener.com/token-boosts/top/v1',
    tokens: 'https://api.dexscreener.com/tokens/v1/solana/',
    ownDex: 'https://api.dexscreener.com/latest/dex/tokens/',
    ownPump: 'https://frontend-api.pump.fun/coins/',
  },
};

export const isStated = (r) => r && r.state === 'stated';
// Link rule: store the URL, derive the handle. Unstated record -> no href at all.
export const hrefOf = (r) => (isStated(r) && r.url ? r.url : null);
export const handleOf = (r) => {
  const u = hrefOf(r);
  if (!u) return null;
  try { return '@' + new URL(u).pathname.split('/').filter(Boolean)[0]; } catch { return null; }
};
export const caValue = () => (isStated(REGISTER.ca) && REGISTER.ca.value ? REGISTER.ca.value : null);

// Gate 3: address scanner. Address-shaped strings are matched against the stated registry.
// 0x hex is never blanket-rejected: it passes if some stated record holds it. CA is exempt.
export const ADDRESS_RE = /\b(?:0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})\b/g;
export function statedAddresses() {
  const s = new Set();
  for (const r of Object.values(REGISTER)) if (isStated(r) && typeof r.value === 'string') s.add(r.value);
  return s;
}
export function scanAddresses(root) {
  const known = statedAddresses();
  const bad = [];
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.parentElement && n.parentElement.closest('[data-ca],[data-market],script,style')) continue;
    for (const m of n.nodeValue.matchAll(ADDRESS_RE)) if (!known.has(m[0])) bad.push(m[0]);
  }
  return bad;
}
