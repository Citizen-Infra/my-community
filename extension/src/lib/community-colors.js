// Warm, editorial color palette for communities — shared by DigestCard and SessionsPanel
export const COMMUNITY_COLORS = {
  scenius: { bg: '#fef3e2', border: '#e8a33c', text: '#a16207' },
  cibc: { bg: '#e8f4f0', border: '#3d9970', text: '#1a5f45' },
  nsrt: { bg: '#f0e8f5', border: '#8b5cb5', text: '#5b3a7a' },
  harmonica: { bg: '#e8f0f8', border: '#4a7fba', text: '#2d5a8a' },
  ofl: { bg: '#e8f0f8', border: '#4a7fba', text: '#2d5a8a' },
};

const FALLBACK_COLORS = [
  { bg: '#fce8e8', border: '#c45c5c', text: '#8b3a3a' },
  { bg: '#e8f8f0', border: '#4ab586', text: '#2a7a56' },
  { bg: '#f8f0e8', border: '#ba8a4a', text: '#7a5a2a' },
  { bg: '#e8e8f8', border: '#6a6aba', text: '#4a4a8a' },
];

export function getCommunityColors(communityId) {
  if (!communityId) return FALLBACK_COLORS[0];
  if (COMMUNITY_COLORS[communityId]) {
    return COMMUNITY_COLORS[communityId];
  }
  const hash = communityId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}
