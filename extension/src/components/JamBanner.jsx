import { jamRooms } from '../store/jam';
import { jamVisible } from '../store/panels';
import { selectedCommunityIds } from '../store/communities';
import { getCommunityColors } from '../lib/community-colors';
import '../styles/jam.css';

export function JamBanner() {
  if (!jamVisible.value) return null;
  const rooms = jamRooms.value;
  if (rooms.length === 0) return null;

  // Collapse to a single slim strip: lead with the first room, count the rest.
  const primary = rooms[0];
  const extra = rooms.length - 1;
  const colors = primary.community ? getCommunityColors(primary.community) : null;
  const showCommunity = selectedCommunityIds.value.length > 1 && primary.community;
  const trackText = primary.currentTrack?.title
    ? `${primary.currentTrack.title}${primary.currentTrack.artist ? ` — ${primary.currentTrack.artist}` : ''}`
    : null;
  const href = extra > 0 ? 'https://jam.zhgnv.com/' : `https://jam.zhgnv.com/room/${primary.id}`;

  return (
    <a class="jam-strip" href={href} target="_blank" rel="noopener noreferrer">
      <span class="jam-strip-live" aria-hidden="true">
        <span class="jam-strip-pulse" />
        <span class="jam-strip-eq">
          <span class="jam-strip-eq-bar" />
          <span class="jam-strip-eq-bar" />
          <span class="jam-strip-eq-bar" />
        </span>
      </span>
      <span class="jam-strip-label">Now listening</span>
      <span class="jam-strip-text">
        <strong>{primary.hostName}</strong>
        {trackText ? <>{' — '}<em>{trackText}</em></> : ' has a room open'}
        {extra > 0 && <span class="jam-strip-more">+{extra} more</span>}
      </span>
      {showCommunity && (
        <span
          class="jam-strip-community"
          style={colors ? { background: colors.bg, color: colors.text, borderColor: colors.border } : undefined}
        >
          {primary.community}
        </span>
      )}
      <span class="jam-strip-join">{extra > 0 ? 'View all' : 'Join'}</span>
    </a>
  );
}
