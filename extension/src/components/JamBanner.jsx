import { jamRooms } from '../store/jam';
import { jamVisible } from '../store/panels';
import { selectedCommunityIds } from '../store/communities';
import { getCommunityColors } from '../lib/community-colors';
import '../styles/jam.css';

export function JamBanner() {
  if (!jamVisible.value) return null;
  const rooms = jamRooms.value;
  if (rooms.length === 0) return null;

  const showCommunity = selectedCommunityIds.value.length > 1;

  return (
    <div class="jam-banner-container">
      {rooms.map((room) => {
        const colors = room.community ? getCommunityColors(room.community) : null;
        const trackText = room.currentTrack?.title
          ? `${room.currentTrack.title}${room.currentTrack.artist ? ` \u2014 ${room.currentTrack.artist}` : ''}`
          : null;

        return (
          <a
            key={room.id}
            class="jam-banner"
            href={`https://jam.zhgnv.com/room/${room.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <div class="jam-banner-live">
              <span class="jam-banner-pulse" />
              <div class="jam-banner-eq">
                <span class="jam-banner-eq-bar" />
                <span class="jam-banner-eq-bar" />
                <span class="jam-banner-eq-bar" />
              </div>
            </div>
            <span class="jam-banner-label">Now listening</span>
            <span class="jam-banner-text">
              <strong>{room.hostName}</strong>
              {trackText ? <>{' \u2014 '}<em>{trackText}</em></> : ' has a room open'}
            </span>
            {showCommunity && room.community && (
              <span
                class="jam-banner-community"
                style={colors ? { background: colors.bg, color: colors.text, borderColor: colors.border } : undefined}
              >
                {room.community}
              </span>
            )}
            <span class="jam-banner-join">Join</span>
          </a>
        );
      })}
    </div>
  );
}
