import { useEffect, useState } from 'preact/hooks';
import {
  previewSkin,
  refreshSkins,
  restoreDefaultSkin,
  selectSkin,
  skinsEnabled,
  skinState,
} from '../store/skin';
import { caSignedIn } from '../store/caAuth';
import { previewVariables, sameRef } from '../lib/skin-runtime';
import { getCommunityColors } from '../lib/community-colors';
import '../styles/skin-chooser.css';

const PREVIEW_ERRORS = {
  withdrawn: 'The community withdrew this revision, so it can no longer be used.',
  unavailable: 'This skin is not available to you right now.',
  incompatible: 'This skin cannot be shown safely by this version of My Community.',
  offline: 'The skin could not be loaded. Check your connection and try again.',
};

function currentMode() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

// Appearance > Skin (#18). Shared by the extension's Settings and the web
// companion's. Previewing renders inside a scoped frame and never touches the
// page or the saved choice; only "Use this skin" does.
export function SkinChooser() {
  const state = skinState.value;
  const [resolved, setResolved] = useState({}); // optionKey -> validated revision entry
  const [preview, setPreview] = useState(null); // { option, entry, mode }
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { void refreshSkins(); }, []);

  // Official revisions are immutable and cached for good, so resolving each
  // option's name and swatch costs one request per revision ever, then none.
  // This only fills this device's cache; it selects nothing.
  useEffect(() => {
    let cancelled = false;
    for (const option of state.options) {
      const key = optionKey(option);
      if (resolved[key]) continue;
      previewSkin(option).then((result) => {
        if (!cancelled && result.entry) setResolved((prev) => ({ ...prev, [key]: result.entry }));
      });
    }
    return () => { cancelled = true; };
  }, [state.options]);

  if (!skinsEnabled) return null;

  const selection = state.selection;
  const applied = state.applied;
  const rows = communityRows(state, resolved);

  async function openPreview(option) {
    setError('');
    setBusy(optionKey(option));
    const result = await previewSkin(option);
    setBusy(null);
    if (!result.entry) { setError(PREVIEW_ERRORS[result.error] || PREVIEW_ERRORS.unavailable); return; }
    setPreview({ option, entry: result.entry, mode: currentMode() });
  }

  async function useSkin(option) {
    setError('');
    setBusy('apply');
    const result = await selectSkin(option);
    setBusy(null);
    if (!result.entry) { setError(PREVIEW_ERRORS[result.error] || PREVIEW_ERRORS.unavailable); return; }
    setPreview(null);
  }

  return (
    <div class="skin-chooser">
      <div class="skin-chooser-head">
        <h5 class="skin-chooser-title" id="mc-skin-label">Skin</h5>
        <p class="skin-chooser-hint">
          A community skin changes colours, type and corners across your whole dashboard. Your layout and feeds stay the same, and nothing changes until you choose it.
        </p>
      </div>

      {state.notice && (
        <p class={`skin-notice skin-notice-${state.notice.kind}`} role="status">{state.notice.message}</p>
      )}

      <ul class="skin-options" aria-labelledby="mc-skin-label">
        <li class={`skin-option ${!selection ? 'is-current' : ''}`}>
          <span class="skin-swatch skin-swatch-default" aria-hidden="true" />
          <span class="skin-option-text">
            <strong>Community Almanac</strong>
            <small>My Community default · always available</small>
          </span>
          <span class="skin-option-actions">
            {!selection ? (
              <span class="skin-option-state">In use</span>
            ) : (
              <button type="button" class="skin-action" onClick={() => { setPreview(null); restoreDefaultSkin(); }}>
                Restore My Community default
              </button>
            )}
          </span>
        </li>

        {rows.map((row) => (
          <li key={row.communityId} class={`skin-option ${row.current ? 'is-current' : ''}`}>
            <span class="skin-swatch" aria-hidden="true" style={row.swatch} />
            <span class="skin-option-text">
              <strong>{row.name}</strong>
              <small>
                From {row.communityName} · revision {row.revision}
                {row.withdrawn && ' · withdrawn'}
              </small>
              {row.update && (
                <small class="skin-update">Revision {row.update.revision} is available. Your skin stays as it is until you choose it.</small>
              )}
            </span>
            <span class="skin-option-actions">
              {row.current && <span class="skin-option-state">In use</span>}
              {row.update && (
                <button type="button" class="skin-action" disabled={!!busy} onClick={() => openPreview(row.update)}>
                  {busy === optionKey(row.update) ? 'Loading…' : 'Preview update'}
                </button>
              )}
              {!row.current && row.option && (
                <button type="button" class="skin-action" disabled={!!busy} onClick={() => openPreview(row.option)}>
                  {busy === optionKey(row.option) ? 'Loading…' : 'Preview'}
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>

      {state.status === 'loading' && !rows.length && <p class="skin-chooser-hint">Checking your communities for skins…</p>}
      {state.status === 'ready' && !rows.length && (
        <p class="skin-chooser-hint">
          None of your communities offers a skin yet.{!caSignedIn.value && ' Skins from private communities appear after you sign in.'}
        </p>
      )}
      {state.status === 'offline' && (
        <p class="skin-chooser-hint">
          Community skins could not be checked right now.{' '}
          <button type="button" class="skin-link" onClick={() => refreshSkins()}>Try again</button>
        </p>
      )}
      {error && <p class="skin-error" role="alert">{error}</p>}

      {preview && (
        <SkinPreviewPanel
          preview={preview}
          busy={busy === 'apply'}
          inUse={sameRef(preview.option, selection) && !!applied}
          onMode={(mode) => setPreview({ ...preview, mode })}
          onUse={() => useSkin(preview.option)}
          onCancel={() => setPreview(null)}
        />
      )}
    </div>
  );
}

function optionKey(option) {
  return `${option.communityId}:${option.skinId}:${option.revision}`;
}

function swatchStyle(skin) {
  const vars = skin && previewVariables(skin, 'light');
  if (!vars) return undefined;
  return { '--swatch-page': vars['--color-bg'], '--swatch-primary': vars['--color-primary'], '--swatch-accent': vars['--color-accent'] };
}

// One row per community: the official revision, or the member's pinned
// revision of that community (with any newer official shown as an update).
function communityRows(state, resolved) {
  const rows = [];
  const selection = state.selection;
  for (const option of state.options) {
    const pinnedHere = selection && selection.communityId === option.communityId;
    if (pinnedHere) continue;
    const entry = resolved[optionKey(option)];
    rows.push({
      communityId: option.communityId,
      communityName: option.communityName,
      name: entry?.name || `${option.communityName} skin`,
      swatch: swatchStyle(entry?.skin),
      revision: option.revision,
      option,
      current: false,
    });
  }
  if (selection) {
    const entry = state.applied && sameRef(state.applied, selection) ? state.applied : null;
    const official = state.options.find((o) => o.communityId === selection.communityId);
    const known = entry || state.pinned;
    const communityName = known?.communityName || official?.communityName || selection.communityId;
    rows.unshift({
      communityId: selection.communityId,
      communityName,
      name: known?.name || `${communityName} skin`,
      revision: selection.revision,
      swatch: swatchStyle(entry?.skin),
      current: !!entry,
      withdrawn: state.notice?.kind === 'withdrawn',
      update: state.update,
      // Not applied (withdrawn, unavailable…) but the community still offers
      // an official revision: let the member preview and choose that instead.
      option: !entry && official && !state.update && !sameRef(official, selection) ? official : null,
    });
  }
  return rows;
}

function SkinPreviewPanel({ preview, busy, inUse, onMode, onUse, onCancel }) {
  const { entry, mode } = preview;
  const vars = previewVariables(entry.skin, mode);
  const provenance = getCommunityColors(entry.communityId);
  if (!vars) return null;
  return (
    <section class="skin-preview-panel" aria-label={`Preview of ${entry.name}`}>
      <div class="skin-preview-bar">
        <span>
          <strong>{entry.name}</strong> from {entry.communityName}, revision {entry.revision}
        </span>
        <span class="skin-preview-modes" role="group" aria-label="Preview mode">
          {['light', 'dark'].map((value) => (
            <button key={value} type="button" aria-pressed={mode === value} class={mode === value ? 'active' : ''} onClick={() => onMode(value)}>
              {value === 'light' ? 'Light' : 'Dark'}
            </button>
          ))}
        </span>
      </div>

      {/* Scoped: the variables apply to this frame only. */}
      <div class="skin-preview" style={vars} data-theme-preview={mode}>
        <div class="skin-preview-top">
          <span class="skin-preview-brand">My Community</span>
          <span class="skin-preview-chip is-active">Digest</span>
          <span class="skin-preview-chip">Participation</span>
        </div>
        <article class="skin-preview-card" style={{ '--provenance': provenance.border }}>
          <p class="skin-preview-meta">{entry.communityName} · 2 hours ago</p>
          <h6 class="skin-preview-title">A reading card, set in this skin</h6>
          <p class="skin-preview-body">
            Secondary text sits here, with <a href="#skin-preview" onClick={(event) => event.preventDefault()}>a link</a> and
            <span class="skin-preview-muted"> muted metadata</span>.
          </p>
          <div class="skin-preview-actions">
            <span class="skin-preview-button is-primary">Join</span>
            <span class="skin-preview-button">Save for later</span>
            <span class="skin-preview-button is-accent">New</span>
            <span class="skin-preview-button is-focus">Focused</span>
          </div>
          <span class="skin-preview-input">Search your communities</span>
          <span class="skin-preview-loading" aria-hidden="true" />
        </article>
      </div>

      <div class="skin-preview-footer">
        {inUse ? (
          <span class="skin-option-state">In use</span>
        ) : (
          <button type="button" class="skin-use" disabled={busy} onClick={onUse}>
            {busy ? 'Applying…' : 'Use this skin'}
          </button>
        )}
        <button type="button" class="skin-action" onClick={onCancel}>Cancel preview</button>
      </div>
    </section>
  );
}
