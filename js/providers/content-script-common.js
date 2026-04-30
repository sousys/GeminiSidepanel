/**
 * Shared content-script utilities for all AI providers.
 *
 * Plain script (NOT an ES module) — content scripts in MV3 cannot use ES
 * imports. This file is loaded BEFORE each provider-specific content script
 * via manifest.json content_scripts[].js ordering, and exposes its API on
 * globalThis.__AIMS_CS.
 *
 * Provider-specific selectors / DOM scraping live in the per-provider
 * content-script files; this module is provider-agnostic.
 */
(function () {
    if (globalThis.__AIMS_CS) return; // Idempotent

    const EXTENSION_ORIGIN = chrome.runtime.getURL('').slice(0, -1);

    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    /**
     * Patches history.pushState / history.replaceState so the supplied
     * callback fires on every SPA navigation.
     */
    function patchHistory(method, callback) {
        const original = history[method];
        history[method] = function (...args) {
            const result = original.apply(this, args);
            try { callback(); } catch (_) { /* swallow */ }
            return result;
        };
    }

    /**
     * Tracks user interaction. Returns a getter that reports whether any
     * interaction has occurred since installation.
     */
    function trackUserInteraction() {
        let hasInteracted = false;
        ['mousedown', 'keydown', 'touchstart', 'pointerdown'].forEach(evt => {
            window.addEventListener(evt, () => { hasInteracted = true; }, {
                capture: true,
                passive: true
            });
        });
        return () => hasInteracted;
    }

    /**
     * Posts a STATE_CHANGED message to the parent extension page when this
     * frame is embedded in the side panel iframe. Safe in non-side-panel
     * contexts (regular browser tabs) — silently no-ops.
     */
    function sendStateUpdate(payload) {
        try {
            const ancestors = window.location.ancestorOrigins;
            const isEmbeddedInExtension = ancestors &&
                ancestors.length > 0 &&
                ancestors[0] === EXTENSION_ORIGIN;

            if (window.parent !== window && isEmbeddedInExtension) {
                window.parent.postMessage(
                    { type: 'STATE_CHANGED', ...payload },
                    EXTENSION_ORIGIN
                );
            }
        } catch (_) {
            // Cross-origin access errors are expected in non-embedded contexts.
        }
    }

    /**
     * Listens for CHECK_STATE messages from the extension. The supplied
     * callback is invoked with no arguments.
     */
    function listenForCheckState(onCheck) {
        window.addEventListener('message', (event) => {
            if (event.origin !== EXTENSION_ORIGIN) return;
            if (event.data && event.data.type === 'CHECK_STATE') {
                try { onCheck(); } catch (_) { /* swallow */ }
            }
        });
    }

    globalThis.__AIMS_CS = {
        EXTENSION_ORIGIN,
        debounce,
        patchHistory,
        trackUserInteraction,
        sendStateUpdate,
        listenForCheckState
    };
})();
