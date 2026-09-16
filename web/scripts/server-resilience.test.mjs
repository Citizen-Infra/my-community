import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { get } from 'node:http';
import { once } from 'node:events';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = await new Promise((resolvePort, reject) => {
  const probe = createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const { port: openPort } = probe.address();
    probe.close((error) => error ? reject(error) : resolvePort(openPort));
  });
});

const child = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
});

function request(path) {
  return new Promise((resolveRequest, reject) => {
    get({ hostname: '127.0.0.1', port, path }, (response) => {
      response.resume();
      response.once('end', () => resolveRequest(response.statusCode));
    }).once('error', reject);
  });
}

let failures = 0;
const assert = (condition, message) => {
  if (condition) console.log('ok:', message);
  else { console.error('FAIL:', message); failures += 1; }
};

try {
  await Promise.race([
    once(child.stdout, 'data'),
    once(child, 'exit').then(([code]) => { throw new Error(`server exited before readiness (${code})`); }),
  ]);
  assert(await request('/%E0%A4%A') === 400, 'malformed URL escapes receive a 400 response');
  assert(await request('/health') === 200, 'the server remains healthy after a malformed request');
} finally {
  if (child.exitCode === null) {
    child.kill();
    await once(child, 'exit');
  }
}

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
