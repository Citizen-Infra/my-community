import { availsPolls } from '../store/avails';
import '../styles/avails.css';

export function AvailsBanner() {
  const polls = availsPolls.value;
  if (polls.length === 0) return null;

  return (
    <div class="avails-banner-container">
      {polls.map((poll) => {
        const responseCount = poll.response_count ?? 0;
        const responseText = responseCount === 1 ? '1 response' : `${responseCount} responses`;

        return (
          <a
            key={`${poll.did}/${poll.rkey}`}
            class="avails-banner"
            href={`https://avails.zhgnv.com/p/${poll.did}/${poll.rkey}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <div class="avails-banner-icon">
              <svg class="avails-banner-icon-svg" viewBox="0 0 16 16">
                <rect x="1" y="2.5" width="14" height="12" rx="1.5" />
                <line x1="5" y1="1" x2="5" y2="4" />
                <line x1="11" y1="1" x2="11" y2="4" />
                <line x1="1" y1="6" x2="15" y2="6" />
              </svg>
            </div>
            <span class="avails-banner-label">Poll open</span>
            <span class="avails-banner-text">
              <strong>{poll.title}</strong>
              {responseCount > 0 && (
                <>{' \u2014 '}<span class="avails-banner-responses">{responseText}</span></>
              )}
            </span>
            <span class="avails-banner-cta">Add availability</span>
          </a>
        );
      })}
    </div>
  );
}
