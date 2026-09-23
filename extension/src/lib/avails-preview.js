function responseSummary(value) {
  const count = Number.isFinite(value) ? value : 0;
  if (count === 0) return 'No responses yet';
  if (count === 1) return '1 response';
  return `${count} responses`;
}

// A pinned deployment keeps its community id selected before sign-in. Private
// communities enter this collection after authenticated discovery, but may remain
// in memory if that session is revoked. Avails' list endpoint is public, so reads
// must use the visible collection and independently enforce its visibility marker.
export function visibleAvailsCommunityIds(communities, {
  signedIn = false,
  requireSignIn = false,
} = {}) {
  if (!Array.isArray(communities)) return [];
  if (requireSignIn && !signedIn) return [];
  return communities
    .filter(Boolean)
    .filter((community) => community?.visibility !== 'private' || signedIn)
    .map((community) => community.id)
    .filter((id) => typeof id === 'string' && id.length > 0);
}

export function availsParticipationPreview(poll, { availsUrl, communityName } = {}) {
  const community = poll.community || '';
  const did = poll.did || '';
  const rkey = poll.rkey || '';
  const baseUrl = String(availsUrl || '').replace(/\/$/, '');

  return {
    ...poll,
    community_id: community,
    id: `${did}/${rkey}`,
    source: 'avails',
    title: poll.title || 'Scheduling poll',
    previewHref: baseUrl && did && rkey ? `${baseUrl}/p/${did}/${rkey}` : '',
    previewProvenance: [communityName || community, responseSummary(poll.responseCount)]
      .filter(Boolean)
      .join(' · '),
    previewStatus: 'Finding a time',
  };
}
