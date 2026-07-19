// Shown when a feed's data genuinely failed to load and there is nothing cached
// to fall back to, so an outage reads as an outage rather than an empty feed.
// Calm by design (muted text, a quiet retry), not an alarm.
export function FeedError({ onRetry, message }) {
  return (
    <div class="feed-error">
      <p class="feed-error-text">
        {message || "Something didn't load. Check your connection and try again."}
      </p>
      <button type="button" class="feed-error-retry" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
