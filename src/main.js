import { REGISTER, isStated, hrefOf, handleOf, caValue, scanAddresses } from './register.js';
import { startMarket } from './market.js';
import { initUI } from './ui.js';

const X_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
const GH_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>';

/* ---- social icons: icon only, both always present; link only when the record is stated ---- */
function social(rec, svg, name, handle) {
  const href = hrefOf(rec);
  if (href) {
    const a = document.createElement('a');
    a.className = 'soc'; a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.setAttribute('aria-label', `${name} ${handle || ''}`.trim()); a.innerHTML = svg; return a;
  }
  const s = document.createElement('span');
  s.className = 'soc inert'; s.setAttribute('role', 'img'); s.setAttribute('aria-disabled', 'true');
  s.setAttribute('aria-label', `${name} not available yet`); s.innerHTML = svg; return s;
}
document.getElementById('socials').append(
  social(REGISTER.x, X_SVG, 'Offbank, X profile', handleOf(REGISTER.x)),
  social(REGISTER.github, GH_SVG, 'Offbank, GitHub profile', handleOf(REGISTER.github)),
);

/* footer social (text allowed here) */
const fs = document.getElementById('foot-social');
{
  const li = document.createElement('li');
  if (hrefOf(REGISTER.x)) { const a = document.createElement('a'); a.href = REGISTER.x.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'X ' + handleOf(REGISTER.x); li.append(a); }
  else { const s = document.createElement('span'); s.className = 'plain inert'; s.textContent = 'X'; li.append(s); }
  const li2 = document.createElement('li');
  if (hrefOf(REGISTER.github)) { const a = document.createElement('a'); a.href = REGISTER.github.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'GitHub'; li2.append(a); }
  else { const s = document.createElement('span'); s.className = 'plain inert'; s.textContent = 'GitHub'; li2.append(s); }
  fs.append(li, li2);
}

/* data-link buttons follow the register */
document.querySelectorAll('[data-link]').forEach((a) => {
  const rec = REGISTER[a.dataset.link];
  const href = hrefOf(rec);
  if (href) { a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; }
  else { a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); }
});

/* ---- CA slot: both gate branches live from day one ---- */
const caBtn = document.getElementById('ca-btn'), caFb = document.getElementById('ca-fb'), strip = document.getElementById('ca-strip');
const ca = caValue();
strip.dataset.state = REGISTER.ca.state;
if (ca) {
  caBtn.textContent = ca; caBtn.disabled = false; caBtn.removeAttribute('aria-disabled');
  caBtn.setAttribute('aria-label', 'Copy contract address ' + ca); caBtn.title = 'Click to copy';
  caBtn.addEventListener('click', async () => {
    let ok = false;
    try { await navigator.clipboard.writeText(ca); ok = true; } catch {
      const t = document.createElement('textarea'); t.value = ca; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.append(t); t.select();
      try { ok = document.execCommand('copy'); } catch {} t.remove();
    }
    caFb.textContent = ok ? 'Copied' : 'Press Ctrl+C'; caFb.classList.add('show');
    clearTimeout(caBtn._t); caBtn._t = setTimeout(() => caFb.classList.remove('show'), 1800);
  });
} else {
  caBtn.textContent = 'Contract address not announced yet';
  caBtn.setAttribute('aria-disabled', 'true'); caBtn.disabled = true;
}

/* ---- gate 3: address scanner (CA node exempt via [data-ca]; 0x never blanket-rejected) ---- */
const stray = scanAddresses(document.body);
document.documentElement.dataset.gateStray = String(stray.length);
if (stray.length) console.warn('[gate] address-shaped strings not in the stated registry:', stray);

/* ---- market + ui ---- */
const pill = document.querySelector('.pill'), pillText = document.getElementById('status-text');
startMarket({ onStatus: (s) => { pill.classList.toggle('err', s === 'err'); pillText.textContent = s === 'err' ? 'Market feed retrying' : 'Market feed live'; } });
initUI();
