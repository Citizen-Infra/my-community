import { jamRooms } from '../store/jam';
import { selectedCommunityIds } from '../store/communities';
import { getCommunityColors } from '../lib/community-colors';
import '../styles/jam.css';

export function JamBanner() {
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
              <span class="jam-banner-icon">{'\u266B'}</span>
            </div>
            <span class="jam-banner-label">Jam</span>
            <span class="jam-banner-text">
              <strong>{room.hostName}</strong>
              {trackText ? <> is listening to <em>{trackText}</em></> : ' has a room open'}
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
