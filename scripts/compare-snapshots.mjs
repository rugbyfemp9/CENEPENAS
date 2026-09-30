// Compares two snapshot folders written by tests/e2e/snapshot.spec.js.
// Usage: node scripts/compare-snapshots.mjs <before-dir> <after-dir> [--threshold=0.001]
// Writes <after-dir>/_diff/*.png for screenshots that differ.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const [a, b] = process.argv.slice(2).filter((x) => !x.startsWith('--'));
const threshold = Number((process.argv.find((x) => x.startsWith('--threshold=')) || '=0.001').split('=')[1]);
if (!a || !b) { console.error('usage: compare-snapshots <before> <after>'); process.exit(2); }

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() && e.name !== '_diff' ? walk(path.join(d, e.name)) : e.isFile() ? [path.join(d, e.name)] : []);
const files = walk(a).map((f) => path.relative(a, f)).sort();
let problems = 0;
const diffDir = path.join(b, '_diff');

for (const rel of files) {
  const fa = path.join(a, rel), fb = path.join(b, rel);
  if (!fs.existsSync(fb)) { console.log(`MISSING   ${rel}`); problems++; continue; }
  if (rel.endsWith('.png')) {
    const pa = PNG.sync.read(fs.readFileSync(fa)), pb = PNG.sync.read(fs.readFileSync(fb));
    if (pa.width !== pb.width || pa.height !== pb.height) {
      console.log(`SIZE      ${rel}  ${pa.width}x${pa.height} -> ${pb.width}x${pb.height}`); problems++; continue;
    }
    const diff = new PNG({ width: pa.width, height: pa.height });
    const n = pixelmatch(pa.data, pb.data, diff.data, pa.width, pa.height, { threshold: 0.1 });
    const ratio = n / (pa.width * pa.height);
    if (ratio > threshold) {
      fs.mkdirSync(path.dirname(path.join(diffDir, rel)), { recursive: true });
      fs.writeFileSync(path.join(diffDir, rel), PNG.sync.write(diff));
      console.log(`PIXELS    ${rel}  ${n} px (${(ratio * 100).toFixed(3)}%)`); problems++;
    }
  } else {
    const ta = fs.readFileSync(fa, 'utf8'), tb = fs.readFileSync(fb, 'utf8');
    if (ta !== tb) {
      const la = ta.split('\n'), lb = tb.split('\n');
      let i = 0; while (i < la.length && la[i] === lb[i]) i++;
      console.log(`TEXT      ${rel}  first difference at line ${i + 1}:\n            - ${JSON.stringify((la[i] || '').slice(0, 160))}\n            + ${JSON.stringify((lb[i] || '').slice(0, 160))}`);
      problems++;
    }
  }
}
console.log(problems ? `\n${problems} difference(s) across ${files.length} files` : `\nIdentical: ${files.length} files`);
process.exit(problems ? 1 : 0);
