import DOMPurify from 'dompurify';
import { Marked, Renderer } from 'marked';
import { classifyDecisionLink } from './decision-path.js';

const ALLOWED_TAGS = [
  'a', 'blockquote', 'br', 'code', 'del', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hr', 'li', 'ol', 'p', 'pre', 'strong', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul',
];
const ALLOWED_ATTR = ['href', 'rel', 'target', 'title'];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function rendererFor(currentPath) {
  const renderer = new Renderer();
  renderer.html = ({ text }) => escapeHtml(text);
  renderer.image = ({ text }) => escapeHtml(text);
  renderer.link = function link({ href, title, tokens }) {
    const label = this.parser.parseInline(tokens);
    const destination = classifyDecisionLink(currentPath, href);
    if (destination.kind === 'inert') return label;
    const titleAttribute = title ? ` title="${escapeHtml(title)}"` : '';
    if (destination.kind === 'decision') {
      return `<a href="${escapeHtml(destination.href)}"${titleAttribute}>${label}</a>`;
    }
    return `<a href="${escapeHtml(destination.href)}"${titleAttribute} target="_blank" rel="noopener noreferrer">${label}</a>`;
  };
  return renderer;
}

export function parseDecisionMarkdown(markdown, currentPath) {
  const parser = new Marked({ gfm: true, breaks: false, renderer: rendererFor(currentPath) });
  return parser.parse(markdown);
}

export function renderDecisionMarkdown(markdown, currentPath) {
  return DOMPurify.sanitize(parseDecisionMarkdown(markdown, currentPath), {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_ARIA_ATTR: false,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['base', 'embed', 'form', 'iframe', 'img', 'link', 'meta', 'object', 'script', 'style', 'svg', 'template'],
    FORBID_ATTR: ['action', 'formaction', 'src', 'srcset', 'style', 'xlink:href'],
  });
}
