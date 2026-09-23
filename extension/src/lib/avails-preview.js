function responseSummary(value) {
  const count = Number.isFinite(value) ? value : 0;
  if (count === 0) return 'No responses yet';
  if (count === 1) return '1 response';
  return `${count} responses`;
}

// A pinned deployment keeps its community id selected before sign-in, but private
// communities only enter this visible collection after authenticated discovery.
// Avails' list endpoint is public, so callers must derive reads from that visible
// collection rather than from locally pinned ids.
export function visibleAvailsCommunityIds(communities) {
  if (!Array.isArray(communities)) return [];
  return communities
    .map((community) => community?.id)
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
