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
 */

class Plugin extends AppPlugin {
    onLoad() {
        this.isUnloaded = false;
        
        // Keep track of resources to clean up later
        this.cleanupMethods = [];
        this.styleElement = null;

        // Storage keys for persisting settings
        const STORAGE_KEY = 'indent-rainbow-scheme';
        const WIDTH_KEY = 'indent-rainbow-width';
        const ACTIVE_WIDTH_KEY = 'indent-rainbow-active-width';
        const OPACITY_KEY = 'indent-rainbow-opacity';
        const ENABLED_KEY = 'indent-rainbow-enabled';
        const THREADING_MODE_KEY = 'indent-rainbow-threading-mode';

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
                    '#ffd700',  // Gold
                    '#ffc107',  // Amber
                    '#ffa000',  // Dark Amber
                    '#ff8f00',  // Light Amber
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
        let threadingMode = localStorage.getItem(THREADING_MODE_KEY) || 'staircase'; // 'staircase' or 'stretched'

        // Opacity presets
        const opacityPresets = {
            subtle: { name: 'Subtle', value: 0.2 },
            normal: { name: 'Normal', value: 0.3 },
            bold: { name: 'Bold', value: 0.45 }
        };

        // Generate CSS for a given color scheme
        const generateCSS = (schemeName) => {
            const scheme = colorSchemes[schemeName];
            const colors = scheme.colors;

            // Base styles with dynamic width and opacity
            let css = `
/* Thymer Indent Rainbow - ${scheme.name} Theme */

/* CSS Variables for theming */
:root {
    --bt-line-width: ${currentWidth}px;
    --bt-line-opacity: ${currentOpacity};
    --bt-line-opacity-hover: ${Math.min(currentOpacity + 0.5, 0.9)};
    --bt-transition-duration: 0.15s;
}

/* CRITICAL: Provide fallback values for Thymer's inline calc() expressions.
   Without these, height calculations like "calc(127px - var(--line-height))" resolve to 0.
   These are scoped to indent lines only to avoid affecting other Thymer elements. */
.listitem-indentline {
    --line-height: 26px;
    --checkbox-size: 23.5px;
    --bullet-size: 10px;
}

/* Base styling for indent lines - lighter by default */
.listitem-indentline {
    transition: opacity var(--bt-transition-duration) ease,
                filter var(--bt-transition-duration) ease,
                background-color var(--bt-transition-duration) ease,
                border-color var(--bt-transition-duration) ease !important;
    opacity: var(--bt-line-opacity) !important;
    min-width: var(--bt-line-width) !important;
    width: var(--bt-line-width) !important;
}

/* Ensure task and bullet indent lines have minimum height as safety net */
.listitem-task .listitem-indentline,
.listitem-ulist .listitem-indentline,
.listitem-olist .listitem-indentline {
    min-height: 20px !important;
}

/* Nudge bullet indent line right so it sits under the bullet dot center */
.listitem-ulist .listitem-indentline {
    transform: translateX(calc(var(--bullet-size) / 2)) !important;
}

/* Ensure indent lines are visible for all item types */
.listitem-text .listitem-indentline,
.listitem-task .listitem-indentline,
.listitem-ulist .listitem-indentline,
.listitem-olist .listitem-indentline {
    display: block !important;
    visibility: visible !important;
}

/* Highlight on hover - make the line darker/brighter */
.listitem:hover > .line-div > .listitem-indentline,
.listitem:hover > .line-check-div ~ .line-div > .listitem-indentline,
.listitem:hover > .line-bullet-div ~ .line-div > .listitem-indentline,
.listitem:hover > .line-number-div ~ .line-div > .listitem-indentline {
    opacity: var(--bt-line-opacity-hover) !important;
    filter: brightness(1.2) !important;
}

/* Highlight on focus (cursor position) - strongest emphasis */
.bt-focused > .line-div > .listitem-indentline,
.bt-focused > .line-check-div ~ .line-div > .listitem-indentline,
.bt-focused > .line-bullet-div ~ .line-div > .listitem-indentline,
.bt-focused > .line-number-div ~ .line-div > .listitem-indentline {
    opacity: 1 !important;
    filter: brightness(1.3) drop-shadow(0 0 2px currentColor) !important;
}

/* Color levels based on margin-left (30px increments) */
`;

            // Generate color rules for each indentation level
            // Level 0 is at margin-left: 0px, Level 1 at 30px, etc.
            for (let level = 0; level < 12; level++) {
                const marginLeft = level * 30;
                const colorIndex = level % colors.length;
                const color = colors[colorIndex];

                css += `
/* Level ${level + 1} (margin-left: ${marginLeft}px) */

/* Plain text and bullet items - margin on line-div */
.line-div[style*="margin-left: ${marginLeft}px"] > .listitem-indentline,
.line-div[style*="margin-left:${marginLeft}px"] > .listitem-indentline {
    background-color: ${color} !important;
    border-color: ${color} !important;
}

/* Task items - margin is on line-check-div, color the sibling line-div's indent line */
.line-check-div[style*="margin-left: ${marginLeft}px"] ~ .line-div > .listitem-indentline,
.line-check-div[style*="margin-left:${marginLeft}px"] ~ .line-div > .listitem-indentline,
.line-bullet-div[style*="margin-left: ${marginLeft}px"] ~ .line-div > .listitem-indentline,
.line-bullet-div[style*="margin-left:${marginLeft}px"] ~ .line-div > .listitem-indentline,
.line-number-div[style*="margin-left: ${marginLeft}px"] ~ .line-div > .listitem-indentline,
.line-number-div[style*="margin-left:${marginLeft}px"] ~ .line-div > .listitem-indentline {
    background-color: ${color} !important;
    border-color: ${color} !important;
}

/* Fallback for .listitem with margin-left */
.listitem[style*="margin-left: ${marginLeft}px"] .listitem-indentline,
.listitem[style*="margin-left:${marginLeft}px"] .listitem-indentline {
    background-color: ${color} !important;
    border-color: ${color} !important;
}
`;
            }

            // Additional hover effects for enhanced threading visibility
            css += `
/* Enhanced hover states - brighten the threading path */
.listitem:hover .line-div .listitem-indentline {
    filter: brightness(1.1);
}

/* Dark mode adjustments */
@media (prefers-color-scheme: dark) {
    :root {
        --bt-line-opacity: 0.35;
    }
    
    .listitem-indentline {
        filter: brightness(1.1);
    }
}

/* Support for Thymer's dark theme via class */
.dark .listitem-indentline,
[data-theme="dark"] .listitem-indentline {
    filter: brightness(1.1);
    --bt-line-opacity: 0.35;
}

/* Smooth animation when expanding/collapsing */
.listitem-indentline {
    transform-origin: top;
}
`;

            return css;
        };

        // Inject, update, or remove CSS
        const applySettings = () => {
            if (!isEnabled) {
                // Remove styles when disabled
                if (styleElement) {
                    styleElement.textContent = '';
                }
                return;
            }

            localStorage.setItem(STORAGE_KEY, currentScheme);
            localStorage.setItem(WIDTH_KEY, currentWidth);
            localStorage.setItem(ACTIVE_WIDTH_KEY, activeWidth);
            localStorage.setItem(OPACITY_KEY, currentOpacity);
            localStorage.setItem(ENABLED_KEY, isEnabled);
            localStorage.setItem(THREADING_MODE_KEY, threadingMode);

            const css = generateCSS(currentScheme);

            if (this.styleElement) {
                this.styleElement.textContent = css;
            } else {
                this.styleElement = this.ui.injectCSS(css);
            }
        };

        // Legacy wrapper for theme switching
        const applyColorScheme = (schemeName) => {
            currentScheme = schemeName;
            applySettings();
        };

        // Initial CSS injection
        applySettings();

        // =====================================================
        // Focus Tracking (Virtual Input Position Tracking)
        // =====================================================
        // Thymer uses a virtual input system where the browser's Selection API
        // always points to #editor-meta, not the actual list items.
        // We track focus by watching the virtualinput-wrapper's transform
        // position and using elementFromPoint to find the focused line.

        let currentFocusedItem = null;
        let rafPending = false;
        let virtualInputWrapper = null;
        let lastTransform = '';  // Cache to skip redundant updates
        let activeHighlights = []; // Cache highlight elements for faster cleanup

        // O(1) lookup for navigation keys
        const NAV_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Backspace', 'Tab']);

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

        const updateFocusedItem = () => {
            if (this.isUnloaded) return;
            rafPending = false;

            // Find the virtual input wrapper if not cached
            if (!virtualInputWrapper) {
                virtualInputWrapper = document.getElementById('virtualinput-wrapper');
            }

            if (!virtualInputWrapper) {
                return;
            }

            // Parse the transform to get cursor position
            const style = virtualInputWrapper.style.transform;

            // Skip if transform hasn't changed (cursor didn't move)
            if (style === lastTransform) {
                return;
            }
            lastTransform = style;

            const match = style.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
            if (!match) {
                cleanHighlights();
                return;
            }

            const x = parseFloat(match[1]);
            const y = parseFloat(match[2]);

            // Use elementFromPoint to find what's at the cursor position
            // Add a small offset to ensure we hit the line content area
            const element = document.elementFromPoint(x + 50, y + 10);

            // Walk up to find parent .listitem
            let node = null;
            if (element) {
                node = element;
                while (node && !node.classList?.contains('listitem')) {
                    node = node.parentElement;
                }
            }

            // --- READ PHASE --- (Avoid layout thrashing)
            const highlightData = [];
            
            if (node && document.body.contains(node) && node.offsetParent !== null) {
                const parents = getParents(node);
                
                if (parents.length > 0) {
                    const targetLineDiv = node.querySelector('.line-div') || node;
                    const targetRect = targetLineDiv.getBoundingClientRect();
                    
                    if (targetRect.height > 0) {
                        for (let index = 0; index < parents.length; index++) {
                            const p = parents[index];
                            const targetPointNode = threadingMode === 'staircase'
                                ? (index === 0 ? node : parents[index - 1])
                                : node;

                            const tLineDiv = targetPointNode.querySelector('.line-div') || targetPointNode;
                            const tRect = tLineDiv.getBoundingClientRect();
                            if (tRect.height === 0) continue;

                            const tY = tRect.top + (tRect.height / 2);

                            const pIndent = p.querySelector('.listitem-indentline');
                            const pLine = pIndent ? pIndent.parentElement : null;

                            if (pLine && pIndent && pIndent.parentElement) {
                                const pRect = pIndent.getBoundingClientRect();
                                const pContainerRect = pIndent.parentElement.getBoundingClientRect();

                                const h = tY - pRect.top;

                                // Find the left edge of the first child of the target node
                                // that carries a margin-left (the prefix: number/bullet/checkbox).
                                // That is the natural endpoint for the horizontal arm.
                                // Fall back to .line-div left if no such child exists.
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
            // Update focus class
            if (node !== currentFocusedItem) {
                if (currentFocusedItem) {
                    currentFocusedItem.classList.remove('bt-focused');
                }
                if (node) {
                    node.classList.add('bt-focused');
                }
                currentFocusedItem = node;
            }

            // Write Phase: Recycle elements to improve performance
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

                highlight.style.cssText = `
                    position: absolute;
                    top: ${data.top}px;
                    left: ${data.left}px;
                    width: ${data.width}px;
                    height: ${data.height}px;
                    border-left: ${activeWidth}px solid ${data.color};
                    border-bottom: ${activeWidth}px solid ${data.color};
                    border-bottom-left-radius: 6px;
                    box-sizing: border-box;
                    background-color: transparent;
                    z-index: 10;
                    pointer-events: none;
                    opacity: 1;
                    will-change: opacity, filter;
                    filter: brightness(1.5) drop-shadow(0 0 3px ${data.color});
                `;
            }

            // Remove any excess highlights that are no longer needed
            while (activeHighlights.length > highlightData.length) {
                const h = activeHighlights.pop();
                if (h.parentElement) h.parentElement.removeChild(h);
            }
        };

        const scheduleUpdate = () => {
            // Debounce with RAF to batch with browser paint cycle
            if (!rafPending) {
                rafPending = true;
                requestAnimationFrame(updateFocusedItem);
            }
        };

        // Watch for changes to the virtual input wrapper's style (transform)
        const setupObserver = () => {
            if (this.isUnloaded) return;
            
            virtualInputWrapper = document.getElementById('virtualinput-wrapper');

            if (!virtualInputWrapper) {
                // Retry until the wrapper exists
                this.observerTimeout = setTimeout(setupObserver, 100);
                return;
            }

            // Observe style attribute changes on the virtual input wrapper
            const observer = new MutationObserver((mutations) => {
                // Check if any mutation actually changed the transform
                for (const mutation of mutations) {
                    if (mutation.attributeName === 'style') {
                        const newTransform = virtualInputWrapper.style.transform;
                        if (newTransform !== lastTransform) {
                            scheduleUpdate();
                            break;
                        }
                    }
                }
            });

            observer.observe(virtualInputWrapper, {
                attributes: true,
                attributeFilter: ['style']
            });

            this.cleanupMethods.push(() => observer.disconnect());

            // Initial update
            scheduleUpdate();
        };

        // Start observing
        setupObserver();

        // =====================================================
        // JS-driven coloring for ulist / olist items
        // =====================================================
        // CSS selectors can't color these because the element that
        // carries margin-left varies between Thymer versions/builds.
        // Instead, we scan all direct children for any margin-left
        // and apply the matching rainbow color directly.

        const getListItemColor = (item, colors) => {
            let marginLeft = 0;
            for (let i = 0; i < item.children.length; i++) {
                const child = item.children[i];
                if (child.style && child.style.marginLeft) {
                    marginLeft = parseInt(child.style.marginLeft) || 0;
                    break;
                }
            }
            if (marginLeft === 0 && item.style && item.style.marginLeft) {
                marginLeft = parseInt(item.style.marginLeft) || 0;
            }
            if (marginLeft <= 0) return null;
            const level = Math.floor(marginLeft / 30);
            return colors[level % colors.length];
        };

        const applyListColors = () => {
            if (!isEnabled) return;
            const colors = colorSchemes[currentScheme].colors;
            const items = document.querySelectorAll('.listitem');
            for (const item of items) {
                const indentLine = item.querySelector('.listitem-indentline');
                if (!indentLine) continue;

                // Hide indent line if the content area has no text, ignoring the indent line itself
                const lineDiv = item.querySelector('.line-div');
                const contentText = lineDiv
                    ? Array.from(lineDiv.childNodes)
                        .filter(n => !(n.nodeType === 1 && (n.classList?.contains('listitem-indentline') || n.classList?.contains('bt-active-highlight'))))
                        .map(n => n.textContent || '')
                        .join('')
                        .trim()
                    : (item.textContent || '').trim();

                // Treat as empty if no text content
                if (contentText.length === 0) {
                    indentLine.style.setProperty('display', 'none', 'important');
                    indentLine.dataset.btEmpty = '1';
                } else if (indentLine.dataset.btEmpty) {
                    indentLine.style.removeProperty('display');
                    delete indentLine.dataset.btEmpty;
                }

                // JS-driven coloring is only needed for lists/tasks where margin is on the prefix
                if (item.classList.contains('listitem-ulist') || item.classList.contains('listitem-olist') || item.classList.contains('listitem-task')) {
                    let marginLeft = 0;
                    for (let i = 0; i < item.children.length; i++) {
                        const child = item.children[i];
                        if (child.style && child.style.marginLeft) {
                            const ml = parseInt(child.style.marginLeft) || 0;
                            if (ml > 0) { marginLeft = ml; break; }
                        }
                    }
                    if (marginLeft === 0 && item.style && item.style.marginLeft) {
                        marginLeft = parseInt(item.style.marginLeft) || 0;
                    }

                    // Always color, including level 0, so top-level bullets/tasks get a line
                    const level = Math.max(0, Math.floor(marginLeft / 30));
                    const color = colors[level % colors.length];
                    indentLine.style.setProperty('background-color', color, 'important');
                    indentLine.style.setProperty('border-color', color, 'important');
                    indentLine.dataset.btManaged = '1';
                }
            }
        };

        const clearListColors = () => {
            const lines = document.querySelectorAll('.listitem-indentline[data-bt-managed], .listitem-indentline[data-bt-empty]');
            for (const line of lines) {
                line.style.removeProperty('background-color');
                line.style.removeProperty('border-color');
                line.style.removeProperty('display');
                delete line.dataset.btManaged;
                delete line.dataset.btEmpty;
            }
        };

        // One-shot diagnostic: logs the class names of children of the first
        // bullet/numbered item so we can see the actual Thymer DOM structure.
        let diagnosticDone = false;
        const runDiagnostic = () => {
            if (diagnosticDone) return;
            const ulist = document.querySelector('.listitem-ulist');
            const olist = document.querySelector('.listitem-olist');
            if (ulist || olist) {
                diagnosticDone = true;
                [['ulist', ulist], ['olist', olist]].forEach(([type, item]) => {
                    if (!item) return;
                    const children = Array.from(item.children).map(c =>
                        `<${c.tagName.toLowerCase()} class="${c.className}" margin="${c.style.marginLeft || ''}">`);
                    console.log(`[IndentRainbow] ${type} DOM children: ${children.join(' | ')}`);
                    console.log(`[IndentRainbow] ${type} outerHTML (first 600): ${item.outerHTML.substring(0, 600)}`);
                });
            }
        };

        let listColorRafPending = false;
        const scheduleListColorUpdate = () => {
            if (!listColorRafPending) {
                listColorRafPending = true;
                requestAnimationFrame(() => {
                    listColorRafPending = false;
                    applyListColors();
                    runDiagnostic();
                });
            }
        };

        const listColorObserver = new MutationObserver(scheduleListColorUpdate);
        listColorObserver.observe(document.body, { childList: true, subtree: true });
        this.cleanupMethods.push(() => {
            listColorObserver.disconnect();
            clearListColors();
        });

        // Apply once immediately (handles items already in DOM)
        setTimeout(scheduleListColorUpdate, 500);

        // Also listen for keyboard events as backup (O(1) Set lookup)
        const keyHandler = (e) => {
            if (NAV_KEYS.has(e.key)) {
                scheduleUpdate();
            }
        };
        document.addEventListener('keyup', keyHandler);
        this.cleanupMethods.push(() => document.removeEventListener('keyup', keyHandler));

        // Listen for clicks in editor area only, fallback to document
        const clickHandler = () => scheduleUpdate();
        const editorContainer = document.querySelector('.editor-wrapper, .page-content, #editor');
        if (editorContainer) {
            editorContainer.addEventListener('click', clickHandler);
            this.cleanupMethods.push(() => editorContainer.removeEventListener('click', clickHandler));
        } else {
            document.addEventListener('click', clickHandler);
            this.cleanupMethods.push(() => document.removeEventListener('click', clickHandler));
        }

        // Shared update function – applies settings and keeps the status bar tooltip in sync
        let statusBarItem = null;
        
        // Ensure closed-over DOM references are released on unload
        this.cleanupMethods.push(() => {
            virtualInputWrapper = null;
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
            if (newSettings.threadingMode !== undefined) threadingMode = newSettings.threadingMode;
            applySettings();
            if (isEnabled) {
                scheduleListColorUpdate();
            } else {
                clearListColors();
            }
            if (statusBarItem && typeof statusBarItem.setTooltip === 'function') {
                statusBarItem.setTooltip(`Indent Rainbow – ${colorSchemes[currentScheme]?.name ?? currentScheme}`);
            }
        };

        // Register the panel type
        this.ui.registerCustomPanelType("indent-rainbow-settings", (panel) => {
            this.renderSettingsUI(panel, {
                colorSchemes, opacityPresets,
                getSettings: () => ({ currentScheme, currentWidth, activeWidth, currentOpacity, isEnabled, threadingMode }),
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

    }

    onUnload() {
        this.isUnloaded = true;
        if (this.observerTimeout) clearTimeout(this.observerTimeout);

        // Remove globally bound event listeners and unobserve mutation observers
        if (this.cleanupMethods) {
            this.cleanupMethods.forEach(cleanupFn => {
                try {
                    cleanupFn();
                } catch (e) {
                    console.warn('Failed to clean up plugin resource:', e);
                }
            });
            this.cleanupMethods = [];
        }

        // Clean up focus markers and highlights
        const highlights = document.querySelectorAll('.bt-active-highlight');
        highlights.forEach(el => el.remove());

        const focusedElements = document.querySelectorAll('.bt-focused');
        focusedElements.forEach(el => el.classList.remove('bt-focused'));

        // Delete style element
        if (this.styleElement) {
            this.styleElement.remove();
            this.styleElement = null;
        } else {
            const fallbackStyleElement = document.querySelector('style[data-source="thymer-indent-rainbow"]');
            if (fallbackStyleElement) {
                fallbackStyleElement.remove();
            }
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
                
                padding: 32px; 
                max-width: 650px; 
                margin: 0 auto; 
                font-family: var(--font-m, var(--font-primary, inherit)); 
                color: var(--ir-text);
                line-height: 1.5;
            }
            .ir-header { 
                margin-bottom: 32px; 
                border-bottom: 1px solid var(--ir-border); 
                padding-bottom: 16px; 
            }
            .ir-title { 
                margin: 0; 
                display: flex; 
                align-items: center; 
                gap: 12px; 
                font-size: 1.75em; 
                font-weight: 700; 
                color: var(--ir-accent); 
            }
            .ir-card { 
                padding: 24px; 
                border-radius: 12px; 
                border: 1px solid var(--ir-border); 
                background: var(--ir-bg); 
                margin-bottom: 24px; 
                box-shadow: var(--color-shadow-cards, 0 4px 6px rgba(0,0,0,0.1)); 
            }
            .ir-card h3 { 
                margin-top: 0; 
                margin-bottom: 20px; 
                display: flex; 
                align-items: center; 
                gap: 10px; 
                font-size: 1.2em; 
                font-weight: 600; 
                color: var(--ir-text); 
            }
            .ir-row { 
                display: flex; 
                align-items: center; 
                gap: 16px;
                justify-content: space-between; 
                margin-bottom: 20px; 
            }
            .ir-row:last-child { margin-bottom: 0; }
            .ir-label-group { display: flex; flex-direction: column; gap: 6px; flex: 1; }
            .ir-label-group strong { font-weight: 600; color: var(--ir-text); }
            .ir-subtitle { font-size: 0.9em; color: var(--ir-text-secondary); opacity: 0.8; }
            .ir-input { 
                width: 100%; 
                padding: 10px 14px; 
                border-radius: 8px; 
                border: 1px solid var(--ir-border); 
                background: var(--ir-input-bg); 
                color: var(--ir-text); 
                font-family: inherit; 
                font-size: 0.95em;
                transition: border-color 0.2s, box-shadow 0.2s; 
                cursor: pointer;
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
                margin-top: 12px; 
                height: 6px;
                border-radius: 3px;
                background: var(--ir-border) !important;
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
                padding: 2px 10px;
                border-radius: 6px;
                font-size: 0.9em;
                min-width: 45px;
                text-align: center;
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
        container.appendChild(header);

        // General Card
        const genCard = document.createElement('div');
        genCard.className = 'ir-card';

        // Scheme Select
        const schemeGroup = document.createElement('div');
        schemeGroup.style.marginBottom = '16px';
        const schemeLabel = document.createElement('div');
        schemeLabel.className = 'ir-label-group';
        schemeLabel.style.marginBottom = '8px';
        const schemeStrong = document.createElement('strong');
        schemeStrong.textContent = 'Color Scheme';
        schemeLabel.appendChild(schemeStrong);
        schemeGroup.appendChild(schemeLabel);
        const schemeSelect = document.createElement('select');
        schemeSelect.className = 'ir-input cursor-pointer';
        Object.keys(api.colorSchemes).forEach(key => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = api.colorSchemes[key].name;
            opt.selected = settings.currentScheme === key;
            schemeSelect.appendChild(opt);
        });
        schemeSelect.addEventListener('change', (e) => api.updateSettings({ currentScheme: e.target.value }));
        schemeGroup.appendChild(schemeSelect);
        genCard.appendChild(schemeGroup);

        // Opacity Select
        const opacityGroup = document.createElement('div');
        opacityGroup.style.marginBottom = '16px';
        const opacityLabel = document.createElement('div');
        opacityLabel.className = 'ir-label-group';
        opacityLabel.style.marginBottom = '8px';
        const opacityStrong = document.createElement('strong');
        opacityStrong.textContent = 'Opacity';
        opacityLabel.appendChild(opacityStrong);
        opacityGroup.appendChild(opacityLabel);
        const opacitySelect = document.createElement('select');
        opacitySelect.className = 'ir-input cursor-pointer';
        Object.keys(api.opacityPresets).forEach(key => {
            const opt = document.createElement('option');
            opt.value = api.opacityPresets[key].value;
            opt.textContent = api.opacityPresets[key].name;
            opt.selected = settings.currentOpacity == api.opacityPresets[key].value;
            opacitySelect.appendChild(opt);
        });
        opacitySelect.addEventListener('change', (e) => api.updateSettings({ currentOpacity: e.target.value }));
        opacityGroup.appendChild(opacitySelect);
        genCard.appendChild(opacityGroup);

        // Line Width Slider
        const widthGroup = document.createElement('div');
        const widthRow = document.createElement('div');
        widthRow.className = 'ir-row';
        widthRow.style.marginBottom = '0';
        const widthStrong = document.createElement('strong');
        widthStrong.textContent = 'Line Width';
        widthRow.appendChild(widthStrong);
        const widthVal = document.createElement('span');
        widthVal.className = 'ir-val-text';
        widthVal.textContent = settings.currentWidth + 'px';
        widthRow.appendChild(widthVal);
        widthGroup.appendChild(widthRow);
        const widthSlider = document.createElement('input');
        widthSlider.type = 'range';
        widthSlider.className = 'ir-range';
        widthSlider.min = '0';
        widthSlider.max = '4';
        widthSlider.step = '1';
        widthSlider.value = settings.currentWidth;
        widthSlider.addEventListener('input', (e) => {
            widthVal.textContent = e.target.value + 'px';
            api.updateSettings({ currentWidth: e.target.value });
        });
        widthGroup.appendChild(widthSlider);
        genCard.appendChild(widthGroup);

        container.appendChild(genCard);

        // Threading Card
        const threadCard = document.createElement('div');
        threadCard.className = 'ir-card';
        const threadTitle = document.createElement('h3');
        threadTitle.appendChild(api.createIcon('target'));
        threadTitle.appendChild(document.createTextNode(' Active Threading'));
        threadCard.appendChild(threadTitle);

        // Threading Style Select
        const threadStyleGroup = document.createElement('div');
        threadStyleGroup.style.marginBottom = '16px';
        const threadStyleLabel = document.createElement('div');
        threadStyleLabel.className = 'ir-label-group';
        threadStyleLabel.style.marginBottom = '8px';
        const threadStyleStrong = document.createElement('strong');
        threadStyleStrong.textContent = 'Threading Style';
        threadStyleLabel.appendChild(threadStyleStrong);
        threadStyleGroup.appendChild(threadStyleLabel);
        const threadStyleSelect = document.createElement('select');
        threadStyleSelect.className = 'ir-input cursor-pointer';
        const optStaircase = document.createElement('option');
        optStaircase.value = 'staircase';
        optStaircase.textContent = 'Staircase (Follows indentation path)';
        optStaircase.selected = settings.threadingMode === 'staircase';
        threadStyleSelect.appendChild(optStaircase);
        const optStretched = document.createElement('option');
        optStretched.value = 'stretched';
        optStretched.textContent = 'Stretched (Direct line from parent)';
        optStretched.selected = settings.threadingMode === 'stretched';
        threadStyleSelect.appendChild(optStretched);
        threadStyleSelect.addEventListener('change', (e) => api.updateSettings({ threadingMode: e.target.value }));
        threadStyleGroup.appendChild(threadStyleSelect);
        threadCard.appendChild(threadStyleGroup);

        // Active Thread Width Slider
        const aWidthGroup = document.createElement('div');
        const aWidthRow = document.createElement('div');
        aWidthRow.className = 'ir-row';
        aWidthRow.style.marginBottom = '0';
        const aWidthStrong = document.createElement('strong');
        aWidthStrong.textContent = 'Active Thread Width';
        aWidthRow.appendChild(aWidthStrong);
        const aWidthVal = document.createElement('span');
        aWidthVal.className = 'ir-val-text';
        aWidthVal.textContent = settings.activeWidth + 'px';
        aWidthRow.appendChild(aWidthVal);
        aWidthGroup.appendChild(aWidthRow);
        const aWidthSlider = document.createElement('input');
        aWidthSlider.type = 'range';
        aWidthSlider.className = 'ir-range';
        aWidthSlider.min = '0';
        aWidthSlider.max = '4';
        aWidthSlider.step = '1';
        aWidthSlider.value = settings.activeWidth;
        aWidthSlider.addEventListener('input', (e) => {
            aWidthVal.textContent = e.target.value + 'px';
            api.updateSettings({ activeWidth: e.target.value });
        });
        aWidthGroup.appendChild(aWidthSlider);
        threadCard.appendChild(aWidthGroup);

        container.appendChild(threadCard);
        element.appendChild(container);
    }
}
