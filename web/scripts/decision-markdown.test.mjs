import { parseDecisionMarkdown } from '../src/decision-markdown.js';

let failures = 0;
const assert = (condition, message) => {
  if (condition) console.log('ok:', message);
  else { console.error('FAIL:', message); failures += 1; }
};

const html = parseDecisionMarkdown(`# Decision

<script>window.compromised = true</script>

![tracking pixel](https://tracker.example/pixel.png)

[Context](https://example.org/context)

[Next](next.md)

[Private](../people/member.md)

[Run code](javascript:alert(1))
`, 'working/current.md');

assert(!html.includes('<script>') && html.includes('&lt;script&gt;'), 'raw HTML is rendered as inert text');
assert(!html.includes('<img'), 'images never create a network-loading element');
assert(html.includes('tracking pixel'), 'image alt text remains readable');
assert(html.includes('target="_blank"') && html.includes('rel="noopener noreferrer"'), 'external HTTPS links open safely');
assert(html.includes('href="/decisions/working/next.md"'), 'relative decision links stay in the gated namespace');
assert(!html.includes('../people/member.md'), 'links outside the decisions root are inert');
assert(!html.includes('javascript:'), 'executable links are inert');

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
