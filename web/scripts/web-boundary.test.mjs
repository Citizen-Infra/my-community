import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entry = resolve(root, 'src/index.jsx');
const visited = new Set();
const forbidden = ['store/tabs.js', 'store/collections.js', 'store/backup.js', 'store/tab-manager.js', 'platform/extension.js', 'BookmarkImportModal.jsx', 'TabCard.jsx'];
let failures = 0;

function resolveImport(importer, specifier) {
  if (!specifier.startsWith('.')) return null;
  const candidate = resolve(dirname(importer), specifier);
  for (const path of [candidate, `${candidate}.js`, `${candidate}.jsx`, resolve(candidate, 'index.js'), resolve(candidate, 'index.jsx')]) {
    if (existsSync(path) && !['.css', '.json'].includes(extname(path))) return path;
  }
  return null;
}

function walk(file) {
  if (visited.has(file)) return;
  visited.add(file);
  const normalized = file.replaceAll('\\', '/');
  if (forbidden.some((suffix) => normalized.endsWith(suffix))) {
    console.error('FAIL: extension-only module is reachable from web:', normalized);
    failures += 1;
  }
  const source = readFileSync(file, 'utf8');
  if (/\bchrome\s*\./.test(source)) {
    console.error('FAIL: Chrome API is reachable from web:', normalized);
    failures += 1;
  }
  const imports = source.matchAll(/(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g);
  for (const match of imports) {
    const target = resolveImport(file, match[1]);
    if (target) walk(target);
  }
}

walk(entry);
if (failures === 0) console.log(`ok: ${visited.size} reachable source modules exclude Chrome-only code`);
console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
