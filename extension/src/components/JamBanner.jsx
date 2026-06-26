import { jamRooms } from '../store/jam';
import { jamVisible } from '../store/panels';
import { selectedCommunityIds } from '../store/communities';
import { getCommunityColors } from '../lib/community-colors';
import { LiveStrip } from './LiveStrip';

export function JamBanner() {
  if (!jamVisible.value) return null;
  const rooms = jamRooms.value;
  if (rooms.length === 0) return null;

  // Collapse to a single chrome strip: lead with the first room, count the rest.
  const primary = rooms[0];
  const extra = rooms.length - 1;
  const colors = primary.community ? getCommunityColors(primary.community) : null;
  const showCommunity = selectedCommunityIds.value.length > 1 && primary.community;
  const trackText = primary.currentTrack?.title
    ? `${primary.currentTrack.title}${primary.currentTrack.artist ? ` · ${primary.currentTrack.artist}` : ''}`
    : null;
  const href = extra > 0 ? 'https://jam.zhgnv.com/' : `https://jam.zhgnv.com/room/${primary.id}`;

  return (
    <LiveStrip
      variant="chrome"
      accent="live"
      href={href}
      label="Now listening"
      community={showCommunity ? { name: primary.community, colors } : null}
      action={extra > 0 ? 'View all' : 'Join'}
      cue={
        <>
          <span class="live-strip-pulse" />
          <span class="live-strip-eq">
            <span class="live-strip-eq-bar" />
            <span class="live-strip-eq-bar" />
            <span class="live-strip-eq-bar" />
          </span>
        </>
      }
    >
      <strong>{primary.hostName}</strong>
      {trackText ? <>{' · '}<em>{trackText}</em></> : ' has a room open'}
      {extra > 0 && <span class="live-strip-more">+{extra} more</span>}
    </LiveStrip>
  );
}
