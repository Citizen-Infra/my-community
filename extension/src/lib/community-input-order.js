export function decisionTier(proposal, now = Date.now()) {
  const open = new Date(proposal.closes_at).getTime() > now;
  if (open && !proposal.my_vote) return 0;
  if (open) return 1;
  return 2;
}

export function knowledgeTier(item) {
  const votable = item.status === 'candidate' || item.status === 'ready';
  if (votable && !item.my_vote) return 0;
  if (votable) return 1;
  return 2;
}

export function communityInputStatus(tier) {
  if (tier === 0) return 'Needs your response';
  if (tier === 1) return 'In progress';
  return 'Resolved';
}

export function mergeCommunityInputRows(decisions, knowledge, now = Date.now()) {
  const rows = [
    ...decisions.map((proposal) => ({ kind: 'decision', tier: decisionTier(proposal, now), p: proposal })),
    ...knowledge.map((item) => ({ kind: 'knowledge', tier: knowledgeTier(item), k: item })),
  ];
  rows.sort((a, b) => a.tier - b.tier || (a.kind === b.kind ? 0 : a.kind === 'decision' ? -1 : 1));
  return rows;
}
