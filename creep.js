/*!
 * creep.js
 * Created by coRpSE, (2026)
 * Recreated for the classic "letters creep away when idle" effect.
 *
 * Install:
 *   <script src="creep.js"></script>
 * Place before </body>.
 *
 * This version DOES NOT alter normal page text layout.
 * It measures the rendered glyph positions, places temporary copies
 * over the text, makes the original glyphs transparent, and animates
 * only the copies.
 */
(function () {
    'use strict';

    const SETTINGS = {
        idleTime: 30000,                 // ms before creeping starts
        minLeaveDelay: 0,               // ms
        maxLeaveDelay: 10000,           // letters begin leaving gradually over ~10 seconds
        maxActiveLetters: 1500,            // Maximum number of letters visibly creeping away at the same time.
        maxLettersPerInterval: 30,          // Maximum number of letters that can start creeping during one interval.
        letterStartGapMin: 500,              // Shortest wait before the next batch of letters starts (milliseconds).
        letterStartGapMax: 1500,            // Longest wait before the next batch of letters starts (milliseconds).
        minTravelTime: 10000,           // ms
        maxTravelTime: 22000,           // ms
        returnTime: 550,                // ms
        edgePadding: 24,                // px beyond edge
        maxRotation: 127,                // degrees
        opacityAtEdge: 0,               // Final opacity of letters that reach the end of their movement.

        // Most letters vanish before reaching the edge.
        // 0.35 means roughly 35% of the distance toward the chosen edge.
        minTravelFraction: 0.35,        // Minimum distance a letter travels toward its chosen edge (0.35 = 35%).
        maxTravelFraction: 1.00,        // Maximum distance a letter travels toward its chosen edge (1.00 = 100%).
        fullEdgeChance: 0.18,           // Chance a letter travels all the way to the edge (0.18 = 18%).

        // Opacity finishes sooner than movement, so letters can disappear
        // while they are still well inside the viewport.
        minFadeFraction: 0.25,          // Earliest point during movement that a letter can fully fade away (45%).
        maxFadeFraction: 0.78,          // Latest point during movement that a letter can fully fade away (78%).

        // Image effect:
        imageEffectEnabled: true,       // Enable or disable the image flicker/disappear effect.
        imageStartDelayMin: 3000,       // Minimum wait before images start disappearing after the letter creep begins.
        imageStartDelayMax: 5000,       // Maximum wait before images start disappearing after the letter creep begins.
        imageStaggerMin: 1000,          // Minimum delay before the next image starts flickering.
        imageStaggerMax: 2000,          // Maximum delay before the next image starts flickering.
        imageFlickerMin: 6,             // Minimum number of times an image flickers before disappearing.
        imageFlickerMax: 10,             // Maximum number of times an image flickers before disappearing.
        imageFlickerStepMin: 50,        // Fastest time between individual flickers (milliseconds).
        imageFlickerStepMax: 200,       // Slowest time between individual flickers (milliseconds).
        imageFadeTimeMin: 200,          // Fastest final fade-out time after flickering (milliseconds).
        imageFadeTimeMax: 800,          // Slowest final fade-out time after flickering (milliseconds).

        // Image movement effect:
        imageMoveEnabled: true,         // Enable or disable images drifting away while they flicker.
        imageMoveDistanceMin: 180,      // Minimum distance an image can be carried away (pixels).
        imageMoveDistanceMax: 620,      // Maximum distance an image can be carried away (pixels).
        imageMoveTimeMin: 4500,         // Fastest image drifting movement (milliseconds).
        imageMoveTimeMax: 7000,         // Slowest image drifting movement (milliseconds).
        imageMoveRotationMax: 143,       // Maximum clockwise/counter-clockwise tilt while moving (degrees).

        //Ignore section.
        ignoreSelectors: [
            'script', 'style', 'noscript', 'template',
            'textarea', 'input', 'select', 'option',
            'button', 'code', 'pre',
            '[contenteditable="true"]',
            '[data-no-creep]', '#shout', '#shout-messages'
        ]
    };

    let idleTimer = null;
    let active = false;
    let restoring = false;
    let overlay = null;
    let records = [];
    let hiddenTextNodes = [];
    let imageRecords = [];
    let imageTimers = [];
    let imageSequenceTimer = null;

    // Letter queue state. This limits how many letters can be visibly
    // sneaking away at the same time.
    let letterQueue = [];
    let activeLetterCount = 0;
    let letterLaunchTimer = null;
    let letterTimers = [];

    const activityEvents = [
        'mousemove', 'mousedown', 'keydown', 'touchstart',
        'pointerdown', 'wheel', 'scroll'
    ];

    function rand(min, max) {
        return Math.random() * (max - min) + min;
    }

    function shouldIgnore(node) {
        const parent = node.parentElement;
        if (!parent) return true;

        if (SETTINGS.ignoreSelectors.some(sel => parent.closest(sel))) {
            return true;
        }

        const cs = getComputedStyle(parent);
        if (
            cs.display === 'none' ||
            cs.visibility === 'hidden' ||
            parseFloat(cs.opacity || '1') === 0
        ) {
            return true;
        }

        return !node.nodeValue || !/\S/.test(node.nodeValue);
    }

    function collectTextNodes() {
        const out = [];
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode(node) {
                    return shouldIgnore(node)
                        ? NodeFilter.FILTER_REJECT
                        : NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        let n;
        while ((n = walker.nextNode())) {
            out.push(n);
        }
        return out;
    }

    function makeOverlay() {
        overlay = document.createElement('div');
        overlay.id = 'creep-js-overlay';
        Object.assign(overlay.style, {
            position: 'fixed',
            inset: '0',
            width: '100vw',
            height: '100vh',
            overflow: 'visible',
            pointerEvents: 'none',
            zIndex: '2147483647',
            contain: 'layout style paint',
        });
        document.documentElement.appendChild(overlay);
    }

    function textNodeRects(node) {
        const text = node.nodeValue;
        const parent = node.parentElement;
        const style = getComputedStyle(parent);
        const chars = [];

        // Split text by visible Unicode characters (grapheme clusters) instead
        // of UTF-16 code units. This keeps emoji, skin-tone modifiers, flags,
        // ZWJ sequences, etc. together instead of turning them into � symbols.
        let segments;

        if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
            const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
            segments = Array.from(segmenter.segment(text), part => ({
                char: part.segment,
                start: part.index,
                end: part.index + part.segment.length
            }));
        } else {
            // Fallback: Array.from() at least keeps surrogate-pair emoji intact.
            segments = [];
            let offset = 0;

            for (const char of Array.from(text)) {
                segments.push({
                    char,
                    start: offset,
                    end: offset + char.length
                });
                offset += char.length;
            }
        }

        for (const segment of segments) {
            if (/^\s+$/u.test(segment.char)) continue;

            const range = document.createRange();
            range.setStart(node, segment.start);
            range.setEnd(node, segment.end);

            const rects = range.getClientRects();
            if (!rects.length) continue;

            const rect = rects[0];

            // Skip glyphs that are completely outside the viewport.
            if (
                rect.bottom < 0 ||
                rect.top > innerHeight ||
                rect.right < 0 ||
                rect.left > innerWidth
            ) {
                continue;
            }

            chars.push({
                char: segment.char,
                rect: {
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height
                },
                style
            });
        }

        return chars;
    }

    function createGlyph(rec) {
        const el = document.createElement('span');
        el.textContent = rec.char;

        const s = rec.style;
        Object.assign(el.style, {
            position: 'fixed',
            left: rec.rect.left + 'px',
            top: rec.rect.top + 'px',
            width: Math.max(rec.rect.width, 0.01) + 'px',
            height: rec.rect.height + 'px',
            margin: '0',
            padding: '0',
            border: '0',
            boxSizing: 'border-box',
            whiteSpace: 'pre',
            pointerEvents: 'none',
            userSelect: 'none',
            transform: 'translate3d(0,0,0) rotate(0deg)',
            transformOrigin: '50% 50%',
            opacity: s.opacity,
            color: s.color,
            fontFamily: s.fontFamily,
            fontSize: s.fontSize,
            fontStyle: s.fontStyle,
            fontWeight: s.fontWeight,
            fontStretch: s.fontStretch,
            fontVariant: s.fontVariant,
            fontKerning: s.fontKerning,
            fontFeatureSettings: s.fontFeatureSettings,
            fontVariationSettings: s.fontVariationSettings,
            letterSpacing: s.letterSpacing,
            textTransform: s.textTransform,
            textDecoration: s.textDecoration,
            textShadow: s.textShadow,
            lineHeight: s.lineHeight,
            writingMode: s.writingMode,
            WebkitTextStroke: s.webkitTextStroke || '',
            willChange: 'transform, opacity',
            transition: 'none'
        });

        overlay.appendChild(el);
        return el;
    }

    function chooseDestination(rect) {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const distances = [
            { edge: 'left',   d: cx },
            { edge: 'right',  d: innerWidth - cx },
            { edge: 'top',    d: cy },
            { edge: 'bottom', d: innerHeight - cy }
        ];

        // Prefer one of the nearer edges, but keep some randomness.
        distances.sort((a, b) => a.d - b.d);
        const choice = Math.random() < 0.72
            ? distances[Math.floor(Math.random() * Math.min(2, distances.length))]
            : distances[Math.floor(Math.random() * distances.length)];

        // Only a minority of letters travel all the way to/past the edge.
        // Most disappear somewhere between the center-ish area and the edge.
        const travelFraction = Math.random() < SETTINGS.fullEdgeChance
            ? 1
            : rand(SETTINGS.minTravelFraction, SETTINGS.maxTravelFraction);

        let x = 0;
        let y = 0;

        if (choice.edge === 'left') {
            const fullX = -(rect.right + SETTINGS.edgePadding + rand(20, 120));
            x = fullX * travelFraction;
            y = rand(-120, 120) * travelFraction;
        } else if (choice.edge === 'right') {
            const fullX = innerWidth - rect.left + SETTINGS.edgePadding + rand(20, 120);
            x = fullX * travelFraction;
            y = rand(-120, 120) * travelFraction;
        } else if (choice.edge === 'top') {
            x = rand(-120, 120) * travelFraction;
            const fullY = -(rect.bottom + SETTINGS.edgePadding + rand(20, 120));
            y = fullY * travelFraction;
        } else {
            x = rand(-120, 120) * travelFraction;
            const fullY = innerHeight - rect.top + SETTINGS.edgePadding + rand(20, 120);
            y = fullY * travelFraction;
        }

        return { x, y };
    }

    function hideOriginalText(nodes) {
        for (const node of nodes) {
            const parent = node.parentElement;
            if (!parent) continue;

            // Wrap only at creep-time, but do NOT change layout:
            // wrapper remains inline and inherits everything.
            const wrapper = document.createElement('span');
            wrapper.setAttribute('data-creep-original', '');
            wrapper.style.color = 'transparent';
            wrapper.style.textShadow = 'none';
            wrapper.style.webkitTextFillColor = 'transparent';

            node.parentNode.insertBefore(wrapper, node);
            wrapper.appendChild(node);

            hiddenTextNodes.push({
                wrapper,
                node,
                parent: wrapper.parentNode
            });
        }
    }

    function restoreOriginalText() {
        for (const item of hiddenTextNodes) {
            const { wrapper, node, parent } = item;
            if (wrapper && wrapper.parentNode && parent) {
                parent.insertBefore(node, wrapper);
                wrapper.remove();
            }
        }
        hiddenTextNodes = [];
    }


    function imageShouldIgnore(img) {
        if (!img || !img.isConnected) return true;

        if (SETTINGS.ignoreSelectors.some(sel => img.closest(sel))) {
            return true;
        }

        if (img.hasAttribute('data-no-creep-image')) {
            return true;
        }

        const cs = getComputedStyle(img);
        if (
            cs.display === 'none' ||
            cs.visibility === 'hidden' ||
            parseFloat(cs.opacity || '1') === 0
        ) {
            return true;
        }

        const rect = img.getBoundingClientRect();
        return rect.width <= 0 || rect.height <= 0;
    }

    function collectImages() {
        return Array.from(document.images).filter(img => !imageShouldIgnore(img));
    }

    function clearImageTimers() {
        if (imageSequenceTimer) {
            clearTimeout(imageSequenceTimer);
            imageSequenceTimer = null;
        }

        for (const timer of imageTimers) {
            clearTimeout(timer);
        }

        imageTimers = [];
    }


    function chooseImageMovement(img) {
        const rect = img.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        // Pick a general direction away from the center of the screen,
        // with enough randomness that the images do not all move alike.
        let dx = cx - (innerWidth / 2);
        let dy = cy - (innerHeight / 2);

        // If an image is almost exactly centered, give it a random direction.
        if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
            const angle = rand(0, Math.PI * 2);
            dx = Math.cos(angle);
            dy = Math.sin(angle);
        }

        const length = Math.hypot(dx, dy) || 1;
        dx /= length;
        dy /= length;

        // Add a little sideways wandering so it feels carried rather than
        // mechanically sliding in a perfectly straight line.
        const wander = rand(-0.45, 0.45);
        const sideX = -dy * wander;
        const sideY = dx * wander;

        const distance = rand(
            SETTINGS.imageMoveDistanceMin,
            SETTINGS.imageMoveDistanceMax
        );

        return {
            x: (dx + sideX) * distance,
            y: (dy + sideY) * distance,
            rotation: rand(
                -SETTINGS.imageMoveRotationMax,
                SETTINGS.imageMoveRotationMax
            ),
            duration: Math.round(
                rand(
                    SETTINGS.imageMoveTimeMin,
                    SETTINGS.imageMoveTimeMax
                )
            )
        };
    }

    function startImageMovement(rec) {
        const img = rec.img;

        if (
            !SETTINGS.imageMoveEnabled ||
            !img ||
            !img.isConnected ||
            !active ||
            restoring
        ) {
            return;
        }

        const rect = img.getBoundingClientRect();
        const move = chooseImageMovement(img);
        rec.move = move;

        // Create an unrestricted visual copy in the full-screen overlay so the
        // image can escape parent containers that use overflow:hidden/clip.
        const clone = img.cloneNode(true);
        clone.removeAttribute('id');

        Object.assign(clone.style, {
            position: 'fixed',
            left: rect.left + 'px',
            top: rect.top + 'px',
            width: rect.width + 'px',
            height: rect.height + 'px',
            margin: '0',
            padding: '0',
            border: '0',
            boxSizing: 'border-box',
            maxWidth: 'none',
            maxHeight: 'none',
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: '999999',
            opacity: rec.computedOpacity,
            transform: 'translate3d(0,0,0) rotate(0deg)',
            transformOrigin: '50% 50%',
            willChange: 'transform, opacity',
            transition: 'none'
        });

        overlay.appendChild(clone);
        rec.clone = clone;

        // Hide the real image but keep it in the document so layout never shifts.
        img.style.opacity = '0';

        // Force the starting position to be committed before animation begins.
        void clone.offsetWidth;

        clone.style.transition =
            `transform ${move.duration}ms cubic-bezier(.18,.55,.35,1), ` +
            `opacity 120ms linear`;

        clone.style.transform =
            `translate3d(${move.x}px, ${move.y}px, 0) ` +
            `rotate(${move.rotation}deg)`;
    }

    function flickerImage(rec) {
        const img = rec.img;
        if (!img || !img.isConnected || !active || restoring) return;

        const flickers = Math.floor(
            rand(SETTINGS.imageFlickerMin, SETTINGS.imageFlickerMax + 1)
        );

        // Start carrying the image away at the same time it begins flickering.
        startImageMovement(rec);

        const target = rec.clone || img;
        let step = 0;

        function nextFlicker() {
            if (!active || restoring || !img.isConnected || !target.isConnected) return;

            if (step >= flickers * 2) {
                const fadeTime = Math.round(
                    rand(SETTINGS.imageFadeTimeMin, SETTINGS.imageFadeTimeMax)
                );

                const moveDuration = rec.move ? rec.move.duration : 0;

                target.style.transition =
                    `${SETTINGS.imageMoveEnabled ? `transform ${Math.max(moveDuration, fadeTime)}ms cubic-bezier(.18,.55,.35,1), ` : ''}` +
                    `opacity ${fadeTime}ms ease`;

                target.style.opacity = '0';
                return;
            }

            const dim = step % 2 === 0;

            // Flicker the overlay copy, not the original image.
            target.style.opacity = dim
                ? String(rand(0.08, 0.4))
                : rec.computedOpacity;

            step++;

            const timer = setTimeout(
                nextFlicker,
                Math.round(
                    rand(
                        SETTINGS.imageFlickerStepMin,
                        SETTINGS.imageFlickerStepMax
                    )
                )
            );

            imageTimers.push(timer);
        }

        nextFlicker();
    }

    function startImageSequence() {
        if (!SETTINGS.imageEffectEnabled || !active || restoring) return;

        const images = collectImages();
        if (!images.length) return;

        // Shuffle images so they disappear in an unpredictable order.
        for (let i = images.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [images[i], images[j]] = [images[j], images[i]];
        }

        imageRecords = images.map(img => ({
            img,
            inlineOpacity: img.style.opacity,
            inlineTransition: img.style.transition,
            inlineTransform: img.style.transform,
            inlineFilter: img.style.filter,
            inlineVisibility: img.style.visibility,
            computedOpacity: getComputedStyle(img).opacity || '1',
            move: null,
            clone: null
        }));

        let index = 0;

        function doNextImage() {
            if (!active || restoring || index >= imageRecords.length) return;

            flickerImage(imageRecords[index++]);

            if (index < imageRecords.length) {
                imageSequenceTimer = setTimeout(
                    doNextImage,
                    Math.round(
                        rand(
                            SETTINGS.imageStaggerMin,
                            SETTINGS.imageStaggerMax
                        )
                    )
                );
            }
        }

        doNextImage();
    }

    function scheduleImageSequence() {
        if (!SETTINGS.imageEffectEnabled) return;

        const delay = Math.round(
            rand(
                SETTINGS.imageStartDelayMin,
                SETTINGS.imageStartDelayMax
            )
        );

        imageSequenceTimer = setTimeout(startImageSequence, delay);
    }

    function restoreImages() {
        clearImageTimers();

        for (const rec of imageRecords) {
            const img = rec.img;
            const clone = rec.clone;

            if (!img || !img.isConnected) {
                if (clone && clone.isConnected) {
                    clone.remove();
                }
                continue;
            }

            if (clone && clone.isConnected) {
                // Rush the floating copy back to the original image position.
                clone.style.transition =
                    'transform 320ms cubic-bezier(.15,.9,.25,1), opacity 220ms ease';
                clone.style.transform = 'translate3d(0,0,0) rotate(0deg)';
                clone.style.opacity = rec.computedOpacity;

                const timer = setTimeout(() => {
                    if (clone.isConnected) {
                        clone.remove();
                    }

                    if (!img.isConnected) return;

                    img.style.opacity = rec.inlineOpacity;
                    img.style.transform = rec.inlineTransform;
                    img.style.transition = rec.inlineTransition;
                    img.style.filter = rec.inlineFilter;
                    img.style.visibility = rec.inlineVisibility;
                }, 340);

                imageTimers.push(timer);
            } else {
                // Fallback for an image that never reached the movement stage.
                img.style.opacity = rec.inlineOpacity;
                img.style.transform = rec.inlineTransform;
                img.style.transition = rec.inlineTransition;
                img.style.filter = rec.inlineFilter;
                img.style.visibility = rec.inlineVisibility;
            }
        }

        const cleanup = setTimeout(() => {
            for (const rec of imageRecords) {
                if (rec.clone && rec.clone.isConnected) {
                    rec.clone.remove();
                }
            }

            imageRecords = [];
            imageTimers = [];
        }, 380);

        imageTimers.push(cleanup);
    }


    function clearLetterTimers() {
        if (letterLaunchTimer) {
            clearTimeout(letterLaunchTimer);
            letterLaunchTimer = null;
        }

        for (const timer of letterTimers) {
            clearTimeout(timer);
        }

        letterTimers = [];
    }

    function shuffleLetters(items) {
        const shuffled = items.slice();

        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        return shuffled;
    }

    function scheduleNextLetter() {
        if (
            !active ||
            restoring ||
            !letterQueue.length ||
            activeLetterCount >= SETTINGS.maxActiveLetters ||
            letterLaunchTimer
        ) {
            return;
        }

        const delay = Math.round(
            rand(SETTINGS.letterStartGapMin, SETTINGS.letterStartGapMax)
        );

        letterLaunchTimer = setTimeout(() => {
            letterLaunchTimer = null;

            if (
                !active ||
                restoring ||
                !letterQueue.length ||
                activeLetterCount >= SETTINGS.maxActiveLetters
            ) {
                return;
            }

            // Launch a random batch of 1 to maxLettersPerInterval letters.
            // The active-letter limit is still respected, so this cannot exceed
            // maxActiveLetters even if the random batch wants to launch more.
            const availableSlots = Math.max(
                0,
                SETTINGS.maxActiveLetters - activeLetterCount
            );

            const maxBatch = Math.min(
                SETTINGS.maxLettersPerInterval,
                availableSlots,
                letterQueue.length
            );

            if (maxBatch > 0) {
                const batchSize = Math.floor(rand(1, maxBatch + 1));

                for (let i = 0; i < batchSize; i++) {
                    const rec = letterQueue.shift();
                    if (!rec) break;
                    startQueuedLetter(rec);
                }
            }

            // Schedule the next random batch.
            scheduleNextLetter();
        }, delay);
    }

    function startQueuedLetter(rec) {
        if (!rec || !rec.el || !active || restoring) return;

        activeLetterCount++;
        rec.started = true;

        const fadeDuration = Math.round(rec.duration * rec.fadeFraction);

        rec.el.style.transition =
            `transform ${rec.duration}ms cubic-bezier(.18,.55,.35,1), ` +
            `opacity ${fadeDuration}ms ease-in`;

        rec.el.style.transform =
            `translate3d(${rec.dest.x}px, ${rec.dest.y}px, 0) rotate(${rec.rotation}deg)`;
        rec.el.style.opacity = String(SETTINGS.opacityAtEdge);

        // Once the letter has fully faded, free a slot for another one.
        const timer = setTimeout(() => {
            if (!rec.finished) {
                rec.finished = true;
                activeLetterCount = Math.max(0, activeLetterCount - 1);
            }

            scheduleNextLetter();
        }, fadeDuration);

        letterTimers.push(timer);
    }

    function beginLetterQueue() {
        clearLetterTimers();
        activeLetterCount = 0;

        // Random order keeps the disappearances scattered around the page.
        letterQueue = shuffleLetters(records);

        // Start one immediately, then feed the rest through the delay range.
        if (letterQueue.length) {
            const first = letterQueue.shift();
            startQueuedLetter(first);
        }

        scheduleNextLetter();
    }

    function startCreep() {
        if (active || restoring || document.hidden) return;

        const nodes = collectTextNodes();
        if (!nodes.length) {
            scheduleIdle();
            return;
        }

        active = true;
        makeOverlay();

        // First measure all characters while the page is still 100% untouched.
        const measured = [];
        for (const node of nodes) {
            const glyphs = textNodeRects(node);
            if (glyphs.length) {
                measured.push({ node, glyphs });
            }
        }

        // Create the visual copies at the exact browser-rendered positions.
        for (const entry of measured) {
            for (const glyph of entry.glyphs) {
                const el = createGlyph(glyph);
                const dest = chooseDestination({
                    left: glyph.rect.left,
                    right: glyph.rect.left + glyph.rect.width,
                    top: glyph.rect.top,
                    bottom: glyph.rect.top + glyph.rect.height,
                    width: glyph.rect.width,
                    height: glyph.rect.height
                });

                records.push({
                    el,
                    duration: rand(SETTINGS.minTravelTime, SETTINGS.maxTravelTime),
                    fadeFraction: rand(SETTINGS.minFadeFraction, SETTINGS.maxFadeFraction),
                    dest,
                    rotation: rand(-SETTINGS.maxRotation, SETTINGS.maxRotation),
                    started: false,
                    finished: false
                });
            }
        }

        // Only after copies exist do we hide the originals.
        hideOriginalText(measured.map(x => x.node));

        // Force layout so transitions start from exact measured positions.
        void overlay.offsetWidth;

        // Let only a few letters creep away at a time so the page feels
        // quietly "stolen" instead of exploding all at once.
        beginLetterQueue();

        scheduleImageSequence();
    }

    function stopCreep() {
        if (!active || restoring) {
            scheduleIdle();
            return;
        }

        restoring = true;

        clearLetterTimers();
        letterQueue = [];
        activeLetterCount = 0;

        restoreImages();

        for (const rec of records) {
            rec.el.style.transition =
                `transform ${SETTINGS.returnTime}ms cubic-bezier(.15,.9,.25,1), ` +
                `opacity ${Math.min(SETTINGS.returnTime, 260)}ms linear`;

            rec.el.style.transform = 'translate3d(0,0,0) rotate(0deg)';
            rec.el.style.opacity = rec.styleOpacity || '1';
        }

        window.setTimeout(() => {
            if (overlay) {
                overlay.remove();
                overlay = null;
            }

            records = [];
            letterQueue = [];
            activeLetterCount = 0;
            clearLetterTimers();
            restoreOriginalText();

            active = false;
            restoring = false;
            scheduleIdle();
        }, SETTINGS.returnTime + 50);
    }

    function scheduleIdle() {
        clearTimeout(idleTimer);
        if (!active && !restoring) {
            idleTimer = setTimeout(startCreep, SETTINGS.idleTime);
        }
    }

    function onActivity() {
        clearTimeout(idleTimer);
        if (active) {
            stopCreep();
        } else if (!restoring) {
            scheduleIdle();
        }
    }

    function init() {
        activityEvents.forEach(evt => {
            window.addEventListener(evt, onActivity, { passive: true });
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (active) stopCreep();
                clearTimeout(idleTimer);
            } else {
                scheduleIdle();
            }
        });

        window.addEventListener('resize', () => {
            if (active) stopCreep();
        }, { passive: true });

        scheduleIdle();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
