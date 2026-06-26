export function getFaviconUrl(pageUrl) {
  try {
    const { hostname } = new URL(pageUrl);
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  } catch {
    return '';
  }
}

export function getDomain(pageUrl) {
  try {
    return new URL(pageUrl).hostname.replace(/^www\./, '');
  } catch {
    return pageUrl;
  }
}
