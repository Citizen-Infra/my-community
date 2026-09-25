// Community skin schema + interpreter (community-admin#153, my-community#18).
//
// ONE module: the server validates drafts and publications with it and the
// admin panel's preview renders through it. My Community should apply a
// member's selected skin through this same module when my-community#18 lands,
// not a reimplementation of it. The issue asks
// for the preview to use "the same schema interpreter as My Community rather
// than a hand-styled approximation", and the only way that stays true is for
// there to be exactly one interpreter.
//
// Dependency-free and environment-free on purpose: no DOM, no Node APIs, so it
// runs unchanged in Node, Vite and the extension.
//
// The security model is closed-world. A skin is data, never CSS: every colour
// is a normalized `#rrggbb`, every other value is a member of a fixed enum, and
// unknown keys are rejected rather than ignored. The interpreter maps those
// values onto a FIXED list of custom properties, so no skin can name a
// property, write a selector, reach a URL or change anything the schema does
// not list (spacing, density, status, danger, focus colour, provenance).

export const SKIN_SCHEMA_VERSION = 1;
// The versions the active My Community contract can render. Publishing is
// refused for anything else, so a revision can never be published that the
// extension would have to fall back from.
export const SUPPORTED_SKIN_SCHEMA_VERSIONS = [1];

// Serialized size cap for any skin document. v1 at its largest is ~1.2KB; the
// headroom is for names, not for smuggling.
export const MAX_SKIN_BYTES = 4096;
export const MAX_SKIN_NAME_LENGTH = 60;

export const TYPOGRAPHY_PRESETS = ['editorial', 'sans', 'system'];
export const SHAPE_PRESETS = ['soft', 'square', 'rounded'];
export const MODES = ['light', 'dark'];

// The recognized palette roles, in the order the editor shows them. `vars` is
// the full list of My Community custom properties a role may write.
export const PALETTE_ROLES = [
  { key: 'page', label: 'Page', vars: ['--color-bg'] },
  { key: 'surface', label: 'Surface', vars: ['--color-surface', '--color-surface-raised'] },
  { key: 'surfaceHover', label: 'Surface hover', vars: ['--color-surface-hover'] },
  { key: 'primary', label: 'Primary', vars: ['--color-primary'] },
  { key: 'primaryHover', label: 'Primary hover', vars: ['--color-primary-hover'] },
  { key: 'onPrimary', label: 'Text on primary', vars: ['--color-on-primary'] },
  { key: 'accent', label: 'Accent', vars: ['--color-accent'] },
  { key: 'accentHover', label: 'Accent hover', vars: ['--color-accent-hover'] },
  { key: 'onAccent', label: 'Text on accent', vars: ['--color-on-accent'] },
  { key: 'text', label: 'Text', vars: ['--color-text'] },
  { key: 'textSecondary', label: 'Secondary text', vars: ['--color-text-secondary'] },
  { key: 'textMuted', label: 'Muted text', vars: ['--color-text-muted'] },
  { key: 'border', label: 'Border', vars: ['--color-border'] },
  { key: 'borderLight', label: 'Light border', vars: ['--color-border-light'] },
];
export const PALETTE_ROLE_KEYS = PALETTE_ROLES.map((r) => r.key);

const SKIN_KEYS = ['schemaVersion', 'name', 'light', 'dark', 'typography', 'shape'];

// My Community's own appearance, expressed as a v1 skin. "Reset to My
// Community default" in the editor loads exactly this.
//
// Muted text is the AA-corrected value community-admin already ships
// (#726d68 light, #8a847e dark) rather than My Community's #a8a29e/#6b6560,
// which measure 2.3:1 and 3.3:1 on paper and would make the default itself
// unpublishable under the contrast gate below.
export const DEFAULT_SKIN = Object.freeze({
  schemaVersion: 1,
  name: 'My Community',
  light: Object.freeze({
    page: '#f8f6f1',
    surface: '#ffffff',
    surfaceHover: '#f3f1ec',
    primary: '#2d6a4f',
    primaryHover: '#1b4d3e',
    onPrimary: '#faf8f4',
    accent: '#d97706',
    accentHover: '#b45309',
    onAccent: '#1c1917',
    text: '#1c1917',
    textSecondary: '#57534e',
    textMuted: '#726d68',
    border: '#ddd9d0',
    borderLight: '#eceae4',
  }),
  dark: Object.freeze({
    page: '#151311',
    surface: '#1e1c19',
    surfaceHover: '#282520',
    primary: '#4ade80',
    primaryHover: '#22c55e',
    onPrimary: '#14130f',
    accent: '#fbbf24',
    accentHover: '#f59e0b',
    onAccent: '#1c1917',
    text: '#ede9e3',
    textSecondary: '#a8a29e',
    textMuted: '#8a847e',
    border: '#3d3a33',
    borderLight: '#2a2723',
  }),
  typography: 'editorial',
  shape: 'soft',
});

