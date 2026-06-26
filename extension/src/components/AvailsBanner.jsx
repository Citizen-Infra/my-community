import { availsPolls } from '../store/avails';
import { LiveStrip } from './LiveStrip';

export function AvailsBanner() {
  const polls = availsPolls.value;
  if (polls.length === 0) return null;

  return (
    <div class="live-strip-stack">
      {polls.map((poll) => {
        const responseCount = poll.response_count ?? 0;
        const responseText = responseCount === 1 ? '1 response' : `${responseCount} responses`;

        return (
          <LiveStrip
            key={`${poll.did}/${poll.rkey}`}
            variant="inset"
            accent="action"
            href={`https://avails.zhgnv.com/p/${poll.did}/${poll.rkey}`}
            label="Poll open"
            action="Add availability"
            cue={
              <svg class="live-strip-cal" viewBox="0 0 16 16">
                <rect x="1" y="2.5" width="14" height="12" rx="1.5" />
                <line x1="5" y1="1" x2="5" y2="4" />
                <line x1="11" y1="1" x2="11" y2="4" />
                <line x1="1" y1="6" x2="15" y2="6" />
              </svg>
            }
          >
            <strong>{poll.title}</strong>
            {responseCount > 0 && (
              <>{' · '}<span class="live-strip-responses">{responseText}</span></>
            )}
          </LiveStrip>
        );
      })}
    </div>
  );
}
