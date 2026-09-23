const MAX_PATH_BYTES = 2_048;
const UNSAFE_SEGMENT_CHARACTERS = /[<>:"\\|?*\u0000-\u001f\u007f]/u;

function utf8Length(value) {
  return new TextEncoder().encode(value).byteLength;
}

export function validateDecisionPath(value) {
  if (typeof value !== 'string' || value.length === 0 || utf8Length(value) > MAX_PATH_BYTES
    || value !== value.normalize('NFC') || value.startsWith('/') || value.includes('\\')) {
    throw new Error('Invalid decision path');
  }
  const segments = value.split('/');
  if (segments.some((segment) => (
    segment.length === 0
    || segment === '.'
    || segment === '..'
    || segment.endsWith('.')
    || segment.endsWith(' ')
    || utf8Length(segment) > 255
    || UNSAFE_SEGMENT_CHARACTERS.test(segment)
  )) || !segments.at(-1).endsWith('.md')) {
    throw new Error('Invalid decision path');
  }
  return segments.join('/');
}

export function decisionRoutePath(path) {
  return `/decisions/${validateDecisionPath(path).split('/').map(encodeURIComponent).join('/')}`;
}

export function resolveDecisionLink(currentPath, href) {
  if (typeof href !== 'string' || href.length === 0 || href.includes('\\')
    || href.startsWith('/') || href.startsWith('//') || href.includes('?') || href.includes('#')) {
    return null;
  }
  const base = validateDecisionPath(currentPath).split('/').slice(0, -1);
  for (const rawSegment of href.split('/')) {
    let segment;
    try { segment = decodeURIComponent(rawSegment); } catch { return null; }
    if (segment.includes('/') || segment.includes('\\')) return null;
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (base.length === 0) return null;
      base.pop();
    } else {
      base.push(segment);
    }
  }
  try { return validateDecisionPath(base.join('/')); } catch { return null; }
}

export function classifyDecisionLink(currentPath, href) {
  try {
    const url = new URL(href);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return { kind: 'external', href: url.href };
    }
    return { kind: 'inert' };
  } catch {
    const decisionPath = resolveDecisionLink(currentPath, href);
    return decisionPath
      ? { kind: 'decision', path: decisionPath, href: decisionRoutePath(decisionPath) }
      : { kind: 'inert' };
  }
}
