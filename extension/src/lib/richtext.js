// Split ATProto post text into rich-text segments using facets.
//
// Facet ranges are UTF-8 *byte* offsets, not JS string indices, so we encode the
// text to bytes, slice each run, and decode it back. Returns an array of
//   { text, facet: null | { type: 'link' | 'mention' | 'tag', value } }
// Plain runs have facet: null. Overlapping or out-of-range facets are skipped.
//
// Shared by the Bluesky card and (later) the Leaflet reader, which use the same
// facet model.
export function segmentText(text, facets) {
  if (!text) return [];
  if (!facets || facets.length === 0) return [{ text, facet: null }];

  const bytes = new TextEncoder().encode(text);
  const decoder = new TextDecoder();
  const decode = (start, end) => decoder.decode(bytes.subarray(start, end));

  const ranges = facets
    .filter((f) => f && f.index && Array.isArray(f.features) && f.features.length > 0)
    .map((f) => ({ start: f.index.byteStart, end: f.index.byteEnd, facet: featureOf(f.features[0]) }))
    .filter((r) => r.facet
      && Number.isInteger(r.start) && Number.isInteger(r.end)
      && r.start >= 0 && r.start < r.end && r.end <= bytes.length)
    .sort((a, b) => a.start - b.start);

  const segments = [];
  let cursor = 0;
  for (const r of ranges) {
    if (r.start < cursor) continue; // skip a facet that overlaps the previous one
    if (r.start > cursor) segments.push({ text: decode(cursor, r.start), facet: null });
    segments.push({ text: decode(r.start, r.end), facet: r.facet });
    cursor = r.end;
  }
  if (cursor < bytes.length) segments.push({ text: decode(cursor, bytes.length), facet: null });
  return segments;
}

function featureOf(feature) {
  switch (feature && feature.$type) {
    case 'app.bsky.richtext.facet#link': return { type: 'link', value: feature.uri };
    case 'app.bsky.richtext.facet#mention': return { type: 'mention', value: feature.did };
    case 'app.bsky.richtext.facet#tag': return { type: 'tag', value: feature.tag };
    default: return null;
  }
}
