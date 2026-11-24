// Animation audit: every @keyframes must be referenced by an animation declaration, and a
// reduced-motion rule must neutralise animations globally. Prints duration/easing per use.
import { readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, process.argv[2] ? process.argv[2] + '/styles.css' : 'dist/styles.css'), 'utf8');
const names = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]);
const reducedBlocks = [...css.matchAll(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n');
const globalKill = /\*,\*::before,\*::after\{animation:none!important;transition:none!important\}/.test(reducedBlocks);
let bad = 0;
for (const n of names) {
  const re = new RegExp(String.raw`([^{}]+)\{[^{}]*animation:\s*([^;}]*\b` + n + String.raw`\b[^;}]*)`, 'g');
  const uses = [...css.matchAll(re)].map((m) => `${m[1].trim().split('\n').pop()} -> ${m[2].trim()}`);
  const ok = uses.length > 0 && globalKill;
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} @keyframes ${n}  reduced-motion:${globalKill ? 'none!important' : 'MISSING'}`);
  uses.forEach((u) => console.log('       ' + u));
}
console.log(`\nkeyframes: ${names.length}, failing: ${bad}`);
process.exit(bad ? 1 : 0);
