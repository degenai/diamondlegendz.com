// Rewrites src/version.js from today's date and `git rev-parse --short HEAD`.
// N counts up when src/version.js is already stamped today, else restarts at 1.
// Usage (from chair-massage-fundamentals/ or anywhere): node tools/bump-version.mjs
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'src', 'version.js');
const hash = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim();
const d = new Date();
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
let n = 1;
if (existsSync(file)) {
  const m = readFileSync(file, 'utf8').match(/VERSION = '(\d{4}-\d{2}-\d{2})\.(\d+)/);
  if (m && m[1] === today) n = +m[2] + 1;
}
const version = `${today}.${n}`;
writeFileSync(file, `// Build stamp: YYYY-MM-DD.N (Nth build that day) and the short hash of HEAD when it was stamped.
// Rewritten by tools/bump-version.mjs, which the pilot runs before each merge. Do not hand-edit.
export const VERSION = '${version} \u00b7 ${hash}';
`);
console.log(`src/version.js -> ${version} · ${hash}`);
