import '../styles/live-strip.css';

/**
 * Shared slim "something is happening" cue. One anatomy, two homes:
 *   - Jam   → variant="chrome", accent="live"   (green, full-bleed under the TopBar)
 *   - Avails → variant="inset",  accent="action" (amber, rounded, in the content column)
 *
 * Compliant by construction: no colored side-stripe, no resting shadow,
 * transform-only motion. Callers supply the leading cue, label, text, and action.
 */
export function LiveStrip({ variant = 'inset', accent = 'live', href, cue, label, community, action, children }) {
  return (
    <a
      class={`live-strip live-strip--${variant} live-strip--${accent}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span class="live-strip-cue" aria-hidden="true">{cue}</span>
      <span class="live-strip-label">{label}</span>
      <span class="live-strip-text">{children}</span>
      {community && (
        <span
          class="live-strip-community"
          style={community.colors
            ? { background: community.colors.bg, color: community.colors.text, borderColor: community.colors.border }
            : undefined}
        >
          {community.name}
        </span>
      )}
      <span class="live-strip-action">{action}</span>
    </a>
  );
}
