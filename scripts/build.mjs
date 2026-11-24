// Static build: src/ -> out dir (dist/ by default). Logo files are copied explicitly and checked.
import { cpSync, rmSync, mkdirSync, existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1];
const out = resolve(root, arg('out') || 'dist');
const ca = arg('ca');
if (!out.startsWith(root)) throw new Error('refusing to write outside the project');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, 'src'), out, { recursive: true });

// explicit logo copies (never rely on the recursive copy alone)
mkdirSync(join(out, 'assets'), { recursive: true });
for (const f of ['logo-512.png', 'mark-512.png', 'mark-128.png', 'favicon.svg', 'apple-touch-icon.png', 'og.jpg']) {
  cpSync(join(root, 'src/assets', f), join(out, 'assets', f));
}

if (ca) { // probe build: flips the CA record to "stated" so the second gate branch can be exercised
  const p = join(out, 'register.js');
  const s = readFileSync(p, 'utf8').replace(/ca:\s*\{ state: 'absent', value: null \},/, `ca:      { state: 'stated', value: '${ca}' },`);
  if (s === readFileSync(p, 'utf8')) throw new Error('CA anchor not found');
  writeFileSync(p, s);
}

// post-build proof: logo present, non-empty, and referenced with a correct relative path
const html = readFileSync(join(out, 'index.html'), 'utf8');
const need = ['./assets/logo-512.png', './assets/favicon.svg'];
for (const rel of need) {
  const f = join(out, rel);
  if (!existsSync(f) || statSync(f).size === 0) throw new Error('missing in build: ' + rel);
  if (!html.includes(`"${rel}"`)) throw new Error('index.html does not reference ' + rel);
}
const marks = ['assets/mark-128.png', 'assets/mark-512.png'];
for (const m of marks) if (!existsSync(join(out, m))) throw new Error('missing ' + m);
console.log(`built ${out}${ca ? ' (probe, CA stated)' : ''}\nlogo ok: ${need.concat(marks).join(', ')}`);
