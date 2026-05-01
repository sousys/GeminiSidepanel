/**
 * Claude content script.
 *
 * Claude renders a stripped composer-only layout when embedded in an iframe
 * (no sidebar, no chat history). This script therefore relies on
 * `document.title` exclusively for conversation titles — no sidebar lookup
 * is possible. The parent's 2-second CHECK_STATE poll keeps things fresh
 * even when Claude is slow to update its title after the first message.
 *
 * Depends on globalThis.__AIMS_CS (loaded by content-script-common.js
 * BEFORE this file via manifest.json content_scripts[].js ordering).
 */
(function () {
    const CS = globalThis.__AIMS_CS;
    if (!CS) {
        console.error('[AIMS Claude] content-script-common not loaded');
        return;
    }

    const PROVIDER_ID = 'claude';
    const DEFAULT_TITLE = 'New chat';

    // Claude sets <title> to the conversation name once the model proposes
    // one; until then it's the brand string. Strip a trailing " - Claude"
    // / " | Claude" / similar.
    const TITLE_SUFFIX_RE = /\s*[\|\-\u2013\u2014]\s*Claude(\.ai)?\s*$/i;
    const BRAND_TITLES = new Set(['Claude', 'Claude.ai', 'New chat', 'New Chat']);

    const ROUTES = {
        NEW_CHAT: ['/', '/new']
    };

    const TIMING = {
        DEBOUNCE_MS: 100,
        POST_LOAD_RECHECK_MS: 1000
    };

    const initialTabId = window.name;
    if (!initialTabId) return;

    let lastUrl = null;
    let lastTitle = null;
    const hasUserInteracted = CS.trackUserInteraction();

    let titleObserver = null;

    init();

    function init() {
        reportState();
        setTimeout(reportState, TIMING.POST_LOAD_RECHECK_MS);

        observeTitle();

        CS.patchHistory('pushState', reportState);
        CS.patchHistory('replaceState', reportState);
        window.addEventListener('popstate', reportState);

        CS.listenForCheckState(() => {
            lastUrl = null;
            reportState();
        });
    }

    function reportState() {
        const currentUrl = location.href;

        let urlObj;
        try {
            urlObj = new URL(currentUrl);
        } catch (_) {
            return;
        }

        const isNewChat = ROUTES.NEW_CHAT.includes(urlObj.pathname);
        const isAutoRedirect = isNewChat && !hasUserInteracted();

        const currentTitle = isNewChat ? DEFAULT_TITLE : extractConversationTitle();

        if (currentUrl !== lastUrl || (currentTitle !== null && currentTitle !== lastTitle)) {
            CS.sendStateUpdate({
                providerId: PROVIDER_ID,
                tabId: initialTabId,
                url: currentUrl,
                title: currentTitle,
                isAutoRedirect
            });
            lastUrl = currentUrl;
            if (currentTitle !== null) lastTitle = currentTitle;
        }
    }

    function extractConversationTitle() {
        // No sidebar in the iframed layout — <title> is our only signal.
        const docTitle = (document.title || '').replace(TITLE_SUFFIX_RE, '').trim();
        if (docTitle && !BRAND_TITLES.has(docTitle)) return docTitle;
        return DEFAULT_TITLE;
    }

    function observeTitle() {
        const titleEl = document.querySelector('head > title');
        if (!titleEl) return;
        titleObserver = new MutationObserver(CS.debounce(() => reportState(), TIMING.DEBOUNCE_MS));
        titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }
})();
