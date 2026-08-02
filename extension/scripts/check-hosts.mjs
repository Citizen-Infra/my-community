// Fails the build when the external hosts disagree across the three surfaces
// that cannot share a module (#85).
//
// src/lib/config.js is the source of truth. Two surfaces cannot import it:
//
//   public/background.js  — copied verbatim by Vite, so `import.meta.env` never
//                           applies and it cannot import from src/
//   public/manifest.json  — static JSON, imports nothing
//
// The point is not tidiness. A partial update leaves the extension
// half-migrated and silently broken: caAuth.js pointing one way while
// background.js points another produces a sign-in that appears to start and
// never completes, with no error naming the cause. That was #84, and it cost a
// debugging session rather than a glance.
//
// Run: node scripts/check-hosts.mjs  (also runs as `npm run prebuild`)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const failures = [];
const fail = (msg) => failures.push(msg);

// Extract a single capture, or record a failure. A check whose own parsing
// breaks must fail loudly, not pass silently — that is the failure mode this
// script exists to prevent, so it must not have it itself.
function extract(source, file, label, re) {
  const m = source.match(re);
  if (!m) {
    fail(`could not find ${label} in ${file}. If it was renamed or restructured, update ${'scripts/check-hosts.mjs'} to match — do not delete the check.`);
    return null;
  }
  return m[1];
}

const config = read('src/lib/config.js');
const background = read('public/background.js');
const manifest = JSON.parse(read('public/manifest.json'));

const configCaUrl = extract(
  config, 'src/lib/config.js', "CA_URL's default",
  /export const CA_URL = import\.meta\.env\.VITE_CA_URL \|\| '([^']+)'/,
);
const configCaDid = extract(
  config, 'src/lib/config.js', "CA_DID's default",
  /export const CA_DID = import\.meta\.env\.VITE_CA_DID \|\| '([^']+)'/,
);
const backgroundCaUrl = extract(
  background, 'public/background.js', 'the CA_URL literal',
  /^const CA_URL = '([^']+)';$/m,
);

// 1. The service worker must point at the same host as the app.
if (configCaUrl && backgroundCaUrl && configCaUrl !== backgroundCaUrl) {
  fail(
    `CA_URL disagrees between surfaces:\n` +
    `    src/lib/config.js    ${configCaUrl}\n` +
    `    public/background.js ${backgroundCaUrl}\n` +
    `  background.js cannot read VITE_CA_URL, so it must be edited by hand to match.`,
  );
}

// 2. The manifest must grant the host the app actually calls, or every request
//    from the service worker fails with an opaque network error.
const permissions = manifest.host_permissions || [];
if (configCaUrl && !permissions.includes(`${configCaUrl}/*`)) {
  fail(
    `public/manifest.json host_permissions does not grant ${configCaUrl}/*\n` +
    `  granted: ${permissions.join(', ') || '(none)'}`,
  );
}

// 3. The DID and the host must correspond. They are separate facts — CA answers
//    on several hosts but declares one primary DID — so this is asserted rather
//    than derived. If CA ever legitimately splits them, this fails and a human
//    decides, which beats silently minting for an audience CA will reject.
if (configCaUrl && configCaDid) {
  const expected = `did:web:${new URL(configCaUrl).hostname}`;
  if (configCaDid !== expected) {
    fail(
      `CA_DID does not correspond to CA_URL:\n` +
      `    CA_URL   ${configCaUrl}  (implies ${expected})\n` +
      `    CA_DID   ${configCaDid}\n` +
      `  If community-admin deliberately declares a DID on a different host, update this\n` +
      `  check with the reason. Otherwise /auth/atproto/assert will 401 on audience mismatch.`,
    );
  }
}

if (failures.length) {
  console.error(`\ncheck-hosts: ${failures.length} problem(s)\n`);
  for (const f of failures) console.error(`  - ${f}\n`);
  console.error('See Citizen-Infra/my-community#85.\n');
  process.exit(1);
}

console.log(`check-hosts: ok — ${configCaUrl} (${configCaDid})`);
