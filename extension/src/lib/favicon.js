// Site icons come from Chrome's own local cache, never from a third party (#92).
//
// This used to return `https://www.google.com/s2/favicons?domain=<hostname>`,
// which sent the hostname of every saved tab to Google along with the user's IP
// — and did it again on every render of the collection, not once at save time.
// For a tab manager inside a local-first community dashboard that was the one
// thing contradicting the privacy story, and the most-used feature doing it.
//
// The `_favicon/` path is served by the extension itself under the `favicon`
// permission, reading the browser's existing favicon cache. No network request
// is made at all. A site Chrome has never seen falls back to a default icon,
// which is the right trade.
export function getFaviconUrl(pageUrl) {
  try {
    // Validate first: chrome.runtime.getURL happily builds a URL for garbage,
    // and an unparseable page URL should yield no icon rather than a broken one.
    new URL(pageUrl);
  } catch {
    return '';
  }
  const url = new URL(chrome.runtime.getURL('/_favicon/'));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', '32');
  return url.toString();
}

export function getDomain(pageUrl) {
  try {
    return new URL(pageUrl).hostname.replace(/^www\./, '');
  } catch {
    return pageUrl;
  }
}
