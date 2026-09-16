import { useEffect, useRef } from 'preact/hooks';
import { preferencePrompt, resolvePreferencePrompt } from '../store/preferences';
import '../styles/preference-reconciliation.css';

export function PreferenceReconciliation() {
  const prompt = preferencePrompt.value;
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!prompt) return undefined;
    const dialog = dialogRef.current;
    dialog?.focus();
    const onKeyDown = (event) => {
      if (event.key !== 'Tab' || !dialog) return;
      const buttons = [...dialog.querySelectorAll('button:not(:disabled)')];
      if (!buttons.length) return;
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus(); }
    };
    addEventListener('keydown', onKeyDown);
    return () => removeEventListener('keydown', onKeyDown);
  }, [prompt]);
  if (!prompt) return null;
  const conflict = prompt.kind === 'conflict';
  const absent = prompt.kind === 'save-local';
  return (
    <div class="preference-dialog-backdrop" role="presentation">
      <section ref={dialogRef} tabindex="-1" class="preference-dialog" role="dialog" aria-modal="true" aria-labelledby="preference-dialog-title">
        <p class="preference-dialog-kicker">Cross-device continuity</p>
        <h2 id="preference-dialog-title">
          {conflict ? 'A newer layout was saved elsewhere' : absent ? 'Save this dashboard to your account?' : 'Which dashboard layout should this device use?'}
        </h2>
        <p>
          {conflict
            ? 'Nothing has been overwritten. Choose the saved layout, or deliberately replace it with what is on this device.'
            : absent
              ? 'Your communities, feed order, and dashboard settings can follow you across the web and extension.'
              : 'Your account already has a different dashboard. We will not merge or replace either one without your choice.'}
        </p>
        <div class="preference-dialog-actions">
          {prompt.remote && (
            <button type="button" class="preference-dialog-primary" onClick={() => resolvePreferencePrompt('remote')}>
              Use saved layout
            </button>
          )}
          <button type="button" class={prompt.remote ? 'preference-dialog-secondary' : 'preference-dialog-primary'} onClick={() => resolvePreferencePrompt('local')}>
            {prompt.remote ? 'Use this device' : 'Save this device'}
          </button>
          {!conflict && (
            <button type="button" class="preference-dialog-quiet" onClick={() => resolvePreferencePrompt('later')}>Not now</button>
          )}
        </div>
      </section>
    </div>
  );
}
