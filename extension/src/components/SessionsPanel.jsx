import { useState } from 'preact/hooks';
import { activeSessions, upcomingSessions, completedSessions, sessionsLoading } from '../store/sessions';
import { jamRooms } from '../store/jam';
import { getCommunityColors } from '../lib/community-colors';
import { JamBanner } from './JamBanner';
import { AvailsBanner } from './AvailsBanner';
import '../styles/sessions.css';

export function SessionsPanel() {
  if (sessionsLoading.value) {
    return (
      <div class="sessions-panel">
        <h2 class="section-title">Participation</h2>
        <div class="sessions-empty">Loading...</div>
      </div>
    );
  }

  const active = activeSessions.value;
  const upcoming = upcomingSessions.value;
  const completed = completedSessions.value;
  const hasAny = active.length + upcoming.length + completed.length > 0;

  return (
    <div class="sessions-panel">
      <h2 class="section-title">Participation</h2>
      <JamBanner />
      <AvailsBanner />

      {!hasAny && jamRooms.value.length === 0 ? (
        <div class="sessions-empty">
          No sessions or events right now. Check back soon.
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <SessionGroup title="Happening Now" sessions={active} status="active" />
          )}
          {upcoming.length > 0 && (
            <SessionGroup title="Coming Up" sessions={upcoming} status="upcoming" />
          )}
          {completed.length > 0 && (
            <SessionGroup title="Recently Completed" sessions={completed} status="completed" />
          )}
        </>
      )}
    </div>
  );
}

function SessionGroup({ title, sessions, status }) {
  return (
    <div class="session-group">
      <h3 class={`session-group-title status-${status}`}>{title}</h3>
      <div class="session-list">
        {sessions.map((session) => (
          <SessionCard key={session.id} session={session} status={status} />
        ))}
      </div>
    </div>
  );
}

const SOURCE_LABELS = {
  luma: 'Luma',
  telegram: 'Telegram',
  session: 'Session',
};

function SessionCard({ session, status }) {
  const [imgError, setImgError] = useState(false);

  const timeStr = session.starts_at
    ? new Date(session.starts_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const href = session.source === 'session'
    ? `https://harmonica.chat/session/${session.harmonica_session_id}`
    : session.url;

  const sourceLabel = SOURCE_LABELS[session.source] || session.source;
  const colors = session.community ? getCommunityColors(session.community) : null;
  const cover = (!imgError && session.image) ? session.image : null;

  return (
    <a
      class={`session-card status-${status} ${cover ? 'has-cover' : ''}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={colors ? { '--community-border': colors.border, '--community-bg': colors.bg, '--community-text': colors.text } : undefined}
    >
      {colors && <div class="session-card-accent" />}
      <div class="session-card-body">
        <div class="session-card-header">
          <div class="session-card-meta">
            <span class={`session-status-badge status-${status}`}>
              {status === 'active' ? 'Live' : status === 'upcoming' ? 'Upcoming' : 'Done'}
            </span>
            {session.source && session.source !== 'session' && (
              <span class={`session-source-badge source-${session.source}`}>{sourceLabel}</span>
            )}
            {session.community && (
              <span class="session-community-badge" style={{ background: colors?.bg, color: colors?.text, borderColor: colors?.border }}>{session.community}</span>
            )}
          </div>
          {timeStr && <span class="session-time">{timeStr}</span>}
        </div>
        <h4 class="session-title">{session.title}</h4>
        {session.description && (
          <p class="session-description">{session.description}</p>
        )}
        {session.location && (
          <p class="session-location">{session.location}</p>
        )}
        {session.topic_names?.length > 0 && (
          <div class="session-tags">
            {session.topic_names.map((name) => (
              <span key={name} class="session-tag">{name}</span>
            ))}
          </div>
        )}
      </div>
      {cover && (
        <div class="session-card-thumb">
          <img src={cover} alt="" loading="lazy" onError={() => setImgError(true)} />
        </div>
      )}
    </a>
  );
}
