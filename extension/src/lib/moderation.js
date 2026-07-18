// Honor the user's Bluesky content preferences (from app.bsky.actor.getPreferences)
// when rendering the Network feed, so MC never shows what their own Bluesky app
// hides: muted words, hidden posts, and per-feed view settings (replies/quotes).
//
// Reposts are handled separately by the store's live Reposts toggle (seeded from
// feedViewPref.hideReposts), not here.
//
// Fidelity note: muted-word matching covers post text and hashtags. It does not
// yet scan image alt-text, external-link card text, or quoted-post text — a
// faithful-enough v1 approximation of Bluesky's own matcher.

const MUTED_WORDS = 'app.bsky.actor.defs#mutedWordsPref';
const HIDDEN_POSTS = 'app.bsky.actor.defs#hiddenPostsPref';
const FEED_VIEW = 'app.bsky.actor.defs#feedViewPref';

// Pull the three moderation preferences out of the getPreferences union into a
// plain, JSON-serializable shape (so it can be cached in localStorage).
export function parseModerationPrefs(preferences) {
  const list = preferences || [];
  const muted = list.find((p) => p.$type === MUTED_WORDS);
  const hidden = list.find((p) => p.$type === HIDDEN_POSTS);
  const feedViews = list.filter((p) => p.$type === FEED_VIEW);
  return {
    mutedWords: (muted?.items || []).map((w) => ({
      value: w.value || '',
      targets: w.targets && w.targets.length ? w.targets : ['content'],
      actorTarget: w.actorTarget || 'all',
      expiresAt: w.expiresAt || null,
    })),
    hiddenPosts: hidden?.items || [],
    feedViews: feedViews.map((f) => ({
      feed: f.feed,
      hideReplies: !!f.hideReplies,
      hideRepliesByUnfollowed: !!f.hideRepliesByUnfollowed,
      hideRepliesByLikeCount: f.hideRepliesByLikeCount || 0,
      hideReposts: !!f.hideReposts,
      hideQuotePosts: !!f.hideQuotePosts,
    })),
  };
}

export const EMPTY_PREFS = { mutedWords: [], hiddenPosts: [], feedViews: [] };

// feedViewPref is keyed per feed; the Following timeline uses the special 'home' key.
export function feedViewFor(prefs, feedUri) {
  const key = feedUri === 'timeline' ? 'home' : feedUri;
  return (prefs.feedViews || []).find((f) => f.feed === key) || null;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Match a single muted value against post text. Phrases (containing whitespace)
// match as a substring; single words match on word boundaries so "art" does not
// mute "cartoon".
function matchesContent(value, text) {
  const v = value.trim().toLowerCase();
  if (!v) return false;
  const t = text.toLowerCase();
  if (/\s/.test(v)) return t.includes(v);
  try {
    const re = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegExp(v)}(?:[^\\p{L}\\p{N}]|$)`, 'u');
    return re.test(t);
  } catch {
    return t.includes(v);
  }
}

function postHashtags(post) {
  const tags = [];
  for (const f of post.facets || []) {
    for (const feat of f.features || []) {
      if (feat.$type === 'app.bsky.richtext.facet#tag' && feat.tag) tags.push(feat.tag.toLowerCase());
    }
  }
  return tags;
}

function isExpired(expiresAt, nowMs) {
  return !!expiresAt && new Date(expiresAt).getTime() < nowMs;
}

// True if any active muted word matches this post (respecting targets,
// actorTarget, and expiry).
export function matchesMutedWord(post, mutedWords, nowMs) {
  if (!mutedWords || mutedWords.length === 0) return false;
  const text = post.text || '';
  let tags = null; // computed lazily, only if a tag-target rule exists
  for (const w of mutedWords) {
    if (isExpired(w.expiresAt, nowMs)) continue;
    // "exclude-following" mutes do not apply to accounts the user follows.
    if (w.actorTarget === 'exclude-following' && post.author?.viewer?.following) continue;
    if (w.targets.includes('content') && text && matchesContent(w.value, text)) return true;
    if (w.targets.includes('tag')) {
      if (tags === null) tags = postHashtags(post);
      const val = w.value.replace(/^#/, '').trim().toLowerCase();
      if (val && tags.includes(val)) return true;
    }
  }
  return false;
}

// Whether a post should be hidden for the active feed. Reposts are NOT decided
// here (the store's Reposts toggle owns them).
export function isPostHidden(post, prefs, feedUri, nowMs) {
  if (!prefs) return false;
  if ((prefs.hiddenPosts || []).includes(post.uri)) return true;
  if (matchesMutedWord(post, prefs.mutedWords, nowMs)) return true;
  const fv = feedViewFor(prefs, feedUri);
  if (fv) {
    if (post.isReply) {
      if (fv.hideReplies) return true;
      if (fv.hideRepliesByUnfollowed && !post.author?.viewer?.following) return true;
      if (fv.hideRepliesByLikeCount > 0 && (post.likeCount || 0) < fv.hideRepliesByLikeCount) return true;
    }
    if (fv.hideQuotePosts && post.isQuote) return true;
  }
  return false;
}
