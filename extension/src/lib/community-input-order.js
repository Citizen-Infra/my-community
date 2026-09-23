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

export function brainDecisionTier(decision) {
  if (decision.status === 'needs-response') return 0;
  if (decision.status === 'in-progress') return 1;
  return 2;
}

const KIND_RANK = { decision: 0, 'brain-decision': 1, knowledge: 2 };

export function mergeCommunityInputRows(decisions, knowledge, brainDecisions = [], now = Date.now()) {
  const rows = [
    ...decisions.map((proposal) => ({ kind: 'decision', tier: decisionTier(proposal, now), p: proposal })),
    ...knowledge.map((item) => ({ kind: 'knowledge', tier: knowledgeTier(item), k: item })),
    ...brainDecisions.map((decision) => ({ kind: 'brain-decision', tier: brainDecisionTier(decision), d: decision })),
  ];
  rows.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.kind !== b.kind) return KIND_RANK[a.kind] - KIND_RANK[b.kind];
    if (a.kind === 'brain-decision') return b.d.date.localeCompare(a.d.date) || b.d.path.localeCompare(a.d.path);
    return 0;
  });
  return rows;
}
