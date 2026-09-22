import {
  classifyDecisionLink,
  decisionRoutePath,
  resolveDecisionLink,
  validateDecisionPath,
} from '../src/decision-path.js';

let failures = 0;
const assert = (condition, message) => {
  if (condition) console.log('ok:', message);
  else { console.error('FAIL:', message); failures += 1; }
};
const rejects = (fn, message) => {
  try { fn(); assert(false, message); } catch { assert(true, message); }
};

assert(validateDecisionPath('2026-09-22-example.md') === '2026-09-22-example.md', 'a canonical root decision path is accepted');
assert(validateDecisionPath('working groups/next step.md') === 'working groups/next step.md', 'portable nested Unicode paths are accepted');
assert(decisionRoutePath('working groups/next step.md') === '/decisions/working%20groups/next%20step.md', 'route segments are encoded independently');

for (const path of ['', '../people/a.md', '/absolute.md', 'folder\\file.md', 'folder//file.md', 'folder/./file.md', 'file.txt', 'file.md?x=1', 'file.md.']) {
  rejects(() => validateDecisionPath(path), `${JSON.stringify(path)} is rejected`);
}

assert(resolveDecisionLink('working/draft.md', '../ratified.md') === 'ratified.md', 'relative links may resolve within the decisions root');
assert(resolveDecisionLink('working/draft.md', '../../people/private.md') === null, 'relative links cannot leave the decisions root');
assert(resolveDecisionLink('draft.md', 'other.md#fragment') === null, 'fragments do not become member routes');
assert(resolveDecisionLink('draft.md', '%2e%2e/people.md') === null, 'encoded traversal fails closed');
assert(classifyDecisionLink('draft.md', 'https://example.org/context').kind === 'external', 'HTTPS links are external');
assert(classifyDecisionLink('draft.md', 'javascript:alert(1)').kind === 'inert', 'executable schemes are inert');
assert(classifyDecisionLink('draft.md', 'next.md').href === '/decisions/next.md', 'decision links remain in the gated route');

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
