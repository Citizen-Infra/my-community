---
target: "Skin chooser PR #131"
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\temaz\\claude-project\\my-community\\.worktrees\\pr131\\extension\\src\\components\\SkinChooser.jsx"
target_fingerprint: "sha256:4df8176262585e0ec278166105a21f6b2489dd5bf8fb41ac707e1844fc115984"
target_path: "C:\\Users\\temaz\\claude-project\\my-community\\.worktrees\\pr131\\extension\\src\\components\\SkinChooser.jsx"
timestamp: 2026-09-25T14-18-34Z
slug: extension-src-components-skinchooser-jsx
---
# Critique: Appearance → Skin chooser (my-community PR #131)

Method: dual-agent (A: design review, Sonnet · B: detector, Haiku)

## Design Health Score — 29/40 (Good)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Applying a skin has no confirmation beyond a repaint and "In use" |
| 2 | Match system / real world | 3 | "can't be shown safely by this version" is vague |
| 3 | User control and freedom | 4 | Preview never touches the saved choice; Cancel and Restore always present |
| 4 | Consistency and standards | 1 | Coloured side stripe, one-off title size, extension vs web grouping differ |
| 5 | Error prevention | 4 | Every revision, cached or fresh, re-validated before it reaches the page |
| 6 | Recognition over recall | 3 | "Revision N" with no date or what-changed |
| 7 | Flexibility and efficiency | 3 | No search or grouping for many communities |
| 8 | Aesthetic and minimalist | 2 | Preview nests three boxed containers |
| 9 | Error recovery | 4 | Every fallback named, explained, with a next step |
| 10 | Help and documentation | 2 | One hint paragraph is the only explanation of skins |

## Specificity

Authored for this product: preview-first flow, closed interpreter, named fallback per failure mode, on-voice copy. Weakest in fit to its host shells. Detector: 0 findings (SkinChooser.jsx, SettingsModal.jsx, WebSettings.jsx). No overlay (needs signed-in extension + CA backend). Rendered: web companion empty state only, 1280 and 390.

## Priority issues

- [P1] `.skin-notice { border-left: 3px solid var(--color-accent) }` (skin-chooser.css:33) breaks DESIGN.md's Community-Color Rule; the only coloured side stripe in the app outside the community bar. Fix: drop the stripe, keep the tint.
- [P1] No focus management after Use / Restore / Cancel (SkinChooser.jsx:68-75, 101, 270): the pressed button unmounts, focus falls to body. Fix: refocus the originating row or the Skin heading.
- [P2] Extension nests Skin inside Appearance (SettingsModal.jsx:462-477); web puts it in its own section after an unrelated Install button (WebSettings.jsx:194-202). Fix: same grouping on both.
- [P2] `.skin-chooser-title` 13px/650 (skin-chooser.css:17-21) matches no DESIGN.md type role. Fix: reuse `.settings-section-title` or a documented sub-heading.
- [P3] Preview panel nests three boxed containers against "No nested cards". Fix: flatten one layer or document the exception.

## Persona red flags

- Alex: no what-changed per revision; no filter for many communities.
- Sam: focus lost on all three actions; "In use" has no current-state ARIA.
- Non-technical member: "revision" undefined, used four times; silent full repaint on apply.

## Minor

- `--provenance` vs the app's `--community-border` naming.
- Vendored community-skin.js is CRLF on a Windows checkout, so the sha256 test fails locally (1 failed); CI on Linux passes. Fix: `.gitattributes` `extension/src/lib/community-skin.js -text`.
- "security concern" withdrawal copy gives no next step.