// Only font families My Community already bundles or the OS supplies. A skin
// picks a preset name; it can never name a font, so it can never make the
// extension fetch one.
const TYPOGRAPHY = {
  editorial: {
    '--font-display': "'Instrument Serif', Georgia, serif",
    '--font-body': "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  sans: {
    '--font-display': "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    '--font-body': "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  system: {
    '--font-display': "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    '--font-body': "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
};

// Corner radii only. --radius-full (pills) is structural and stays put.
const SHAPE = {
  soft: { '--radius-sm': '8px', '--radius-md': '12px', '--radius-lg': '18px' },
  square: { '--radius-sm': '2px', '--radius-md': '4px', '--radius-lg': '6px' },
  rounded: { '--radius-sm': '12px', '--radius-md': '18px', '--radius-lg': '26px' },
};

// Every custom property the interpreter can ever write. My Community resets
// exactly these when a skin is cleared, and a test pins that nothing outside
// this list is produced.
export const SKIN_CSS_VARIABLES = [
  ...PALETTE_ROLES.flatMap((r) => r.vars),
  '--color-primary-light',
  '--color-primary-subtle',
  '--color-accent-light',
  '--color-accent-subtle',
  '--font-display',
  '--font-body',
  '--radius-sm',
  '--radius-md',
  '--radius-lg',
];

// ---------------------------------------------------------------------------
// Colour

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

// `#abc` / `#AABBCC` -> `#aabbcc`; anything else (names, rgb(), var(), url(),
// alpha, whitespace) -> null. Deliberately no alpha: a translucent role has no
// single contrast ratio, so it could not be validated.
export function normalizeColor(value) {
  if (typeof value !== 'string' || !HEX_RE.test(value)) return null;
  let hex = value.slice(1).toLowerCase();
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  return `#${hex}`;
}

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// WCAG 2.1 relative luminance.
export function luminance(hex) {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Opaque blend of `fg` over `bg` at `amount` (0..1). Used for the derived
// tint roles, which stay opaque so they remain measurable.
function mix(fg, bg, amount) {
  const f = rgb(fg);
  const b = rgb(bg);
  return `#${f.map((c, i) => Math.round(c * amount + b[i] * (1 - amount)).toString(16).padStart(2, '0')).join('')}`;
}

// ---------------------------------------------------------------------------
// Normalization (safety) — applies to drafts and publications alike

function issue(path, code, message) {
  return { path, code, message };
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

// Printable text only: no control characters and no markup delimiters, so a
// name renders as text wherever a consumer puts it.
const NAME_FORBIDDEN_RE = /[<>\u0000-\u001f\u007f]/;

function byteLength(text) {
  return new TextEncoder().encode(text).length;
}

// Normalizes an untrusted skin document. `complete` is false for drafts:
// missing roles and presets are allowed, but anything PRESENT must be safe.
// Returns { ok, skin, errors }; `skin` is only set when ok.
//
// Every path is reported, not just the first, so the editor can put each
// message beside its own control.
export function normalizeSkin(input, { complete = true } = {}) {
  const errors = [];
  if (!isPlainObject(input)) {
    return { ok: false, errors: [issue('', 'invalid_document', 'A skin must be an object.')] };
  }
  let serialized;
  try {
    serialized = JSON.stringify(input);
  } catch {
    return { ok: false, errors: [issue('', 'invalid_document', 'A skin must be plain JSON.')] };
  }
  if (byteLength(serialized) > MAX_SKIN_BYTES) {
    return { ok: false, errors: [issue('', 'too_large', `A skin must be at most ${MAX_SKIN_BYTES} bytes.`)] };
  }

  for (const key of Object.keys(input)) {
    if (!SKIN_KEYS.includes(key)) errors.push(issue(key, 'unknown_key', `"${key}" is not part of a skin.`));
  }

  const skin = { schemaVersion: input.schemaVersion };
  if (input.schemaVersion === undefined) {
    skin.schemaVersion = SKIN_SCHEMA_VERSION;
  } else if (!Number.isInteger(input.schemaVersion) || input.schemaVersion < 1) {
    errors.push(issue('schemaVersion', 'invalid_schema_version', 'Schema version must be a positive integer.'));
  } else if (input.schemaVersion !== SKIN_SCHEMA_VERSION) {
    errors.push(issue('schemaVersion', 'unsupported_schema_version', `Schema version ${input.schemaVersion} is not supported.`));
  }

  if (input.name !== undefined) {
    const name = typeof input.name === 'string' ? input.name.trim() : null;
    if (name === null) {
      errors.push(issue('name', 'invalid_name', 'Name must be text.'));
    } else if (NAME_FORBIDDEN_RE.test(name)) {
      errors.push(issue('name', 'invalid_name', 'Name cannot contain markup or control characters.'));
    } else if ([...name].length > MAX_SKIN_NAME_LENGTH) {
      errors.push(issue('name', 'invalid_name', `Name must be at most ${MAX_SKIN_NAME_LENGTH} characters.`));
    } else if (name) {
      skin.name = name;
    }
  }
  if (complete && !skin.name) errors.push(issue('name', 'required', 'Give the skin a name.'));

  for (const mode of MODES) {
    const palette = input[mode];
    if (palette === undefined) {
      if (complete) errors.push(issue(mode, 'required', `The ${mode} palette is required.`));
      continue;
    }
    if (!isPlainObject(palette)) {
      errors.push(issue(mode, 'invalid_palette', `The ${mode} palette must be an object.`));
      continue;
    }
    const out = {};
    for (const key of Object.keys(palette)) {
      if (!PALETTE_ROLE_KEYS.includes(key)) {
        errors.push(issue(`${mode}.${key}`, 'unknown_key', `"${key}" is not a palette role.`));
      }
    }
    for (const role of PALETTE_ROLE_KEYS) {
      const raw = palette[role];
      if (raw === undefined || raw === null || raw === '') {
        if (complete) errors.push(issue(`${mode}.${role}`, 'required', 'Choose a colour.'));
        continue;
      }
      const color = normalizeColor(raw);
      if (!color) {
        errors.push(issue(`${mode}.${role}`, 'invalid_color', 'Use a hex colour such as #2d6a4f.'));
        continue;
      }
      out[role] = color;
    }
    skin[mode] = out;
  }

  for (const [key, allowed] of [['typography', TYPOGRAPHY_PRESETS], ['shape', SHAPE_PRESETS]]) {
    const value = input[key];
    if (value === undefined || value === null || value === '') {
      if (complete) errors.push(issue(key, 'required', `Choose a ${key} preset.`));
      continue;
    }
    if (!allowed.includes(value)) {
      errors.push(issue(key, 'invalid_preset', `${key} must be one of ${allowed.join(', ')}.`));
      continue;
    }
    skin[key] = value;
  }

  return errors.length ? { ok: false, errors } : { ok: true, skin, errors: [] };
}

// ---------------------------------------------------------------------------
// Publication gate (accessibility)

const TEXT_AA = 4.5;
const NON_TEXT_AA = 3;
// Hover must be perceivable, not merely different in the file. 1.1:1 is a
// low bar that still rejects a copy-pasted resting colour or a one-step nudge.
const STATE_DISTINCT = 1.1;

// Each pair is how My Community actually uses the roles together; the path
// names the FOREGROUND role, which is the control the organizer would adjust.
// Keep in step with the extension's stylesheets.
const TEXT_PAIRS = [
  ['text', 'page'], ['text', 'surface'], ['text', 'surfaceHover'],
  ['textSecondary', 'page'], ['textSecondary', 'surface'],
  ['textMuted', 'page'], ['textMuted', 'surface'],
  // Links rest in primary and hover in primary-hover.
  ['primary', 'page'], ['primary', 'surface'],
  ['primaryHover', 'page'], ['primaryHover', 'surface'],
  // Buttons: on-primary ink over the resting and hovered fill.
  ['onPrimary', 'primary'], ['onPrimary', 'primaryHover'],
  // Filled accent chips carry on-accent ink; accent TEXT uses accent-hover.
  ['onAccent', 'accent'],
  ['accentHover', 'page'], ['accentHover', 'surface'],
];

const LABELS = Object.fromEntries(PALETTE_ROLES.map((r) => [r.key, r.label.toLowerCase()]));

// Full publication check: completeness, safety, supported schema, WCAG 2.1 AA
// for every semantic pair in both modes, a visible focus ring (My Community's
// focus outline is 2px of `primary`, so primary must reach 3:1 against every
// surface a focusable control sits on), and perceivable hover states.
export function validateSkinForPublish(input) {
  const normalized = normalizeSkin(input, { complete: true });
  if (!normalized.ok) return normalized;
  const skin = normalized.skin;
  const errors = [];
  if (!SUPPORTED_SKIN_SCHEMA_VERSIONS.includes(skin.schemaVersion)) {
    errors.push(issue('schemaVersion', 'unsupported_schema_version', 'My Community cannot render this schema version.'));
  }
  for (const mode of MODES) {
    const p = skin[mode];
    for (const [fg, bg] of TEXT_PAIRS) {
      const ratio = contrastRatio(p[fg], p[bg]);
      if (ratio < TEXT_AA) {
        errors.push(issue(`${mode}.${fg}`, 'contrast',
          `${cap(LABELS[fg])} is too close to the ${LABELS[bg]} colour to read easily. Make one darker or the other lighter (contrast ${ratio.toFixed(2)}:1, needs ${TEXT_AA}:1).`));
      }
    }
    for (const bg of ['page', 'surface', 'surfaceHover']) {
      const ratio = contrastRatio(p.primary, p[bg]);
      if (ratio < NON_TEXT_AA) {
        errors.push(issue(`${mode}.primary`, 'focus',
          `Primary is too close to the ${LABELS[bg]} colour for the keyboard focus outline, which uses primary, to show. Make it darker or lighter (contrast ${ratio.toFixed(2)}:1, needs ${NON_TEXT_AA}:1).`));
      }
    }
    for (const [hover, rest] of [['primaryHover', 'primary'], ['surfaceHover', 'surface']]) {
      if (contrastRatio(p[hover], p[rest]) < STATE_DISTINCT) {
        errors.push(issue(`${mode}.${hover}`, 'state',
          `${cap(LABELS[hover])} is too close to ${LABELS[rest]} for the hover to be seen.`));
      }
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, skin, errors: [] };
}

function cap(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---------------------------------------------------------------------------
// Interpreter

// Fills anything a (draft) skin leaves out from the My Community default, so
// an incomplete draft still previews. Assumes `skin` came through
// normalizeSkin; unknown values are dropped rather than trusted.
export function resolveSkin(skin) {
  const out = {
    schemaVersion: SKIN_SCHEMA_VERSION,
    name: skin?.name || DEFAULT_SKIN.name,
    typography: TYPOGRAPHY_PRESETS.includes(skin?.typography) ? skin.typography : DEFAULT_SKIN.typography,
    shape: SHAPE_PRESETS.includes(skin?.shape) ? skin.shape : DEFAULT_SKIN.shape,
  };
  for (const mode of MODES) {
    out[mode] = {};
    for (const role of PALETTE_ROLE_KEYS) {
      out[mode][role] = normalizeColor(skin?.[mode]?.[role]) || DEFAULT_SKIN[mode][role];
    }
  }
  return out;
}

// The custom properties a skin sets for one mode. The ONLY place a skin turns
// into styling: My Community sets these on its root, the panel preview sets
// them on the preview frame.
export function skinCssVariables(skin, mode = 'light') {
  const resolved = resolveSkin(skin);
  const p = resolved[mode === 'dark' ? 'dark' : 'light'];
  const vars = {};
  for (const role of PALETTE_ROLES) {
    for (const name of role.vars) vars[name] = p[role.key];
  }
  const dark = mode === 'dark';
  vars['--color-primary-light'] = mix(p.primary, p.surface, dark ? 0.14 : 0.1);
  vars['--color-primary-subtle'] = mix(p.primary, p.surface, dark ? 0.06 : 0.08);
  vars['--color-accent-light'] = mix(p.accent, p.surface, dark ? 0.14 : 0.16);
  vars['--color-accent-subtle'] = mix(p.accent, p.surface, dark ? 0.06 : 0.08);
  Object.assign(vars, TYPOGRAPHY[resolved.typography], SHAPE[resolved.shape]);
  return vars;
}

// Groups publication errors by path, for "show the failure beside the role".
export function errorsByPath(errors) {
  const map = {};
  for (const e of errors || []) (map[e.path] ||= []).push(e.message);
  return map;
}

// True when two normalized skins would render identically. Used to refuse a
// publication that would only duplicate the current revision.
export function sameSkin(a, b) {
  return canonicalJson(a) === canonicalJson(b);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
