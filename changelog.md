# Changelog

## 1.4.1

### Bullets (disclosure carets off)

- With **Disclosure carets** disabled and **Bullets** still enabled, parent rows no longer switch to hollow ring bullets while leaves stay filled (that mismatch looked like a bug).
- Parents now keep the **same filled dot** as leaves and are indicated **subtly** with lower rest opacity; **hover** still brings them up to the same strength as other bullets.

### Manifest

- `plugin.json`: version **1.4.1**.

## 1.4.0

### Architecture (unchanged from the integration plan)

- Indent coloring still uses the static stylesheet plus per-line `--ir-color` via `colorIndentLine`.
- Focus and active line detection still use Thymer’s `listitem-with-caret` marker (no virtual-input / `elementFromPoint` tracking).
- The status bar entry still opens the full settings panel (no “cycle theme on click” behavior).

### Ported behavior (from thymer-rk-outliner)

- **Bullets and outline chrome:** injected `.bt-bullet`, `bt-has-children`, disclosure carets, and flat-list collapse (`bt-collapsed` with a `display` walk).
- **Zoom:** zoom into a line as the outline root (`zoomToItem`, panel navigation / `rootId`, `syncLineZoomContext`).
- **Empty zoom:** helpers to land on a nested line after zoom (`indentEmptyZoomViaApi`, `maybeIndentEmptyZoomedLine`, `applyZoomStartLineStyle`, `zoomStartLineGuids`).
- **Reparent while zoomed:** on `lineitem.created`, new lines outside the zoom subtree can be moved under the zoom root via `PluginLineItem.move`.
- **Navigation:** `panel.navigated` keeps zoom context in sync and handles the single empty root line case.
- **Input:** capture-phase document click — bullet opens zoom; narrow left gutter on the row toggles collapse.
- **DOM updates:** a filtered `MutationObserver` refreshes outline structure without reacting to virtual-input style churn.

### CSS

- Bullet, caret, and zoom-start rules are part of `STATIC_CSS`, gated by `body.ir-enabled` and by `bt-bullets` / `bt-toggles` on `body` from `applyEnabledState()`.

### Settings and storage

- New persisted keys: `indent-rainbow-threading-enabled`, `indent-rainbow-bullets-enabled`, `indent-rainbow-toggles-enabled`.
- `updateSettings` / `saveSettings` write them; `getSettings` exposes them to the settings panel.
- Settings UI adds: master **Enable plugin**, **Active thread highlights**, and an **Outline & zoom** section (bullets + disclosure carets).
- Live preview draws active-thread arms only when threading is enabled.
- `updateFocusedItem` skips drawing active-thread highlights when threading is turned off.

### Safety and integration

- `annotateHasChildren`, `applyCollapseState`, and `outlineClickHandler` honor `isEnabled`; turning the plugin off clears outline affordances and collapse side effects.
- Command-palette actions use a shared refresh path so colors, outline pass, focus highlights, and zoom context stay consistent.
- `onUnload` removes injected bullets, strips `bt-*` classes, restores rows hidden only for collapse, clears zoom state, and removes `bt-bullets` / `bt-toggles` from `body`.

### Manifest

- `plugin.json`: version **1.4.0**, `show_cmdpal_items`: **true**.

### Command palette

- New commands (in addition to **Settings**): toggle plugin on/off, toggle active threading, toggle staircase vs stretched threading, toggle bullets, toggle disclosure carets.
