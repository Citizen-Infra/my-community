import { availsPolls } from '../store/avails';
import { getCommunityColors } from '../lib/community-colors';

// Scheduling polls published to the community feed (#5 sub-project F), rendered
// as first-class cards in the SessionCard idiom. A poll is an action request, so
// it carries amber (DESIGN.md's rationed emphasis accent); events stay green.

function formatDateWindow(dates) {
  if (!Array.isArray(dates) || dates.length === 0) return null;
  const parsed = dates
    .map((d) => new Date(`${d}T12:00:00`)) // noon avoids a UTC date shift
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a - b);
  if (parsed.length === 0) return null;
  const first = parsed[0];
  const last = parsed[parsed.length - 1];
  const withMonth = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const dayOnly = (d) => d.toLocaleDateString(undefined, { day: 'numeric' });
  if (parsed.length === 1) return withMonth(first);
  const sameMonth = first.getMonth() === last.getMonth();
  const range = sameMonth ? `${withMonth(first)} to ${dayOnly(last)}` : `${withMonth(first)} to ${withMonth(last)}`;
  return `${range} · ${parsed.length} dates`;
}

function PollCard({ poll }) {
  const colors = poll.community ? getCommunityColors(poll.community) : null;
  const count = poll.responseCount ?? 0; // API sends responseCount (camelCase)
  const responseText = count === 0 ? 'No responses yet' : count === 1 ? '1 response' : `${count} responses`;
  const dateWindow = formatDateWindow(poll.dates);

  return (
    <a
      class="session-card poll-card"
      href={`https://avails.zhgnv.com/p/${poll.did}/${poll.rkey}`}
      target="_blank"
      rel="noopener noreferrer"
      style={colors ? { '--community-border': colors.border, '--community-bg': colors.bg, '--community-text': colors.text } : undefined}
    >
      {colors && <div class="session-card-accent" />}
      <div class="session-card-body">
        <div class="session-card-header">
          <div class="session-card-meta">
            <span class="poll-status-badge">Poll open</span>
            {poll.community && (
              <span class="session-community-badge" style={{ background: colors?.bg, color: colors?.text, borderColor: colors?.border }}>{poll.community}</span>
            )}
          </div>
          {dateWindow && <span class="session-time">{dateWindow}</span>}
        </div>
        <h4 class="session-title">{poll.title}</h4>
        <div class="poll-card-footer">
          <span class="poll-responses">{responseText}</span>
          <span class="poll-cta">Add yours <span class="poll-cta-arrow">→</span></span>
        </div>
      </div>
    </a>
  );
}

export function AvailsPollCards() {
  const polls = availsPolls.value;
  if (polls.length === 0) return null;

  return (
    <div class="session-group">
      <h3 class="session-group-title poll-group-title">Finding a time</h3>
      <div class="session-list">
        {polls.map((poll) => (
          <PollCard key={`${poll.did}/${poll.rkey}`} poll={poll} />
        ))}
      </div>
    </div>
  );
}
