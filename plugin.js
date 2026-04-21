/**
 * Thymer Indent Rainbow Plugin
 * 
 * Adds rainbow-colored vertical indent guides to Thymer's editor.
 * Each indentation level gets a unique color, similar to how IDEs color
 * matching brackets or indent guides at different nesting levels.
 * 
 * Features:
 * - Rainbow-colored vertical indent lines
 * - Enhanced visibility on hover
 * - Smooth color transitions
 * - Command palette toggle for different color schemes
 * - Workflowy-style bullets, disclosure carets, zoom, and reparent-on-create when zoomed
 */

class Plugin extends AppPlugin {
    onLoad() {
        this.isUnloaded = false;

        // Keep track of resources to clean up later
        this.cleanupMethods = [];
        this.styleElement = null;

        /** Line-item GUIDs where we skip injecting `.bt-bullet` (empty zoom / first-edit line). */
        this.zoomStartLineGuids = new Set();

        /**
         * When `panel.getNavigation().rootId` is a line (not the record root), new lines
         * may be reparented under that line — see `lineitem.created` handler.
         */
        this.lineZoomRootGuid = null;
        this._zoomReparentBusy = false;

        // Storage keys for persisting settings
        const STORAGE_KEY = 'indent-rainbow-scheme';
        const WIDTH_KEY = 'indent-rainbow-width';
        const ACTIVE_WIDTH_KEY = 'indent-rainbow-active-width';
        const OPACITY_KEY = 'indent-rainbow-opacity';
        const ENABLED_KEY = 'indent-rainbow-enabled';
        const THREADING_ENABLED_KEY = 'indent-rainbow-threading-enabled';
        const THREADING_MODE_KEY = 'indent-rainbow-threading-mode';
        const BULLETS_ENABLED_KEY = 'indent-rainbow-bullets-enabled';
        const TOGGLES_ENABLED_KEY = 'indent-rainbow-toggles-enabled';

        // Color schemes for different tastes
        const colorSchemes = {
            rainbow: {
                name: 'Rainbow',
                colors: [
                    '#ff5f5f',  // Red
                    '#ffbd2e',  // Orange
                    '#feca57',  // Yellow
                    '#28c940',  // Green
                    '#00d0ff',  // Blue
                    '#5856d6',  // Indigo
                    '#ff2d55',  // Pink
                    '#af52de',  // Purple
                ]
            },
            ocean: {
                name: 'Ocean',
                colors: [
                    '#0077b6',  // Deep blue
                    '#00b4d8',  // Bright cyan
                    '#48cae4',  // Light cyan
                    '#90e0ef',  // Pale cyan
                    '#ade8f4',  // Ice blue
                    '#caf0f8',  // Lightest cyan
                    '#023e8a',  // Navy
                    '#0096c7',  // Medium blue
                ]
            },
            sunset: {
                name: 'Sunset',
                colors: [
                    '#ff6b6b',  // Coral red
                    '#ff8e53',  // Warm orange
                    '#feca57',  // Golden yellow
                    '#ff9ff3',  // Pink
                    '#f368e0',  // Magenta
                    '#ff6b81',  // Rose
                    '#ee5a24',  // Burnt orange
                    '#ff4757',  // Bright red
                ]
            },
            forest: {
                name: 'Forest',
                colors: [
                    '#2d6a4f',  // Deep forest
                    '#40916c',  // Forest green
                    '#52b788',  // Fresh green
                    '#74c69d',  // Light green
                    '#95d5b2',  // Pale green
                    '#b7e4c7',  // Mint
                    '#1b4332',  // Dark forest
                    '#d8f3dc',  // Lightest green
                ]
            },
            neon: {
                name: 'Neon',
                colors: [
                    '#ff00ff',  // Magenta
                    '#00ffff',  // Cyan
                    '#ff00aa',  // Hot pink
                    '#00ff88',  // Neon green
                    '#ffff00',  // Yellow
                    '#ff6600',  // Orange
                    '#aa00ff',  // Purple
                    '#00aaff',  // Electric blue
                ]
            },
            monochrome: {
                name: 'Monochrome',
                colors: [
                    '#6b7280',  // Gray 500
                    '#9ca3af',  // Gray 400
                    '#d1d5db',  // Gray 300
                    '#4b5563',  // Gray 600
                    '#374151',  // Gray 700
                    '#e5e7eb',  // Gray 200
                    '#1f2937',  // Gray 800
                    '#f3f4f6',  // Gray 100
                ]
            },
            Soot: {
                name: 'Soot',
                colors: [
                    '#8c5a36',  // Toasted Oak
                    '#5a6b6a',  // Sage/Lichen
                    '#a65d5d',  // Dried Rose
                    '#7a7369',  // Wet Bark
                    '#8c7d6b',  // Driftwood
                    '#6b7280',  // Slate Ash
                    '#b3924d',  // Old Gold
                    '#4a5c5c',  // Deep Spruce
                ]
            },
            Amber: {
                name: 'Amber',
                colors: [
                    '#ffdd00',  // Gold
                    '#ffbf00',  // Amber
                    '#df910b',  // Dark Amber
                    '#ca6c00',  // Light Amber
                    '#ff7f00',  // Medium Amber
                    '#b3924d',  // Old Gold
                ]
            }
        };

        // Get saved scheme or default to rainbow
        let currentScheme = localStorage.getItem(STORAGE_KEY) || 'rainbow';
        if (!colorSchemes[currentScheme]) {
            currentScheme = 'rainbow';
        }

        // Get saved settings or defaults
        let savedWidth = parseInt(localStorage.getItem(WIDTH_KEY));
        let currentWidth = isNaN(savedWidth) ? 1 : savedWidth;
        
        let savedActiveWidth = parseInt(localStorage.getItem(ACTIVE_WIDTH_KEY));
        let activeWidth = isNaN(savedActiveWidth) ? 2 : savedActiveWidth;
        
        let currentOpacity = parseFloat(localStorage.getItem(OPACITY_KEY)) || 0.3;
        let isEnabled = localStorage.getItem(ENABLED_KEY) !== 'false'; // default true
        let isThreadingEnabled = localStorage.getItem(THREADING_ENABLED_KEY) !== 'false'; // default true
        let threadingMode = localStorage.getItem(THREADING_MODE_KEY) || 'staircase'; // 'staircase' or 'stretched'
        let isBulletsEnabled = localStorage.getItem(BULLETS_ENABLED_KEY) !== 'false'; // default true
        let isTogglesEnabled = localStorage.getItem(TOGGLES_ENABLED_KEY) !== 'false'; // default true

        // Opacity presets
        const opacityPresets = {
            subtle: { name: 'Subtle', value: 0.2 },
            normal: { name: 'Normal', value: 0.3 },
            bold: { name: 'Bold', value: 0.45 }
        };

        // Static stylesheet — injected once for the plugin's lifetime.
        // Colors are applied via JS-written CSS custom properties (--ir-level-N, --ir-color)
        // so scheme / opacity / width changes never regenerate the sheet.
        const STATIC_CSS = `
/* Thymer Indent Rainbow */

/* Settings vars — updated by JS, never by regenerating the sheet */
:root {
    --bt-line-width: 1px;
    --bt-line-opacity: 0.3;
    --bt-line-opacity-hover: 0.8;
    --bt-transition-duration: 0.15s;
}

/* CRITICAL: Provide fallback values for Thymer's inline calc() expressions. */
.listitem-indentline {
    --line-height: 26px;
    --checkbox-size: 23.5px;
    --bullet-size: 10px;
}

/* Color applied via JS per-line as --ir-color */
body.ir-enabled .listitem-indentline {
    background-color: var(--ir-color, transparent) !important;
    border-color: var(--ir-color, transparent) !important;
}

/* Base styling for indent lines */
body.ir-enabled .listitem-indentline {
    transition: opacity var(--bt-transition-duration) ease,
                filter var(--bt-transition-duration) ease,
                background-color var(--bt-transition-duration) ease,
                border-color var(--bt-transition-duration) ease !important;
    opacity: var(--bt-line-opacity) !important;
    min-width: var(--bt-line-width) !important;
    width: var(--bt-line-width) !important;
    transform-origin: top;
}

/* Minimum height safety net */
body.ir-enabled .listitem-task .listitem-indentline,
body.ir-enabled .listitem-ulist .listitem-indentline,
body.ir-enabled .listitem-olist .listitem-indentline {
    min-height: 20px !important;
}

/* Global horizontal nudge (~1pt) so guides sit centered under bullets/numbers/
   checkboxes. Applied uniformly across all item types (including headings,
   which lack the listitem-text/task/ulist/olist classes) so per-level
   spacing stays uniform. Tweak --ir-align-nudge to fine-tune. */
:root {
    --ir-align-nudge: 1.5px;
}

/* Base: nudge applies to every indent line (catches headings + text + task). */
body.ir-enabled .listitem-indentline {
    transform: translateX(var(--ir-align-nudge)) !important;
}

/* Align bullet indent line with text/heading guides, then apply the global
   nudge. Bullet items sit 6.75px left of text items of the same level. */
body.ir-enabled .listitem-ulist .listitem-indentline {
    transform: translateX(calc(6.75px + var(--ir-align-nudge))) !important;
}

/* Align numbered-list indent line with text/heading guides, then apply the
   global nudge. Numbered items sit 2.63px right of text items of same level. */
body.ir-enabled .listitem-olist .listitem-indentline {
    transform: translateX(calc(-2.63px + var(--ir-align-nudge))) !important;
}

/* Ensure indent lines are visible for all item types */
body.ir-enabled .listitem-text .listitem-indentline,
body.ir-enabled .listitem-task .listitem-indentline,
body.ir-enabled .listitem-ulist .listitem-indentline,
body.ir-enabled .listitem-olist .listitem-indentline {
    display: block !important;
    visibility: visible !important;
}

/* Highlight on hover */
body.ir-enabled .listitem:hover > .line-div > .listitem-indentline,
body.ir-enabled .listitem:hover > .line-check-div ~ .line-div > .listitem-indentline,
body.ir-enabled .listitem:hover > .line-bullet-div ~ .line-div > .listitem-indentline,
body.ir-enabled .listitem:hover > .line-number-div ~ .line-div > .listitem-indentline {
    opacity: var(--bt-line-opacity-hover) !important;
    filter: brightness(1.2) !important;
}

/* Enhanced hover for threading path */
body.ir-enabled .listitem:hover .line-div .listitem-indentline {
    filter: brightness(1.1);
}

/* Highlight on focus (cursor position) */
body.ir-enabled .bt-focused > .line-div > .listitem-indentline,
body.ir-enabled .bt-focused > .line-check-div ~ .line-div > .listitem-indentline,
body.ir-enabled .bt-focused > .line-bullet-div ~ .line-div > .listitem-indentline,
body.ir-enabled .bt-focused > .line-number-div ~ .line-div > .listitem-indentline {
    opacity: 1 !important;
    filter: brightness(1.3) drop-shadow(0 0 2px currentColor) !important;
}

/* Dark mode adjustments */
@media (prefers-color-scheme: dark) {
    body.ir-enabled .listitem-indentline {
        filter: brightness(1.1);
    }
}

body.ir-enabled.dark .listitem-indentline,
body.ir-enabled [data-theme="dark"] .listitem-indentline {
    filter: brightness(1.1);
}

/* =====================================================
   Workflowy-style bullets and disclosure carets
   (gated by body.bt-bullets / body.bt-toggles)
   ===================================================== */
body.ir-enabled .bt-bullet {
    display: none;
}

body.ir-enabled.bt-bullets .bt-bullet {
    display: inline-block;
    box-sizing: border-box;
    width: 8px;
    height: 8px;
    margin-right: 8px;
    vertical-align: middle;
    border-radius: 50%;
    border: 1px solid rgba(128, 128, 128, 0.55);
    background: currentColor;
    background-clip: padding-box;
    opacity: 0.45;
    flex-shrink: 0;
    cursor: pointer;
    user-select: none;
    transition: opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease,
        border-color 0.15s ease;
}

body.ir-enabled.bt-bullets .bt-bullet:hover {
    opacity: 0.95;
    border-color: rgba(128, 128, 128, 0.85);
    transform: scale(1.35);
    box-shadow: 0 0 0 3px rgba(128, 128, 128, 0.18);
}

body.ir-enabled.bt-bullets .bt-bullet:active {
    transform: scale(1.1);
}

@media (prefers-color-scheme: dark) {
    body.ir-enabled.bt-bullets .bt-bullet {
        border-color: rgba(180, 180, 180, 0.45);
    }
    body.ir-enabled.bt-bullets .bt-bullet:hover {
        border-color: rgba(200, 200, 200, 0.75);
    }
}

body.ir-enabled.dark .bt-bullets .bt-bullet,
body.ir-enabled [data-theme="dark"] .bt-bullets .bt-bullet {
    border-color: rgba(180, 180, 180, 0.45);
}

body.ir-enabled.dark .bt-bullets .bt-bullet:hover,
body.ir-enabled [data-theme="dark"] .bt-bullets .bt-bullet:hover {
    border-color: rgba(200, 200, 200, 0.75);
}

/* When carets are off, parents stay filled but read slightly softer than leaves. */
body.ir-enabled.bt-bullets:not(.bt-toggles) .listitem.bt-has-children > .line-div > .bt-bullet {
    opacity: 0.3;
}

body.ir-enabled.bt-bullets:not(.bt-toggles) .listitem.bt-has-children > .line-div > .bt-bullet:hover {
    opacity: 0.95;
}

body.ir-enabled.bt-toggles .listitem.bt-has-children > .line-div::before {
    content: "▾";
    display: inline-block;
    width: 18px;
    height: auto;
    margin-right: 6px;
    vertical-align: middle;
    opacity: 0.6;
    font-size: 14px;
    line-height: 1;
    text-align: center;
    color: currentColor;
    cursor: pointer;
    transition: transform 0.12s ease, opacity 0.12s ease;
    transform-origin: center;
}

body.ir-enabled.bt-toggles .listitem.bt-has-children > .line-div:hover::before {
    opacity: 1;
}

body.ir-enabled.bt-toggles .listitem.bt-has-children.bt-collapsed > .line-div::before {
    content: "▸";
}

body.ir-enabled.bt-toggles .listitem.bt-collapsed > .listitem,
body.ir-enabled.bt-toggles .listitem.bt-collapsed .listitem {
    display: none !important;
}

body.ir-enabled .listitem.bt-zoom-start-line > .line-div {
    padding-left: 22px;
    box-sizing: border-box;
}
body.ir-enabled.bt-toggles .listitem.bt-zoom-start-line > .line-div::before {
    display: none !important;
    content: none !important;
    width: 0 !important;
    margin: 0 !important;
    margin-right: 0 !important;
}
body.ir-enabled.bt-bullets .listitem.bt-zoom-start-line > .line-div > .bt-bullet {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
    margin: 0 !important;
    border: none !important;
    padding: 0 !important;
}
`;

        // Write the palette for the current scheme as --ir-level-N root vars.
        const applySchemeVars = (schemeName) => {
            const colors = colorSchemes[schemeName].colors;
            const root = document.documentElement.style;
            colors.forEach((color, i) => root.setProperty(`--ir-level-${i}`, color));
            root.setProperty('--ir-level-count', colors.length);
        };

        // Update CSS vars for width / opacity without touching the stylesheet.
        const applySettingVars = () => {
            const root = document.documentElement.style;
            root.setProperty('--bt-line-width', `${currentWidth}px`);
            root.setProperty('--bt-line-opacity', currentOpacity);
            root.setProperty('--bt-line-opacity-hover', Math.min(currentOpacity + 0.5, 0.9));
        };

        // Persist settings to localStorage (only called on user change).
        const saveSettings = () => {
            localStorage.setItem(STORAGE_KEY, currentScheme);
            localStorage.setItem(WIDTH_KEY, currentWidth);
            localStorage.setItem(ACTIVE_WIDTH_KEY, activeWidth);
            localStorage.setItem(OPACITY_KEY, currentOpacity);
            localStorage.setItem(ENABLED_KEY, isEnabled);
            localStorage.setItem(THREADING_ENABLED_KEY, isThreadingEnabled);
            localStorage.setItem(THREADING_MODE_KEY, threadingMode);
            localStorage.setItem(BULLETS_ENABLED_KEY, isBulletsEnabled);
            localStorage.setItem(TOGGLES_ENABLED_KEY, isTogglesEnabled);
        };

        // Toggle the ir-enabled body class which gates all our CSS rules.
        const applyEnabledState = () => {
            document.body.classList.toggle('ir-enabled', isEnabled);
            document.body.classList.toggle('bt-bullets', isEnabled && isBulletsEnabled);
            document.body.classList.toggle('bt-toggles', isEnabled && isTogglesEnabled);
        };

        // Inject the static stylesheet once.
        this.styleElement = this.ui.injectCSS(STATIC_CSS);
        applySchemeVars(currentScheme);
        applySettingVars();
        applyEnabledState();

        // =====================================================
        // Focus Tracking via .listitem-with-caret
        // =====================================================
        // Thymer marks the listitem containing the caret with the class
        // `listitem-with-caret`. We watch for that class toggle to resolve
        // the focused item — no transform parsing, no hit-tests, no key
        // or click listeners.

        let currentFocusedItem = null;
        let rafPending = false;
        let activeHighlights = []; // Cache highlight elements for faster cleanup

        const cleanHighlights = () => {
            while (activeHighlights.length > 0) {
                const h = activeHighlights.pop();
                if (h.parentElement) h.parentElement.removeChild(h);
            }
        };

        // Helper to find thread parents (moved out of updateFocusedItem to save memory)
        const getParents = (startNode) => {
            const parents = [];
            if (!startNode) return parents;

            // Try nested structure first (Logseq or alternative Thymer structure)
            let current = startNode.parentElement;
            let foundNestedParents = false;
            while (current) {
                const closestListitem = current.closest('.listitem');
                if (closestListitem) {
                    parents.push(closestListitem);
                    foundNestedParents = true;
                    current = closestListitem.parentElement;
                } else {
                    break;
                }
            }
            if (foundNestedParents) return parents;

            // Try flat structure fallback using TreeWalker ( Thymer uses margin-left on lines )
            const getIndentLevel = (el) => {
                for (let i = 0; i < el.children.length; i++) {
                    const child = el.children[i];
                    if (child.style && child.style.marginLeft) return parseInt(child.style.marginLeft) || 0;
                }
                if (el.style && el.style.marginLeft) return parseInt(el.style.marginLeft) || 0;
                return 0;
            };

            let currentIndent = getIndentLevel(startNode);
            if (currentIndent <= 0) return parents;

            try {
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
                    acceptNode: (el) => (el.classList && el.classList.contains('listitem')) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
                });
                walker.currentNode = startNode;
                let prev = walker.previousNode();
                while (prev && currentIndent > 0) {
                    const prevIndent = getIndentLevel(prev);
                    if (prevIndent < currentIndent) {
                        parents.push(prev);
                        currentIndent = prevIndent;
                    }
                    prev = walker.previousNode();
                }
            } catch (e) {
                // Ignore errors
            }
            return parents;
        };

        // =====================================================
        // Focus tracking — resolves focused listitem from class marker
        // =====================================================

        const updateFocusedItem = (node) => {
            if (this.isUnloaded) return;
            rafPending = false;

            if (!node) {
                node = document.querySelector('.listitem-with-caret');
            }

            // --- READ PHASE --- (Avoid layout thrashing)
            const highlightData = [];

            if (isThreadingEnabled && node && document.body.contains(node) && node.offsetParent !== null) {
                const parents = getParents(node);

                if (parents.length > 0) {
                    const targetLineDiv = node.querySelector('.line-div') || node;
                    const targetRect = targetLineDiv.getBoundingClientRect();

                    // Resolve effective single-line height to anchor arm to first wrap line.
                    let lineHeight = 0;
                    if (targetLineDiv && targetLineDiv.nodeType === 1) {
                        const lh = parseFloat(getComputedStyle(targetLineDiv).lineHeight);
                        if (!isNaN(lh) && lh > 0) lineHeight = lh;
                    }
                    if (!lineHeight) {
                        const rootLh = parseFloat(
                            getComputedStyle(document.documentElement).getPropertyValue('--line-height')
                        );
                        lineHeight = !isNaN(rootLh) && rootLh > 0 ? rootLh : 26;
                    }

                    if (targetRect.height > 0) {
                        for (let index = 0; index < parents.length; index++) {
                            const p = parents[index];
                            const targetPointNode = threadingMode === 'staircase'
                                ? (index === 0 ? node : parents[index - 1])
                                : node;

                            const tLineDiv = targetPointNode.querySelector('.line-div') || targetPointNode;
                            const tRect = tLineDiv.getBoundingClientRect();
                            if (tRect.height === 0) continue;

                            // Anchor to the first visual line so wrapped items
                            // still point at their prefix (bullet/check/number).
                            const firstLineH = Math.min(tRect.height, lineHeight);
                            const tY = tRect.top + (firstLineH / 2);

                            const pIndent = p.querySelector('.listitem-indentline');
                            const pLine = pIndent ? pIndent.parentElement : null;

                            if (pLine && pIndent && pIndent.parentElement) {
                                const pRect = pIndent.getBoundingClientRect();
                                const pContainerRect = pIndent.parentElement.getBoundingClientRect();

                                const h = tY - pRect.top;

                                let armEndX = tRect.left - 5;
                                for (let ci = 0; ci < targetPointNode.children.length; ci++) {
                                    const ch = targetPointNode.children[ci];
                                    if (ch.style && ch.style.marginLeft && parseInt(ch.style.marginLeft) > 0) {
                                        armEndX = ch.getBoundingClientRect().left;
                                        break;
                                    }
                                }
                                const w = Math.max(14, armEndX - pRect.left);

                                if (h > 0 && pRect.height > 0) {
                                    highlightData.push({
                                        parent: pIndent.parentElement,
                                        top: (pRect.top - pContainerRect.top),
                                        left: (pRect.left - pContainerRect.left),
                                        width: w,
                                        height: h,
                                        color: getComputedStyle(pIndent).backgroundColor
                                    });
                                }
                            }
                        }
                    }
                }
            }

            // --- WRITE PHASE ---
            if (node !== currentFocusedItem) {
                if (currentFocusedItem) currentFocusedItem.classList.remove('bt-focused');
                if (node) node.classList.add('bt-focused');
                currentFocusedItem = node;
            }

            for (let i = 0; i < highlightData.length; i++) {
                const data = highlightData[i];
                let highlight;
                if (i < activeHighlights.length) {
                    highlight = activeHighlights[i];
                    if (highlight.parentElement !== data.parent) {
                        highlight.parentElement?.removeChild(highlight);
                        data.parent.appendChild(highlight);
                    }
                } else {
                    highlight = document.createElement('div');
                    highlight.className = 'bt-active-highlight';
                    data.parent.appendChild(highlight);
                    activeHighlights.push(highlight);
                }
                highlight.style.position = 'absolute';
                highlight.style.top = `${data.top}px`;
                highlight.style.left = `${data.left}px`;
                highlight.style.width = `${data.width}px`;
                highlight.style.height = `${data.height}px`;
                highlight.style.borderLeft = `${activeWidth}px solid ${data.color}`;
                highlight.style.borderBottom = `${activeWidth}px solid ${data.color}`;
                highlight.style.borderBottomLeftRadius = '6px';
                highlight.style.boxSizing = 'border-box';
                highlight.style.backgroundColor = 'transparent';
                highlight.style.zIndex = '10';
                highlight.style.pointerEvents = 'none';
                highlight.style.opacity = '1';
                highlight.style.filter = `brightness(1.5) drop-shadow(0 0 3px ${data.color})`;
            }

            while (activeHighlights.length > highlightData.length) {
                const h = activeHighlights.pop();
                if (h.parentElement) h.parentElement.removeChild(h);
            }
        };

        const scheduleUpdate = (node) => {
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(() => updateFocusedItem(node));
        };

        // Watch for the .listitem-with-caret class toggle anywhere in the DOM.
        const setupCaretClassObserver = () => {
            if (this.isUnloaded) return;

            const observer = new MutationObserver((mutations) => {
                for (const m of mutations) {
                    if (m.type !== 'attributes' || m.attributeName !== 'class') continue;
                    const el = m.target;
                    if (!(el instanceof Element)) continue;
                    if (!el.classList.contains('listitem')) continue;
                    if (el.classList.contains('listitem-with-caret')) {
                        scheduleUpdate(el);
                        return;
                    }
                    // Class removed from the previously focused item —
                    // trigger a re-resolve; may find another item or null.
                    if (el === currentFocusedItem) {
                        scheduleUpdate(null);
                        return;
                    }
                }
            });

            observer.observe(document.body, {
                subtree: true,
                attributes: true,
                attributeFilter: ['class'],
            });
            this.cleanupMethods.push(() => observer.disconnect());

            // Initial resolve.
            scheduleUpdate(null);
        };

        setupCaretClassObserver();

        // =====================================================
        // Workflowy-style Outline Enhancements
        //   (1) Bullets on text items (CSS-driven)
        //   (2) Disclosure carets + collapse/expand
        // =====================================================

        const EDITOR_SELECTORS = '.editor-wrapper, .page-content, #editor';
        let outlineRafPending = false;

        // Extract left margin used by Thymer to encode indentation.
        const getItemIndent = (li) => {
            if (!li) return 0;
            const lineDiv = li.querySelector(':scope > .line-div, :scope > .line-check-div')
                || li.querySelector('.line-div, .line-check-div');
            if (lineDiv && lineDiv.style && lineDiv.style.marginLeft) {
                return parseInt(lineDiv.style.marginLeft) || 0;
            }
            if (li.style && li.style.marginLeft) {
                return parseInt(li.style.marginLeft) || 0;
            }
            return 0;
        };

        // Annotate every .listitem with `.bt-has-children` so CSS can show a
        // disclosure caret on parents, and inject a clickable `.bt-bullet`
        // span into every non-task .line-div so EVERY bullet (parent or leaf)
        // is a real click target that can zoom. Supports both flat DOM
        // (margin-left based) and nested DOM (listitem > listitem).
        //
        // Returns the fresh .listitem array so applyCollapseState can reuse
        // it in the same RAF tick instead of re-querying.
        const annotateHasChildren = () => {
            const items = Array.from(document.querySelectorAll('.listitem'));
            if (items.length === 0) return items;
            if (!isEnabled) {
                for (const li of items) {
                    li.classList.remove('bt-has-children', 'bt-collapsed', 'bt-zoom-start-line');
                    li.querySelectorAll('.bt-bullet').forEach(b => b.remove());
                    if (li.style.display === 'none') li.style.display = '';
                }
                return items;
            }
            if (!isBulletsEnabled && !isTogglesEnabled) {
                for (const li of items) {
                    li.classList.remove('bt-has-children');
                    li.querySelectorAll('.bt-bullet').forEach(b => b.remove());
                }
                return items;
            }

            const nestedDetected = items.some(li =>
                li.querySelector(':scope > .listitem, :scope > * > .listitem')
            );

            for (let i = 0; i < items.length; i++) {
                const li = items[i];
                let hasChildren;

                if (nestedDetected) {
                    hasChildren = !!li.querySelector(
                        ':scope > .listitem, :scope > * > .listitem'
                    );
                } else {
                    const here = getItemIndent(li);
                    const next = i + 1 < items.length ? getItemIndent(items[i + 1]) : here;
                    hasChildren = next > here;
                }

                if (li.classList.contains('bt-has-children') !== hasChildren) {
                    li.classList.toggle('bt-has-children', hasChildren);
                }

                // Task items keep their checkbox affordance — no bullet.
                if (li.classList.contains('listitem-task')) continue;

                const lineDiv = li.querySelector(':scope > .line-div')
                    || li.querySelector('.line-div');
                if (!lineDiv) continue;

                const rowGuid = li.getAttribute('data-guid');
                if (rowGuid && this.zoomStartLineGuids.has(rowGuid)) {
                    li.classList.add('bt-zoom-start-line');
                    const b = lineDiv.querySelector(':scope > .bt-bullet')
                        || lineDiv.querySelector('.bt-bullet');
                    if (b) b.remove();
                    continue;
                }

                const existing = lineDiv.querySelector(':scope > .bt-bullet')
                    || lineDiv.querySelector('.bt-bullet');
                if (isBulletsEnabled) {
                    if (!existing) {
                        const bullet = document.createElement('span');
                        bullet.className = 'bt-bullet';
                        bullet.setAttribute('contenteditable', 'false');
                        bullet.setAttribute('aria-hidden', 'true');
                        lineDiv.insertBefore(bullet, lineDiv.firstChild);
                    }
                } else if (existing) {
                    existing.remove();
                }
            }
            return items;
        };

        // For flat DOM (what Thymer uses most of the time), hiding descendants
        // of a collapsed item can't be expressed in CSS alone -- we walk the
        // ordered item list and toggle display in one pass. Nested DOM is
        // handled by CSS already, so this is cheap either way. Reuses the
        // items array from annotateHasChildren when provided.
        const applyCollapseState = (items) => {
            if (!isEnabled || !isTogglesEnabled) return;

            const list = items || Array.from(document.querySelectorAll('.listitem'));
            let hideBelowIndent = null;

            for (const li of list) {
                const here = getItemIndent(li);

                if (hideBelowIndent !== null && here > hideBelowIndent) {
                    if (li.style.display !== 'none') li.style.display = 'none';
                    continue;
                }

                hideBelowIndent = null;
                if (li.style.display === 'none') {
                    li.style.display = '';
                }

                if (li.classList.contains('bt-collapsed')) {
                    hideBelowIndent = here;
                }
            }
        };

        // --- Bullet-click-to-zoom ----------------------------------------
        // Resolve a Thymer line-item GUID from a DOM .listitem. Tries common
        // data-* attributes first, then falls back to matching by document
        // order against a flattened PluginRecord.getLineItems() tree.
        const resolveLineItemGuid = async (li) => {
            if (!li) return null;

            const attrCandidates = [
                'data-guid', 'data-lineitem-guid', 'data-line-item-guid',
                'data-item-guid', 'data-id', 'id'
            ];
            for (const attr of attrCandidates) {
                const val = li.getAttribute(attr);
                if (val && val.length >= 12) return val;
            }

            try {
                const panel = this.ui.getActivePanel && this.ui.getActivePanel();
                const record = panel && panel.getActiveRecord
                    ? panel.getActiveRecord()
                    : null;
                if (!record || typeof record.getLineItems !== 'function') return null;

                const rootItems = await record.getLineItems();
                if (!rootItems || rootItems.length === 0) return null;

                const flatten = (items) => {
                    const out = [];
                    for (const item of items) {
                        out.push(item);
                        const kids = item.children;
                        if (kids && kids.length) out.push(...flatten(kids));
                    }
                    return out;
                };
                const flat = flatten(rootItems);

                const allDomItems = Array.from(document.querySelectorAll('.listitem'));
                const idx = allDomItems.indexOf(li);
                if (idx >= 0 && idx < flat.length && typeof flat[idx].getGuid === 'function') {
                    return flat[idx].getGuid();
                }
            } catch (err) {
                console.warn('[indent-rainbow] GUID resolution failed:', err);
            }
            return null;
        };

        const waitMs = (ms) => new Promise(r => setTimeout(r, ms));

        const lineItemGuid = (it) => (it && typeof it.getGuid === 'function'
            ? it.getGuid()
            : it.guid);

        const findLineItemByGuid = (items, g) => {
            if (!items || !g) return null;
            for (const it of items) {
                if (lineItemGuid(it) === g) return it;
                const ch = it.children;
                if (ch && ch.length) {
                    const found = findLineItemByGuid(ch, g);
                    if (found) return found;
                }
            }
            return null;
        };

        /** Like findLineItemByGuid but loads children via getChildren() when .children is null. */
        const findLineItemByGuidAsync = async (items, g) => {
            if (!items || !g) return null;
            const direct = findLineItemByGuid(items, g);
            if (direct) return direct;
            for (const it of items) {
                let ch = it.children;
                if (ch == null && typeof it.getChildren === 'function') {
                    try {
                        ch = await it.getChildren();
                    } catch {
                        ch = null;
                    }
                }
                if (ch && ch.length) {
                    const found = await findLineItemByGuidAsync(ch, g);
                    if (found) return found;
                }
            }
            return null;
        };

        const syncLineZoomContext = () => {
            const panel = this.ui.getActivePanel && this.ui.getActivePanel();
            if (!panel || typeof panel.getNavigation !== 'function') {
                this.lineZoomRootGuid = null;
                return;
            }
            const nav = panel.getNavigation() || {};
            const record = panel.getActiveRecord && panel.getActiveRecord();
            const rg = record && typeof record.getGuid === 'function' ? record.getGuid() : null;
            const rid = nav.rootId || null;
            if (!rid || !rg) {
                this.lineZoomRootGuid = null;
                return;
            }
            // Line zoom: rootId is the zoomed line item, not the record document root.
            this.lineZoomRootGuid = (rid !== rg) ? rid : null;
        };

        /**
         * True if `lineGuid` is the zoom line or any descendant under it (walk up from line).
         */
        const isLineUnderZoomSubtree = async (record, lineGuid, zoomGuid) => {
            if (!record || !lineGuid || !zoomGuid) return false;
            if (lineGuid === zoomGuid) return true;
            let roots;
            try { roots = await record.getLineItems(); }
            catch { return false; }
            let cur = await findLineItemByGuidAsync(roots, lineGuid);
            if (!cur) return false;
            for (let depth = 0; depth < 500; depth++) {
                const g = lineItemGuid(cur);
                if (g === zoomGuid) return true;
                const p = await cur.getParent();
                if (!p) return false;
                if (typeof p.getLineItems === 'function') return false;
                cur = p;
            }
            return false;
        };

        const getDomLinePlainText = (li) => {
            const lineDiv = li.querySelector(':scope > .line-div')
                || li.querySelector('.line-div');
            if (!lineDiv) return '';
            const clone = lineDiv.cloneNode(true);
            clone.querySelectorAll('.bt-bullet, .listitem-indentline').forEach(el => el.remove());
            return clone.textContent
                .replace(/\u200b/g, '')
                .replace(/\u00a0/g, ' ')
                .replace(/[\uFEFF\u2060]/g, '')
                .trim();
        };

        const lineDomLooksEmpty = (li) => {
            const t = getDomLinePlainText(li);
            if (!t.length) return true;
            const lower = t.toLowerCase();
            if (lower === 'new line' || lower === 'type here' || lower === 'empty') return true;
            return false;
        };

        const resolveRecordForIndent = (panel, pageRecordGuid) => {
            let r = panel && typeof panel.getActiveRecord === 'function'
                ? panel.getActiveRecord() : null;
            if (r && typeof r.getLineItems === 'function') return r;

            const freshPanel = this.ui.getActivePanel && this.ui.getActivePanel();
            if (freshPanel && typeof freshPanel.getActiveRecord === 'function') {
                r = freshPanel.getActiveRecord();
                if (r && typeof r.getLineItems === 'function') return r;
            }

            if (pageRecordGuid && this.data && typeof this.data.getRecord === 'function') {
                r = this.data.getRecord(pageRecordGuid);
                if (r && typeof r.getLineItems === 'function') return r;
            }

            return null;
        };

        /** After zoom, "root" rows are often not margin-left 0 — use min indent in view. */
        const getVisibleEditorListItems = () => {
            const editor = document.querySelector(EDITOR_SELECTORS) || document.body;
            return Array.from(editor.querySelectorAll('.listitem')).filter(
                li => li.offsetParent !== null && li.style.display !== 'none'
            );
        };

        const pickEmptyRootLineForZoom = (zoomGuid) => {
            const visibleItems = getVisibleEditorListItems();
            if (!visibleItems.length) return null;
            const forZoomGuid = visibleItems.filter(
                li => li.getAttribute('data-guid') === zoomGuid
            );
            if (forZoomGuid.length === 1 && lineDomLooksEmpty(forZoomGuid[0]) &&
                !forZoomGuid[0].classList.contains('listitem-task')) {
                return forZoomGuid[0];
            }
            const indents = visibleItems.map(li => getItemIndent(li));
            const minIndent = Math.min(...indents);
            const atRoot = visibleItems.filter(li =>
                getItemIndent(li) === minIndent &&
                !li.classList.contains('listitem-task')
            );
            if (!atRoot.length) return null;
            const matchZoom = atRoot.find(
                li => li.getAttribute('data-guid') === zoomGuid
            );
            const firstRoot = matchZoom || atRoot[0];
            if (!lineDomLooksEmpty(firstRoot)) return null;
            return firstRoot;
        };

        const dispatchEditorKey = (key) => {
            const keyCode = key === 'Tab' ? 9 : (key === 'Home' ? 36 : 0);
            if (!keyCode) return;
            const code = key === 'Tab' ? 'Tab' : 'Home';
            const mk = (type) => new KeyboardEvent(type, {
                key,
                code,
                keyCode,
                which: keyCode,
                bubbles: true,
                cancelable: true,
                composed: true,
                view: window
            });
            const targets = [
                document.getElementById('virtualinput-wrapper'),
                document.getElementById('editor-meta'),
                document.getElementById('editor'),
                document.activeElement,
                window,
                document,
                document.body
            ].filter(Boolean);
            for (const t of targets) {
                try {
                    t.dispatchEvent(mk('keydown'));
                    t.dispatchEvent(mk('keyup'));
                } catch (_) { /* ignore */ }
            }
        };

        const syncNavToItem = async (p, itemGuid) => {
            const r = p.navigateTo({ itemGuid: itemGuid, highlight: true });
            if (r && typeof r.then === 'function') await r;
            if (typeof this.ui.setActivePanel === 'function') {
                try { this.ui.setActivePanel(p); } catch (_) { /* ignore */ }
            }
        };

        /** Mark the line opened for first edit after empty zoom: no bullet, inset text. */
        const applyZoomStartLineStyle = (itemGuid) => {
            if (!itemGuid) return;
            this.zoomStartLineGuids.add(itemGuid);
            const bumpOutline = () => {
                setTimeout(() => {
                    try {
                        if (typeof scheduleOutlineUpdate === 'function') {
                            scheduleOutlineUpdate();
                        }
                    } catch (_) { /* ignore */ }
                }, 0);
            };
            const mark = () => {
                const li = Array.from(document.querySelectorAll('.listitem')).find(
                    (n) => n.getAttribute('data-guid') === itemGuid
                );
                if (li) li.classList.add('bt-zoom-start-line');
            };
            mark();
            bumpOutline();
            requestAnimationFrame(() => { mark(); bumpOutline(); });
            setTimeout(() => { mark(); bumpOutline(); }, 0);
            setTimeout(() => { mark(); bumpOutline(); }, 120);
            setTimeout(() => { mark(); bumpOutline(); }, 400);
            setTimeout(() => { mark(); bumpOutline(); }, 900);
        };

        /**
         * After a successful zoom into an empty node, ensure the cursor lands
         * on an indented child line beneath the zoomed item.
         *
         * Strategy (in priority order):
         *  1. If the zoom target already has children → navigate to the first child.
         *  2. Find a different empty root-level DOM line and move() it under the zoom target.
         *  3. Create a child via PluginRecord APIs only (createLineItem with full args,
         *     then insertFromPlainText / insertFromMarkdown with tree growth checks).
         *
         * execCommand / synthetic Tab are not used: Thymer ignores untrusted input and
         * the host editor is not a classic contenteditable indent target.
         *
         * Each strategy is attempted across multiple retries to handle Thymer's
         * async painting/hydration delays.
         */
        const indentEmptyZoomViaApi = async (panel, zoomGuid, pageRecordGuid) => {
            const DBG = '[indent-rainbow][zoom-indent]';

            const childCountForGuid = async (rec, g) => {
                if (!rec || !g) return -1;
                let roots;
                try { roots = await rec.getLineItems(); }
                catch { return -1; }
                const z = await findLineItemByGuidAsync(roots, g);
                if (!z) return -1;
                let ch = z.children;
                if (ch == null && typeof z.getChildren === 'function') {
                    try { ch = await z.getChildren(); } catch { ch = null; }
                }
                return ch ? ch.length : 0;
            };

            const lastChildGuidForZoom = async (rec, g) => {
                let roots;
                try { roots = await rec.getLineItems(); }
                catch { return null; }
                const z = await findLineItemByGuidAsync(roots, g);
                if (!z) return null;
                let ch = z.children;
                if (ch == null && typeof z.getChildren === 'function') {
                    try { ch = await z.getChildren(); } catch { ch = null; }
                }
                if (!ch || !ch.length) return null;
                return lineItemGuid(ch[ch.length - 1]);
            };

            /**
             * Structural "indent" in Thymer = parent/child in the line-item tree.
             * createLineItem(parent, after, type, segments, properties) must use all
             * five parameters; insert* returns boolean — detect new children by count.
             */
            const tryCreateChildUnderZoom = async (record, zoomItem, zGuid) => {
                const emptySeg = [{ type: 'text', text: '' }];
                if (typeof record.createLineItem === 'function') {
                    let r0;
                    try { r0 = await record.getLineItems(); } catch { r0 = null; }
                    const parentLatest = r0
                        ? (await findLineItemByGuidAsync(r0, zGuid) || zoomItem)
                        : zoomItem;
                    const creators = [
                        () => record.createLineItem(parentLatest, null, 'text', null, null),
                        () => record.createLineItem(parentLatest, null, 'text', emptySeg, null),
                        () => record.createLineItem(parentLatest, null, 'empty', null, null),
                    ];
                    for (const c of creators) {
                        try {
                            const created = await c();
                            if (created != null) {
                                const ng = lineItemGuid(created);
                                if (ng) return ng;
                            }
                        } catch (e) {
                            console.debug(`${DBG} createLineItem variant failed`, e);
                        }
                    }
                }

                const insertSteps = [];
                if (typeof record.insertFromPlainText === 'function') {
                    insertSteps.push((p) => record.insertFromPlainText('', p, null));
                    insertSteps.push((p) => record.insertFromPlainText('\n', p, null));
                    insertSteps.push((p) => record.insertFromPlainText(' ', p, null));
                }
                if (typeof record.insertFromMarkdown === 'function') {
                    insertSteps.push((p) => record.insertFromMarkdown('- ', p, null));
                    insertSteps.push((p) => record.insertFromMarkdown('* ', p, null));
                }
                for (const step of insertSteps) {
                    try {
                        let r2;
                        try { r2 = await record.getLineItems(); }
                        catch { continue; }
                        const parent = await findLineItemByGuidAsync(r2, zGuid) || zoomItem;
                        const n0 = await childCountForGuid(record, zGuid);
                        if (n0 < 0) continue;
                        const ok = await step(parent);
                        if (ok === false) continue;
                        await waitMs(280);
                        const n1 = await childCountForGuid(record, zGuid);
                        if (n1 > n0) {
                            const g = await lastChildGuidForZoom(record, zGuid);
                            if (g) return g;
                        }
                    } catch (e) {
                        console.debug(`${DBG} insert* variant failed`, e);
                    }
                }
                return null;
            };

            for (let attempt = 0; attempt < 8; attempt++) {
                if (attempt > 0) await waitMs(350);

                // --- Resolve record ------------------------------------------
                let record = resolveRecordForIndent(panel, pageRecordGuid);
                if (!record) {
                    // Panel may still be transitioning — try harder
                    await waitMs(300);
                    record = resolveRecordForIndent(panel, pageRecordGuid);
                }
                if (!record || typeof record.getLineItems !== 'function') {
                    console.debug(`${DBG} attempt ${attempt}: no record`);
                    continue;
                }

                // --- Get fresh root items ------------------------------------
                let roots;
                try { roots = await record.getLineItems(); }
                catch (e) { console.debug(`${DBG} attempt ${attempt}: getLineItems threw`, e); continue; }
                if (!roots || !roots.length) {
                    console.debug(`${DBG} attempt ${attempt}: empty roots`);
                    continue;
                }

                // --- Find zoom target in tree --------------------------------
                let zoomItem = await findLineItemByGuidAsync(roots, zoomGuid);
                if (!zoomItem) {
                    console.debug(`${DBG} attempt ${attempt}: zoom item ${zoomGuid} not in tree`);
                    continue;
                }

                // --- 1. Does it already have children? -----------------------
                let children = zoomItem.children;
                if (children == null && typeof zoomItem.getChildren === 'function') {
                    try { children = await zoomItem.getChildren(); } catch { children = null; }
                }
                if (children && children.length > 0) {
                    const firstGuid = lineItemGuid(children[0]);
                    console.debug(`${DBG} zoom target already has children, nav to ${firstGuid}`);
                    if (firstGuid) {
                        await syncNavToItem(panel, firstGuid);
                        await waitMs(60);
                        dispatchEditorKey('Home');
                        applyZoomStartLineStyle(firstGuid);
                        return true;
                    }
                }

                // --- 2. move(): empty root line that is NOT the zoom row → under zoom target
                const emptyRootForMove = pickEmptyRootLineForZoom(zoomGuid);
                if (emptyRootForMove) {
                    const domGuid = emptyRootForMove.getAttribute('data-guid');
                    if (domGuid && domGuid !== zoomGuid) {
                        try {
                            try { roots = await record.getLineItems(); }
                            catch { /* keep roots */ }

                            let lineToMove = await findLineItemByGuidAsync(roots, domGuid);
                            let zoomRef = await findLineItemByGuidAsync(roots, zoomGuid);
                            if (lineToMove && zoomRef && typeof lineToMove.move === 'function') {
                                const moved = await lineToMove.move(zoomRef, null);
                                if (moved != null) {
                                    await waitMs(120);
                                    await syncNavToItem(panel, domGuid);
                                    await waitMs(60);
                                    dispatchEditorKey('Home');
                                    applyZoomStartLineStyle(domGuid);
                                    return true;
                                }
                                if (typeof lineToMove.getParent === 'function') {
                                    const parent = await lineToMove.getParent();
                                    if (parent && lineItemGuid(parent) === zoomGuid) {
                                        await syncNavToItem(panel, domGuid);
                                        await waitMs(60);
                                        dispatchEditorKey('Home');
                                        applyZoomStartLineStyle(domGuid);
                                        return true;
                                    }
                                }
                            }
                        } catch (e) {
                            console.debug(`${DBG} attempt ${attempt}: move() failed:`, e);
                        }
                    }
                }

                // --- 3. Create a child under the zoom target (record API only) ---
                try {
                    const newGuid = await tryCreateChildUnderZoom(record, zoomItem, zoomGuid);
                    if (newGuid) {
                        console.debug(`${DBG} new child under zoom ${newGuid}`);
                        await waitMs(150);
                        await syncNavToItem(panel, newGuid);
                        await waitMs(60);
                        dispatchEditorKey('Home');
                        applyZoomStartLineStyle(newGuid);
                        return true;
                    }
                } catch (e) {
                    console.debug(`${DBG} attempt ${attempt}: tryCreateChildUnderZoom failed:`, e);
                }
            }

            console.debug(`${DBG} all API attempts exhausted`);
            return false;
        };

        /**
         * Orchestrator: called after a zoom navigation completes.
         * Indentation is done only via PluginRecord / PluginLineItem APIs (see indentEmptyZoomViaApi).
         */
        const maybeIndentEmptyZoomedLine = async (panel, zoomGuid, pageRecordGuid) => {
            const DBG = '[indent-rainbow][zoom-indent]';

            // Wait for Thymer to finish painting the zoomed view.
            // Use an escalating wait: check the DOM periodically rather than
            // a single fixed delay, so we react as soon as the editor settles.
            let domReady = false;
            for (let wait = 0; wait < 6; wait++) {
                await waitMs(wait === 0 ? 400 : 250);
                const items = getVisibleEditorListItems();
                if (items.length > 0) { domReady = true; break; }
            }
            if (!domReady) {
                console.debug(`${DBG} DOM never populated after zoom`);
                return;
            }

            if (await indentEmptyZoomViaApi(panel, zoomGuid, pageRecordGuid)) return;

            console.debug(`${DBG} API could not create a nested line; DOM Tab/execCommand unavailable`);
            if (this.ui && typeof this.ui.showToaster === 'function') {
                this.ui.showToaster({
                    message: 'Could not add a nested line automatically — use Tab in the editor to indent.',
                    type: 'warning',
                    duration: 3200
                });
            }
        };

        // Workflowy-style zoom: navigate to the record root first (un-zooming
        // if already zoomed somewhere), wait for the record to hydrate, then
        // navigate with the line-item guid as rootId. The setActivePanel call
        // after each navigateTo is what actually flips the rendered view —
        // navigateTo alone updates nav state silently.
        const zoomToItem = async (li) => {
            const guid = li.getAttribute('data-guid') || await resolveLineItemGuid(li);
            if (!guid) {
                this.ui.showToaster({
                    message: 'Could not resolve item to zoom into',
                    type: 'warning',
                    duration: 1500
                });
                return;
            }

            const panel = this.ui.getActivePanel && this.ui.getActivePanel();
            if (!panel || typeof panel.navigateTo !== 'function') return;

            const currentNav = (typeof panel.getNavigation === 'function'
                ? panel.getNavigation()
                : null) || {};

            const record = panel.getActiveRecord && panel.getActiveRecord();
            const recordGuid = (record && typeof record.getGuid === 'function'
                ? record.getGuid()
                : null) || currentNav.rootId || null;
            const pageRecordGuid = record && typeof record.getGuid === 'function'
                ? record.getGuid()
                : null;
            const workspaceGuid = currentNav.workspaceGuid
                || (typeof this.getWorkspaceGuid === 'function'
                    ? this.getWorkspaceGuid()
                    : null);

            if (!recordGuid) return;

            const type = currentNav.type || 'edit_panel';
            const doNav = async (p, nav) => {
                const r = p.navigateTo(nav);
                if (r && typeof r.then === 'function') await r;
                if (typeof this.ui.setActivePanel === 'function') {
                    try { this.ui.setActivePanel(p); } catch (_) { /* ignore */ }
                }
            };

            try {
                if (currentNav.rootId !== recordGuid) {
                    await doNav(panel, { type, rootId: recordGuid, workspaceGuid });
                    await waitMs(350);
                }

                await doNav(panel, { type, rootId: guid, workspaceGuid });
                await waitMs(50);
                syncLineZoomContext();
                const afterZoom = typeof panel.getNavigation === 'function'
                    ? panel.getNavigation() : {};
                if (afterZoom && afterZoom.rootId === guid) {
                    void maybeIndentEmptyZoomedLine(panel, guid, pageRecordGuid);
                    return;
                }

                // Fallback: scroll+highlight within the record.
                await doNav(panel, { itemGuid: guid, highlight: true });
            } catch (err) {
                console.warn('[indent-rainbow] zoom failed:', err);
            }
        };

        // Unified click handler: bullet span → zoom; caret zone → toggle.
        // Capture phase, one pass, so we don't rely on stopImmediatePropagation
        // to coordinate between two handlers.
        const outlineClickHandler = (e) => {
            if (!isEnabled) return;
            const target = e.target;
            if (!target) return;

            if (isBulletsEnabled) {
                const bullet = target.closest?.('.bt-bullet');
                if (bullet) {
                    const li = bullet.closest('.listitem');
                    if (li) {
                        e.preventDefault();
                        e.stopPropagation();
                        zoomToItem(li);
                        return;
                    }
                }
            }

            if (isTogglesEnabled) {
                const lineDiv = target.closest?.('.line-div');
                if (!lineDiv) return;

                const li = lineDiv.closest('.listitem');
                if (!li || !li.classList.contains('bt-has-children')) return;

                const rect = lineDiv.getBoundingClientRect();
                const relX = e.clientX - rect.left;
                if (relX < 0 || relX > 24) return;

                e.preventDefault();
                e.stopPropagation();
                li.classList.toggle('bt-collapsed');
                applyCollapseState();
            }
        };

        const updateOutlineEnhancements = () => {
            outlineRafPending = false;
            const items = annotateHasChildren();
            applyCollapseState(items);
        };

        const scheduleOutlineUpdate = () => {
            if (outlineRafPending) return;
            outlineRafPending = true;
            requestAnimationFrame(updateOutlineEnhancements);
        };

        // Observe the editor subtree for structural changes and re-run the
        // pass. Filter mutations aggressively in the callback — the editor
        // hosts #virtualinput-wrapper whose inline style is rewritten on every
        // keystroke, so a naive observer reschedules the outline update
        // hundreds of times per second during typing.
        const setupOutlineObserver = () => {
            const target =
                document.querySelector(EDITOR_SELECTORS) || document.body;

            const isListItem = (n) =>
                n && n.nodeType === 1 &&
                (n.classList?.contains('listitem') || n.querySelector?.('.listitem'));

            const observer = new MutationObserver((mutations) => {
                for (const m of mutations) {
                    if (m.type === 'childList') {
                        for (const n of m.addedNodes) {
                            if (isListItem(n)) { scheduleOutlineUpdate(); return; }
                        }
                        for (const n of m.removedNodes) {
                            if (isListItem(n)) { scheduleOutlineUpdate(); return; }
                        }
                    } else if (m.type === 'attributes' && m.attributeName === 'style') {
                        const t = m.target;
                        if (t.classList?.contains('line-div') ||
                            t.classList?.contains('line-check-div')) {
                            scheduleOutlineUpdate();
                            return;
                        }
                    }
                }
            });
            observer.observe(target, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style']
            });
            this.cleanupMethods.push(() => observer.disconnect());

            // Initial pass shortly after mount (Thymer may still be painting).
            scheduleOutlineUpdate();
            setTimeout(scheduleOutlineUpdate, 250);
            setTimeout(scheduleOutlineUpdate, 1000);
        };

        setupOutlineObserver();

        // Zoom: reparent lines created outside the zoom subtree so they become children of the zoom root.
        const handleLineItemCreatedForZoom = async (ev) => {
            if (!ev || ev.eventName !== 'lineitem.created') return;
            if (this._zoomReparentBusy) return;
            const zoomGuid = this.lineZoomRootGuid;
            if (!zoomGuid) return;

            const newGuid = ev.lineItemGuid;
            if (!newGuid || newGuid === zoomGuid) return;

            const panel = this.ui.getActivePanel && this.ui.getActivePanel();
            const record = panel && panel.getActiveRecord && panel.getActiveRecord();
            if (!record || typeof record.getLineItems !== 'function') return;
            if (ev.recordGuid && typeof record.getGuid === 'function'
                && record.getGuid() !== ev.recordGuid) return;

            const parentGuid = ev.parentGuid != null ? ev.parentGuid : null;
            if (parentGuid) {
                const under = await isLineUnderZoomSubtree(record, parentGuid, zoomGuid);
                if (under) return;
            }

            let roots;
            try { roots = await record.getLineItems(); }
            catch { return; }

            let zoomItem = await findLineItemByGuidAsync(roots, zoomGuid);
            if (!zoomItem) return;

            let newItem = await findLineItemByGuidAsync(roots, newGuid);
            if (!newItem && typeof ev.getLineItem === 'function') {
                try { newItem = await ev.getLineItem(); } catch { newItem = null; }
            }
            if (!newItem || typeof newItem.move !== 'function') return;

            this._zoomReparentBusy = true;
            try {
                let ch = zoomItem.children;
                if (ch == null && typeof zoomItem.getChildren === 'function') {
                    try { ch = await zoomItem.getChildren(); } catch { ch = null; }
                }
                const list = ch || [];
                const siblingsExcludingNew = list.filter((c) => lineItemGuid(c) !== newGuid);
                const afterItem = siblingsExcludingNew.length
                    ? siblingsExcludingNew[siblingsExcludingNew.length - 1]
                    : null;
                await newItem.move(zoomItem, afterItem);
            } catch (e) {
                console.debug('[indent-rainbow][zoom-reparent] move failed:', e);
            } finally {
                this._zoomReparentBusy = false;
            }
        };

        // New record / fresh panel: one visible empty root line — hide bullet like zoom-start.
        if (this.events && typeof this.events.on === 'function') {
            let newRecordNavTimer = null;
            const onPanelNavigated = () => {
                syncLineZoomContext();
                if (newRecordNavTimer) clearTimeout(newRecordNavTimer);
                newRecordNavTimer = setTimeout(() => {
                    newRecordNavTimer = null;
                    const items = getVisibleEditorListItems();
                    if (items.length !== 1) return;
                    const only = items[0];
                    if (only.classList.contains('listitem-task')) return;
                    if (!lineDomLooksEmpty(only)) return;
                    const g = only.getAttribute('data-guid');
                    if (g) applyZoomStartLineStyle(g);
                }, 550);
            };
            const panelNavId = this.events.on('panel.navigated', onPanelNavigated);
            const lineCreatedId = this.events.on('lineitem.created', (ev) => {
                void handleLineItemCreatedForZoom(ev);
            }, { collection: '*' });
            this.cleanupMethods.push(() => {
                if (newRecordNavTimer) clearTimeout(newRecordNavTimer);
                try {
                    this.events.off(panelNavId);
                } catch (_) { /* ignore */ }
                try {
                    this.events.off(lineCreatedId);
                } catch (_) { /* ignore */ }
            });
        }

        syncLineZoomContext();

        // Single click hook in capture phase so we beat Thymer's own handlers.
        document.addEventListener('click', outlineClickHandler, true);
        this.cleanupMethods.push(() => {
            document.removeEventListener('click', outlineClickHandler, true);
        });

        // =====================================================
        // JS-driven coloring — all item types via --ir-color var
        // =====================================================

        const INDENT_STEP = 30;

        const colorIndentLine = (item) => {
            const indentLine = item.querySelector('.listitem-indentline');
            if (!indentLine) return;

            const lineDiv = item.querySelector('.line-div');
            const isEmpty = lineDiv
                ? !Array.from(lineDiv.childNodes).some(n =>
                    !(n.nodeType === 1 && (n.classList?.contains('listitem-indentline')
                        || n.classList?.contains('bt-active-highlight')
                        || n.classList?.contains('bt-bullet')))
                    && (n.textContent || '').trim().length > 0
                  )
                : !(item.textContent || '').trim();

            if (isEmpty) {
                indentLine.style.setProperty('display', 'none', 'important');
                indentLine.dataset.btEmpty = '1';
            } else if (indentLine.dataset.btEmpty) {
                indentLine.style.removeProperty('display');
                delete indentLine.dataset.btEmpty;
            }

            let marginLeft = 0;
            for (let i = 0; i < item.children.length; i++) {
                const child = item.children[i];
                if (child.style && child.style.marginLeft) {
                    const ml = parseInt(child.style.marginLeft) || 0;
                    if (ml >= 0) { marginLeft = ml; break; }
                }
            }
            if (marginLeft === 0 && item.style && item.style.marginLeft) {
                marginLeft = parseInt(item.style.marginLeft) || 0;
            }

            const level = Math.max(0, Math.floor(marginLeft / INDENT_STEP));
            indentLine.style.setProperty('--ir-color', `var(--ir-level-${level})`, 'important');
            indentLine.dataset.btManaged = '1';
        };

        const clearListColors = () => {
            const lines = document.querySelectorAll('.listitem-indentline[data-bt-managed], .listitem-indentline[data-bt-empty]');
            for (const line of lines) {
                line.style.removeProperty('--ir-color');
                line.style.removeProperty('display');
                delete line.dataset.btManaged;
                delete line.dataset.btEmpty;
            }
        };

        const applyListColors = (items) => {
            if (!isEnabled) return;
            for (const item of items) colorIndentLine(item);
        };

        let listColorRafPending = false;
        let pendingItems = new Set();

        const scheduleListColorUpdate = (items) => {
            if (items) items.forEach(i => pendingItems.add(i));
            if (!listColorRafPending) {
                listColorRafPending = true;
                requestAnimationFrame(() => {
                    listColorRafPending = false;
                    const toProcess = pendingItems.size > 0
                        ? [...pendingItems]
                        : [...document.querySelectorAll('.listitem')];
                    pendingItems.clear();
                    applyListColors(toProcess);
                });
            }
        };

        // =====================================================
        // Win 2: Scoped mutation observer — editor container only
        // =====================================================

        const editorContainer = document.querySelector('.editor-wrapper, .page-content, #editor') || document.body;

        const listColorObserver = new MutationObserver((mutations) => {
            const affected = new Set();
            for (const m of mutations) {
                if (m.type === 'childList') {
                    for (const node of m.addedNodes) {
                        if (node.nodeType !== 1) continue;
                        if (node.classList.contains('listitem')) {
                            affected.add(node);
                        } else if (node.querySelector) {
                            node.querySelectorAll('.listitem').forEach(n => affected.add(n));
                        }
                    }
                } else if (m.type === 'attributes') {
                    const li = m.target.closest?.('.listitem');
                    if (li) affected.add(li);
                }
            }
            if (affected.size > 0) {
                scheduleListColorUpdate(affected);
            } else {
                scheduleListColorUpdate(null);
            }
        });

        listColorObserver.observe(editorContainer, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
        });

        this.cleanupMethods.push(() => {
            listColorObserver.disconnect();
            clearListColors();
        });

        scheduleListColorUpdate(null);

        // Ensure closed-over DOM references are released on unload
        let statusBarItem = null;
        this.cleanupMethods.push(() => {
            currentFocusedItem = null;
            activeHighlights.length = 0;
            statusBarItem = null;
        });

        const updateSettings = (newSettings) => {
            if (newSettings.currentScheme !== undefined) currentScheme = newSettings.currentScheme;
            if (newSettings.currentWidth !== undefined) currentWidth = parseInt(newSettings.currentWidth);
            if (newSettings.activeWidth !== undefined) activeWidth = parseInt(newSettings.activeWidth);
            if (newSettings.currentOpacity !== undefined) currentOpacity = parseFloat(newSettings.currentOpacity);
            if (newSettings.isEnabled !== undefined) isEnabled = newSettings.isEnabled;
            if (newSettings.isThreadingEnabled !== undefined) isThreadingEnabled = newSettings.isThreadingEnabled;
            if (newSettings.threadingMode !== undefined) threadingMode = newSettings.threadingMode;
            if (newSettings.isBulletsEnabled !== undefined) isBulletsEnabled = newSettings.isBulletsEnabled;
            if (newSettings.isTogglesEnabled !== undefined) isTogglesEnabled = newSettings.isTogglesEnabled;
            if (newSettings.currentScheme !== undefined) applySchemeVars(currentScheme);
            applySettingVars();
            applyEnabledState();
            saveSettings();
            if (!isEnabled) this.lineZoomRootGuid = null;
            if (newSettings.isTogglesEnabled !== undefined && !newSettings.isTogglesEnabled) {
                document.querySelectorAll('.listitem.bt-collapsed').forEach(el => {
                    el.classList.remove('bt-collapsed');
                });
                document.querySelectorAll('.listitem[style*="display: none"]').forEach(el => {
                    el.style.display = '';
                });
            }
            if (isEnabled) {
                scheduleListColorUpdate(null);
            } else {
                clearListColors();
            }
            scheduleOutlineUpdate();
            scheduleUpdate(null);
            if (statusBarItem && typeof statusBarItem.setTooltip === 'function') {
                statusBarItem.setTooltip(`Indent Rainbow – ${colorSchemes[currentScheme]?.name ?? currentScheme}`);
            }
        };

        // Register the panel type
        this.ui.registerCustomPanelType("indent-rainbow-settings", (panel) => {
            this.renderSettingsUI(panel, {
                colorSchemes, opacityPresets,
                getSettings: () => ({
                    currentScheme, currentWidth, activeWidth, currentOpacity, isEnabled,
                    isThreadingEnabled, threadingMode, isBulletsEnabled, isTogglesEnabled
                }),
                updateSettings,
                createIcon: (name) => this.ui.createIcon(name)
            });
        });

        // Add a status bar button (icon only; theme name is in the tooltip)
        statusBarItem = this.ui.addStatusBarItem({
            icon: "paint",
            tooltip: `Indent Rainbow – ${colorSchemes[currentScheme]?.name ?? currentScheme}`,
            onClick: async () => {
                const newPanel = await this.ui.createPanel();
                if (newPanel) {
                    newPanel.navigateToCustomType("indent-rainbow-settings");
                }
            }
        });

        // Add a command to the Command Palette
        this.ui.addCommandPaletteCommand({
            label: "Indent Rainbow: Settings",
            icon: "paint",
            onSelected: async () => {
                const newPanel = await this.ui.createPanel();
                if (newPanel) {
                    newPanel.navigateToCustomType("indent-rainbow-settings");
                }
            }
        });

        const paletteRefresh = () => {
            applySchemeVars(currentScheme);
            applySettingVars();
            applyEnabledState();
            saveSettings();
            if (isEnabled) scheduleListColorUpdate(null);
            else clearListColors();
            scheduleOutlineUpdate();
            scheduleUpdate(null);
        };

        this.ui.addCommandPaletteCommand({
            label: 'Indent Rainbow: Toggle On/Off',
            icon: 'toggle-left',
            onSelected: () => {
                isEnabled = !isEnabled;
                saveSettings();
                paletteRefresh();
                if (this.ui.showToaster) {
                    this.ui.showToaster({
                        message: `Indent Rainbow ${isEnabled ? 'enabled' : 'disabled'}`,
                        type: 'success',
                        duration: 1500
                    });
                }
            }
        });

        this.ui.addCommandPaletteCommand({
            label: 'Indent Rainbow: Toggle Active Threading',
            icon: 'target',
            onSelected: () => {
                isThreadingEnabled = !isThreadingEnabled;
                saveSettings();
                paletteRefresh();
                if (this.ui.showToaster) {
                    this.ui.showToaster({
                        message: `Active thread highlighting ${isThreadingEnabled ? 'enabled' : 'disabled'}`,
                        type: 'success',
                        duration: 1500
                    });
                }
            }
        });

        this.ui.addCommandPaletteCommand({
            label: 'Indent Rainbow: Toggle Threading Style (Staircase/Stretched)',
            icon: 'layout-list',
            onSelected: () => {
                threadingMode = threadingMode === 'staircase' ? 'stretched' : 'staircase';
                saveSettings();
                paletteRefresh();
                if (this.ui.showToaster) {
                    this.ui.showToaster({
                        message: `Threading style: ${threadingMode}`,
                        type: 'success',
                        duration: 1500
                    });
                }
            }
        });

        this.ui.addCommandPaletteCommand({
            label: 'Indent Rainbow: Toggle Bullets',
            icon: 'circle-dot',
            onSelected: () => {
                isBulletsEnabled = !isBulletsEnabled;
                saveSettings();
                paletteRefresh();
                if (this.ui.showToaster) {
                    this.ui.showToaster({
                        message: `Bullets ${isBulletsEnabled ? 'enabled' : 'disabled'}`,
                        type: 'success',
                        duration: 1500
                    });
                }
            }
        });

        this.ui.addCommandPaletteCommand({
            label: 'Indent Rainbow: Toggle Disclosure Carets',
            icon: 'chevron-down',
            onSelected: () => {
                isTogglesEnabled = !isTogglesEnabled;
                if (!isTogglesEnabled) {
                    document.querySelectorAll('.listitem.bt-collapsed').forEach(el => {
                        el.classList.remove('bt-collapsed');
                    });
                    document.querySelectorAll('.listitem[style*="display: none"]').forEach(el => {
                        el.style.display = '';
                    });
                }
                saveSettings();
                paletteRefresh();
                if (this.ui.showToaster) {
                    this.ui.showToaster({
                        message: `Disclosure carets ${isTogglesEnabled ? 'enabled' : 'disabled'}`,
                        type: 'success',
                        duration: 1500
                    });
                }
            }
        });

    }

    onUnload() {
        this.isUnloaded = true;

        if (this.cleanupMethods) {
            this.cleanupMethods.forEach(cleanupFn => {
                try { cleanupFn(); } catch (e) {
                    console.warn('Failed to clean up plugin resource:', e);
                }
            });
            this.cleanupMethods = [];
        }

        document.querySelectorAll('.bt-active-highlight').forEach(el => el.remove());
        document.querySelectorAll('.bt-focused').forEach(el => el.classList.remove('bt-focused'));
        document.querySelectorAll('.bt-bullet').forEach(el => el.remove());
        document.querySelectorAll('.bt-has-children').forEach(el => {
            el.classList.remove('bt-has-children');
        });
        document.querySelectorAll('.bt-collapsed').forEach(el => {
            el.classList.remove('bt-collapsed');
        });
        document.querySelectorAll('.bt-zoom-start-line').forEach(el => {
            el.classList.remove('bt-zoom-start-line');
        });
        if (this.zoomStartLineGuids) this.zoomStartLineGuids.clear();
        this.lineZoomRootGuid = null;
        this._zoomReparentBusy = false;
        document.querySelectorAll('.listitem').forEach(el => {
            if (el.style.display === 'none') el.style.display = '';
        });
        document.body.classList.remove('ir-enabled', 'bt-bullets', 'bt-toggles');

        if (this.styleElement) {
            this.styleElement.remove();
            this.styleElement = null;
        }
    }

    renderSettingsUI(panel, api) {
        const settings = api.getSettings();
        const element = panel.getElement();
        if (!element) return;

        element.innerHTML = ''; // Clear previous content

        // Add styles using theme variables
        const style = document.createElement('style');
        style.textContent = `
            .ir-settings * { box-sizing: border-box; }
            .ir-settings { 
                --ir-accent: var(--theme-accent, var(--button-primary-bg-color, var(--cmdpal-selected-bg-color, var(--color-primary-400, #3b82f6))));
                --ir-accent-subtle: var(--theme-accent-subtle, rgba(59, 130, 246, 0.15));
                --ir-text: var(--theme-text-primary, var(--color-text-100, #fff));
                --ir-text-secondary: var(--theme-text-secondary, var(--color-text-500, #888));
                --ir-bg: var(--theme-background-secondary, var(--color-bg-700, #1e1e2e));
                --ir-border: var(--theme-border, var(--color-bg-500, #333));
                --ir-input-bg: var(--input-bg-color, var(--theme-background-primary, var(--color-bg-800, #111)));
                --ir-panel-bg: var(--theme-background-primary, var(--color-bg-800, #111));
                --ir-panel-border: color-mix(in srgb, var(--ir-border) 78%, transparent);
                --ir-soft-bg: color-mix(in srgb, var(--ir-bg) 82%, var(--ir-panel-bg));
                
                padding: 24px 24px 40px; 
                max-width: 760px; 
                margin: 0 auto; 
                font-family: var(--font-m, var(--font-primary, inherit)); 
                color: var(--ir-text);
                line-height: 1.5;
            }
            .ir-header { 
                margin-bottom: 20px; 
                padding-bottom: 8px; 
            }
            .ir-title { 
                margin: 0; 
                display: flex; 
                align-items: center; 
                gap: 10px; 
                font-size: 1.35em; 
                font-weight: 650; 
                color: var(--ir-text); 
            }
            .ir-title svg,
            .ir-card h3 svg {
                color: var(--ir-accent);
            }
            .ir-header-copy {
                margin: 10px 0 0;
                max-width: 560px;
                font-size: 0.95em;
                color: var(--ir-text-secondary);
            }
            .ir-card { 
                padding: 18px 18px 8px; 
                border-radius: 14px; 
                border: 1px solid var(--ir-panel-border); 
                background: var(--ir-soft-bg); 
                margin-bottom: 16px; 
                box-shadow: none; 
            }
            .ir-card h3 { 
                margin-top: 0; 
                margin-bottom: 6px; 
                display: flex; 
                align-items: center; 
                gap: 8px; 
                font-size: 1em; 
                font-weight: 600; 
                color: var(--ir-text); 
            }
            .ir-card-copy {
                margin: 0 0 16px;
                font-size: 0.9em;
                color: var(--ir-text-secondary);
            }
            .ir-row { 
                display: flex; 
                align-items: flex-start; 
                gap: 16px;
                justify-content: space-between; 
                margin-bottom: 16px; 
            }
            .ir-row:last-child { margin-bottom: 0; }
            .ir-label-group { display: flex; flex-direction: column; gap: 6px; flex: 1; }
            .ir-label-group strong { font-weight: 600; color: var(--ir-text); }
            .ir-subtitle { font-size: 0.9em; color: var(--ir-text-secondary); opacity: 0.9; }
            .ir-control {
                width: min(280px, 44%);
                flex-shrink: 0;
            }
            .ir-slider-control {
                width: min(320px, 48%);
                flex-shrink: 0;
            }
            .ir-input { 
                width: 100%; 
                min-height: 38px;
                padding: 8px 12px; 
                border-radius: 10px; 
                border: 1px solid var(--ir-panel-border); 
                background: var(--ir-input-bg); 
                color: var(--ir-text); 
                font-family: inherit; 
                font-size: 0.95em;
                transition: border-color 0.2s, box-shadow 0.2s, background-color 0.2s; 
                cursor: pointer;
            }
            .ir-input:hover {
                background: color-mix(in srgb, var(--ir-input-bg) 92%, var(--ir-accent-subtle));
            }
            .ir-input:focus { 
                outline: none; 
                border-color: var(--ir-accent) !important; 
                box-shadow: 0 0 0 2px var(--ir-accent-subtle); 
            }
            .ir-checkbox { 
                width: 22px; 
                height: 22px; 
                accent-color: var(--ir-accent) !important; 
                cursor: pointer; 
                border-radius: 6px;
                background-color: var(--ir-input-bg) !important;
                border: 2px solid var(--ir-border);
                appearance: auto; /* Fallback to native themed if possible */
                -webkit-appearance: checkbox;
            }
            .ir-range { 
                width: 100%; 
                cursor: pointer; 
                margin-top: 10px; 
                height: 6px;
                border-radius: 3px;
                background: color-mix(in srgb, var(--ir-border) 70%, transparent) !important;
                appearance: none;
                -webkit-appearance: none;
                outline: none;
            }
            .ir-range::-webkit-slider-thumb {
                height: 20px;
                width: 20px;
                border-radius: 50%;
                background: var(--ir-accent) !important;
                cursor: pointer;
                appearance: none;
                -webkit-appearance: none;
                margin-top: -7px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                border: 2px solid var(--ir-bg);
            }
            .ir-range::-moz-range-thumb {
                height: 20px;
                width: 20px;
                border-radius: 50%;
                background: var(--ir-accent) !important;
                cursor: pointer;
                border: 2px solid var(--ir-bg);
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            }
            .ir-val-text { 
                font-weight: 700; 
                color: var(--ir-accent); 
                background: var(--ir-accent-subtle);
                padding: 3px 10px;
                border-radius: 999px;
                font-size: 0.85em;
                min-width: 52px;
                text-align: center;
            }
            .ir-slider-meta {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
            }
            .ir-swatch-row {
                display: flex;
                gap: 6px;
                margin-top: 8px;
                flex-wrap: wrap;
            }
            .ir-swatch {
                width: 14px;
                height: 14px;
                border-radius: 999px;
                border: 1px solid color-mix(in srgb, var(--ir-panel-bg) 55%, transparent);
                box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06);
            }
            .ir-preview {
                padding: 16px 18px 14px;
                border-radius: 14px;
                border: 1px solid var(--ir-panel-border);
                background: var(--ir-panel-bg);
                margin-bottom: 16px;
            }
            .ir-preview-label {
                font-size: 0.78em;
                font-weight: 600;
                letter-spacing: 0.06em;
                text-transform: uppercase;
                color: var(--ir-text-secondary);
                margin-bottom: 10px;
            }
            .ir-preview-canvas {
                position: relative;
                height: 116px;
                border-radius: 8px;
                background: color-mix(in srgb, var(--ir-soft-bg) 60%, transparent);
                overflow: hidden;
            }
            .ir-preview-canvas.ir-preview-disabled {
                opacity: 0.35;
            }
            .ir-preview-row {
                position: absolute;
                left: 0; right: 0;
                height: 26px;
                display: flex;
                align-items: center;
            }
            .ir-preview-bar {
                position: absolute;
                top: 0;
                bottom: 0;
                border-radius: 999px;
                transition: width 0.15s, opacity 0.15s, background-color 0.15s;
            }
            .ir-preview-text {
                position: absolute;
                left: 0;
                right: 0;
                padding-left: 10px;
                font-size: 0.8em;
                color: var(--ir-text-secondary);
                opacity: 0.5;
                white-space: nowrap;
                overflow: hidden;
                pointer-events: none;
            }
            .ir-preview-arm {
                position: absolute;
                border-bottom-left-radius: 6px;
                box-sizing: border-box;
                pointer-events: none;
                transition: border-width 0.15s, border-color 0.15s;
            }
            .ir-preview-legend {
                margin-top: 8px;
                font-size: 0.82em;
                color: var(--ir-text-secondary);
                opacity: 0.75;
            }
            @media (max-width: 720px) {
                .ir-settings {
                    padding: 18px 16px 32px;
                }
                .ir-row {
                    flex-direction: column;
                    align-items: stretch;
                }
                .ir-control,
                .ir-slider-control {
                    width: 100%;
                }
            }
        `;
        element.appendChild(style);

        const container = document.createElement('div');
        container.className = 'ir-settings';

        // Header
        const header = document.createElement('div');
        header.className = 'ir-header';
        const title = document.createElement('h2');
        title.className = 'ir-title';
        title.appendChild(api.createIcon('paint'));
        title.appendChild(document.createTextNode(' Indent Rainbow Settings'));
        header.appendChild(title);
        const headerCopy = document.createElement('p');
        headerCopy.className = 'ir-header-copy';
        headerCopy.textContent = 'Tune the guide colors and active thread styling to match how you like hierarchy to feel in Thymer.';
        header.appendChild(headerCopy);
        container.appendChild(header);

        const createField = (titleText, subtitleText, controlElement, extraElement = null, controlClassName = 'ir-control') => {
            const row = document.createElement('div');
            row.className = 'ir-row';
            const label = document.createElement('div');
            label.className = 'ir-label-group';
            const strong = document.createElement('strong');
            strong.textContent = titleText;
            label.appendChild(strong);
            if (subtitleText) {
                const subtitle = document.createElement('div');
                subtitle.className = 'ir-subtitle';
                subtitle.textContent = subtitleText;
                label.appendChild(subtitle);
            }
            if (extraElement) {
                label.appendChild(extraElement);
            }
            const controlWrap = document.createElement('div');
            controlWrap.className = controlClassName;
            controlWrap.appendChild(controlElement);
            row.appendChild(label);
            row.appendChild(controlWrap);
            return row;
        };

        const setSchemeSwatches = (schemeName, containerElement) => {
            containerElement.innerHTML = '';
            (api.colorSchemes[schemeName]?.colors || []).slice(0, 8).forEach((color) => {
                const swatch = document.createElement('span');
                swatch.className = 'ir-swatch';
                swatch.style.backgroundColor = color;
                containerElement.appendChild(swatch);
            });
        };

        const formatWidthValue = (value) => value === 0 ? 'Hidden' : `${value}px`;

        // Shared local settings state — mutated by every control, drives renderPreview
        const currentSettings = Object.assign({
            isThreadingEnabled: true,
            isBulletsEnabled: true,
            isTogglesEnabled: true
        }, settings);

        // -------------------------------------------------------
        // Live preview
        // -------------------------------------------------------
        const previewCard = document.createElement('div');
        previewCard.className = 'ir-preview';
        const previewLabel = document.createElement('div');
        previewLabel.className = 'ir-preview-label';
        previewLabel.textContent = 'Live Preview';
        previewCard.appendChild(previewLabel);
        const previewCanvas = document.createElement('div');
        previewCanvas.className = 'ir-preview-canvas';
        previewCard.appendChild(previewCanvas);
        const previewLegend = document.createElement('div');
        previewLegend.className = 'ir-preview-legend';
        previewLegend.textContent = 'Updates live as you adjust settings below.';
        previewCard.appendChild(previewLegend);
        container.appendChild(previewCard);

        const PREVIEW_ROWS = 4;
        const ROW_H = 26;
        const INDENT_STEP = 24;
        const BASE_LEFT = 12;

        const renderPreview = (s) => {
            previewCanvas.innerHTML = '';
            previewCanvas.classList.toggle('ir-preview-disabled', !s.isEnabled);

            const colors = api.colorSchemes[s.currentScheme]?.colors || [];
            const barWidth = Math.max(0, s.currentWidth);
            const opacity = parseFloat(s.currentOpacity);

            // Draw 4 nested rows
            for (let i = 0; i < PREVIEW_ROWS; i++) {
                const marginLeft = i * INDENT_STEP + BASE_LEFT;
                const top = i * ROW_H + Math.floor((116 - PREVIEW_ROWS * ROW_H) / 2);
                const color = colors[i % colors.length] || '#888';

                const row = document.createElement('div');
                row.className = 'ir-preview-row';
                row.style.top = `${top}px`;

                // Vertical bar
                const bar = document.createElement('div');
                bar.className = 'ir-preview-bar';
                bar.style.left = `${marginLeft}px`;
                bar.style.width = `${barWidth}px`;
                bar.style.backgroundColor = color;
                bar.style.opacity = opacity;
                row.appendChild(bar);

                // Placeholder text line
                const txt = document.createElement('div');
                txt.className = 'ir-preview-text';
                txt.style.paddingLeft = `${marginLeft + barWidth + 10}px`;
                txt.textContent = i === 0 ? 'Top level item' : i === 1 ? '  Nested item' : i === 2 ? '    Deeper nesting' : '      Active item ←';
                row.appendChild(txt);

                previewCanvas.appendChild(row);
            }

            // Draw active threading arm(s) from row 0/1/2 down to row 3
            const activeWidth = Math.max(0, parseInt(s.activeWidth, 10));
            if (activeWidth > 0 && s.isThreadingEnabled !== false) {
                const deepIdx = PREVIEW_ROWS - 1;
                const deepTop = deepIdx * ROW_H + Math.floor((116 - PREVIEW_ROWS * ROW_H) / 2);
                const deepLeft = deepIdx * INDENT_STEP + BASE_LEFT;

                const startIdxes = s.threadingMode === 'staircase'
                    ? [0, 1, 2]   // arm from each ancestor
                    : [0];        // one long arm from the top

                for (const si of startIdxes) {
                    const srcTop = si * ROW_H + Math.floor((116 - PREVIEW_ROWS * ROW_H) / 2);
                    const srcLeft = si * INDENT_STEP + BASE_LEFT;
                    const srcColor = colors[si % colors.length] || '#888';

                    const armTargetTop = s.threadingMode === 'staircase' && si < PREVIEW_ROWS - 1
                        ? (si + 1) * ROW_H + Math.floor((116 - PREVIEW_ROWS * ROW_H) / 2) + ROW_H / 2
                        : deepTop + ROW_H / 2;

                    const armH = armTargetTop - srcTop;
                    const armW = (s.threadingMode === 'staircase'
                        ? (si + 1) * INDENT_STEP + BASE_LEFT
                        : deepLeft) - srcLeft + activeWidth;

                    if (armH <= 0 || armW <= 0) continue;

                    const arm = document.createElement('div');
                    arm.className = 'ir-preview-arm';
                    arm.style.top = `${srcTop}px`;
                    arm.style.left = `${srcLeft}px`;
                    arm.style.width = `${armW}px`;
                    arm.style.height = `${armH}px`;
                    arm.style.borderLeft = `${activeWidth}px solid ${srcColor}`;
                    arm.style.borderBottom = `${activeWidth}px solid ${srcColor}`;
                    arm.style.filter = `brightness(1.5) drop-shadow(0 0 3px ${srcColor})`;
                    arm.style.opacity = '1';
                    previewCanvas.appendChild(arm);
                }
            }
        };

        renderPreview(currentSettings);

        // -------------------------------------------------------
        // General Card
        // -------------------------------------------------------
        const genCard = document.createElement('div');
        genCard.className = 'ir-card';
        const genTitle = document.createElement('h3');
        genTitle.appendChild(api.createIcon('paint'));
        genTitle.appendChild(document.createTextNode(' Appearance'));
        genCard.appendChild(genTitle);
        const genCopy = document.createElement('p');
        genCopy.className = 'ir-card-copy';
        genCopy.textContent = 'Set the overall look of the guide rails shown throughout the editor.';
        genCard.appendChild(genCopy);

        const pluginEnCheckbox = document.createElement('input');
        pluginEnCheckbox.type = 'checkbox';
        pluginEnCheckbox.className = 'ir-checkbox';
        pluginEnCheckbox.checked = currentSettings.isEnabled !== false;
        pluginEnCheckbox.addEventListener('change', (e) => {
            currentSettings.isEnabled = e.target.checked;
            api.updateSettings({ isEnabled: e.target.checked });
            renderPreview(currentSettings);
        });
        genCard.appendChild(createField('Enable plugin', 'Master switch for indent guides and outline features.', pluginEnCheckbox));

        // Scheme Select
        const schemeSelect = document.createElement('select');
        schemeSelect.className = 'ir-input cursor-pointer';
        Object.keys(api.colorSchemes).forEach(key => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = api.colorSchemes[key].name;
            opt.selected = currentSettings.currentScheme === key;
            schemeSelect.appendChild(opt);
        });
        const schemeSwatches = document.createElement('div');
        schemeSwatches.className = 'ir-swatch-row';
        setSchemeSwatches(currentSettings.currentScheme, schemeSwatches);
        schemeSelect.addEventListener('change', (e) => {
            currentSettings.currentScheme = e.target.value;
            setSchemeSwatches(e.target.value, schemeSwatches);
            api.updateSettings({ currentScheme: e.target.value });
            renderPreview(currentSettings);
        });
        genCard.appendChild(createField('Color Scheme', 'Choose the palette used for nested indent levels.', schemeSelect, schemeSwatches));

        // Opacity Select
        const opacitySelect = document.createElement('select');
        opacitySelect.className = 'ir-input cursor-pointer';
        Object.keys(api.opacityPresets).forEach(key => {
            const opt = document.createElement('option');
            opt.value = api.opacityPresets[key].value;
            opt.textContent = api.opacityPresets[key].name;
            opt.selected = currentSettings.currentOpacity == api.opacityPresets[key].value;
            opacitySelect.appendChild(opt);
        });
        opacitySelect.addEventListener('change', (e) => {
            currentSettings.currentOpacity = parseFloat(e.target.value);
            api.updateSettings({ currentOpacity: e.target.value });
            renderPreview(currentSettings);
        });
        genCard.appendChild(createField('Opacity', 'Keep guides subtle or make them easier to pick out while scanning.', opacitySelect));

        // Line Width Slider
        const widthGroup = document.createElement('div');
        const widthRow = document.createElement('div');
        widthRow.className = 'ir-slider-meta';
        const widthVal = document.createElement('span');
        widthVal.className = 'ir-val-text';
        widthVal.textContent = formatWidthValue(currentSettings.currentWidth);
        const widthHint = document.createElement('span');
        widthHint.className = 'ir-subtitle';
        widthHint.textContent = 'Thickness of the standard guide line';
        widthRow.appendChild(widthHint);
        widthRow.appendChild(widthVal);
        widthGroup.appendChild(widthRow);
        const widthSlider = document.createElement('input');
        widthSlider.type = 'range';
        widthSlider.className = 'ir-range';
        widthSlider.min = '0';
        widthSlider.max = '4';
        widthSlider.step = '1';
        widthSlider.value = currentSettings.currentWidth;
        widthSlider.addEventListener('input', (e) => {
            currentSettings.currentWidth = parseInt(e.target.value, 10);
            widthVal.textContent = formatWidthValue(currentSettings.currentWidth);
            api.updateSettings({ currentWidth: e.target.value });
            renderPreview(currentSettings);
        });
        widthGroup.appendChild(widthSlider);
        genCard.appendChild(createField('Line Width', 'Adjust the default indent guide weight used across the page.', widthGroup, null, 'ir-slider-control'));

        container.appendChild(genCard);

        // Threading Card
        const threadCard = document.createElement('div');
        threadCard.className = 'ir-card';
        const threadTitle = document.createElement('h3');
        threadTitle.appendChild(api.createIcon('target'));
        threadTitle.appendChild(document.createTextNode(' Active Threading'));
        threadCard.appendChild(threadTitle);
        const threadCopy = document.createElement('p');
        threadCopy.className = 'ir-card-copy';
        threadCopy.textContent = 'Control how the currently focused path is emphasized while you navigate through nested content.';
        threadCard.appendChild(threadCopy);

        const threadEnCheckbox = document.createElement('input');
        threadEnCheckbox.type = 'checkbox';
        threadEnCheckbox.className = 'ir-checkbox';
        threadEnCheckbox.checked = currentSettings.isThreadingEnabled !== false;
        threadEnCheckbox.addEventListener('change', (e) => {
            currentSettings.isThreadingEnabled = e.target.checked;
            api.updateSettings({ isThreadingEnabled: e.target.checked });
            renderPreview(currentSettings);
        });
        threadCard.appendChild(createField('Active thread highlights', 'Draw emphasized connectors from ancestor guides to the line that contains the caret.', threadEnCheckbox));

        // Threading Style Select
        const threadStyleSelect = document.createElement('select');
        threadStyleSelect.className = 'ir-input cursor-pointer';
        const optStaircase = document.createElement('option');
        optStaircase.value = 'staircase';
        optStaircase.textContent = 'Staircase (Follows indentation path)';
        optStaircase.selected = currentSettings.threadingMode === 'staircase';
        threadStyleSelect.appendChild(optStaircase);
        const optStretched = document.createElement('option');
        optStretched.value = 'stretched';
        optStretched.textContent = 'Stretched (Direct line from parent)';
        optStretched.selected = currentSettings.threadingMode === 'stretched';
        threadStyleSelect.appendChild(optStretched);
        threadStyleSelect.addEventListener('change', (e) => {
            currentSettings.threadingMode = e.target.value;
            api.updateSettings({ threadingMode: e.target.value });
            renderPreview(currentSettings);
        });
        threadCard.appendChild(createField('Threading Style', 'Choose whether the active path steps through each level or stretches directly to the current line.', threadStyleSelect));

        // Active Thread Width Slider
        const aWidthGroup = document.createElement('div');
        const aWidthRow = document.createElement('div');
        aWidthRow.className = 'ir-slider-meta';
        const aWidthVal = document.createElement('span');
        aWidthVal.className = 'ir-val-text';
        aWidthVal.textContent = formatWidthValue(currentSettings.activeWidth);
        const aWidthHint = document.createElement('span');
        aWidthHint.className = 'ir-subtitle';
        aWidthHint.textContent = 'Thickness of the focused thread highlight';
        aWidthRow.appendChild(aWidthHint);
        aWidthRow.appendChild(aWidthVal);
        aWidthGroup.appendChild(aWidthRow);
        const aWidthSlider = document.createElement('input');
        aWidthSlider.type = 'range';
        aWidthSlider.className = 'ir-range';
        aWidthSlider.min = '0';
        aWidthSlider.max = '4';
        aWidthSlider.step = '1';
        aWidthSlider.value = currentSettings.activeWidth;
        aWidthSlider.addEventListener('input', (e) => {
            currentSettings.activeWidth = parseInt(e.target.value, 10);
            aWidthVal.textContent = formatWidthValue(currentSettings.activeWidth);
            api.updateSettings({ activeWidth: e.target.value });
            renderPreview(currentSettings);
        });
        aWidthGroup.appendChild(aWidthSlider);
        threadCard.appendChild(createField('Active Thread Width', 'Set how strongly the currently focused hierarchy path stands out.', aWidthGroup, null, 'ir-slider-control'));

        container.appendChild(threadCard);

        const outlineCard = document.createElement('div');
        outlineCard.className = 'ir-card';
        const outlineTitle = document.createElement('h3');
        outlineTitle.appendChild(api.createIcon('layout-list'));
        outlineTitle.appendChild(document.createTextNode(' Outline & zoom'));
        outlineCard.appendChild(outlineTitle);
        const outlineCopy = document.createElement('p');
        outlineCopy.className = 'ir-card-copy';
        outlineCopy.textContent = 'Workflowy-style bullets (click to zoom into a subtree), disclosure carets, and automatic reparenting of new lines while zoomed.';
        outlineCard.appendChild(outlineCopy);

        const bulletsCheckbox = document.createElement('input');
        bulletsCheckbox.type = 'checkbox';
        bulletsCheckbox.className = 'ir-checkbox';
        bulletsCheckbox.checked = currentSettings.isBulletsEnabled !== false;
        bulletsCheckbox.addEventListener('change', (e) => {
            currentSettings.isBulletsEnabled = e.target.checked;
            api.updateSettings({ isBulletsEnabled: e.target.checked });
        });
        outlineCard.appendChild(createField('Bullets', 'Show a clickable bullet before each line; click to zoom that item as the outline root.', bulletsCheckbox));

        const togglesCheckbox = document.createElement('input');
        togglesCheckbox.type = 'checkbox';
        togglesCheckbox.className = 'ir-checkbox';
        togglesCheckbox.checked = currentSettings.isTogglesEnabled !== false;
        togglesCheckbox.addEventListener('change', (e) => {
            currentSettings.isTogglesEnabled = e.target.checked;
            if (!e.target.checked) {
                document.querySelectorAll('.listitem.bt-collapsed').forEach(el => {
                    el.classList.remove('bt-collapsed');
                });
                document.querySelectorAll('.listitem[style*="display: none"]').forEach(el => {
                    el.style.display = '';
                });
            }
            api.updateSettings({ isTogglesEnabled: e.target.checked });
        });
        outlineCard.appendChild(createField('Disclosure carets', 'Collapse or expand nested rows from the caret zone to the left of the bullet.', togglesCheckbox));

        container.appendChild(outlineCard);
        element.appendChild(container);
    }
}
