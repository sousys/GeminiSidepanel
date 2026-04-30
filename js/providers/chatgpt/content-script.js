/**
 * ChatGPT-specific content script.
 *
 * Tracks SPA navigation + conversation titles inside ChatGPT iframes embedded
 * in the side panel, and reports state to the parent extension via postMessage.
 *
 * ChatGPT's React DOM is volatile — selectors are best-effort. We fall back to
 * `document.title` (which ChatGPT keeps in sync with the active conversation)
 * when sidebar lookup fails.
 *
 * Depends on globalThis.__AIMS_CS (loaded by content-script-common.js
 * BEFORE this file via manifest.json content_scripts[].js ordering).
 */
(function () {
    const CS = globalThis.__AIMS_CS;
    if (!CS) {
        console.error('[AIMS ChatGPT] content-script-common not loaded');
        return;
    }

    const PROVIDER_ID = 'chatgpt';
    const DEFAULT_TITLE = 'New Chat';

    // ChatGPT typically sets <title> to either "ChatGPT" (new chat) or the
    // conversation name. Strip the trailing brand suffix when present.
    const TITLE_SUFFIX_RE = /\s*[\|\-\u2013\u2014]\s*ChatGPT\s*$/i;
    const BRAND_TITLES = new Set(['ChatGPT', 'New chat', 'New Chat']);

    const ROUTES = {
        NEW_CHAT: ['/']
    };

    // Sidebar conversation list — `#history` is ChatGPT's stable container
    // element for the conversation list (mirrors Gemini's
    // `conversations-list` element). Observing this element directly is the
    // approach that proved reliable for Gemini and is preferred over
    // observing the surrounding <nav>, which React frequently re-mounts.
    const SELECTORS = {
        ACTIVE_SIDEBAR_ITEM: '#history a[aria-current="page"], nav a[aria-current="page"]',
        SIDEBAR_HISTORY: '#history',
        SIDEBAR_NAV_FALLBACK: 'nav'
    };

    const TIMING = {
        DEBOUNCE_MS: 100,
        INIT_RETRY_MS: 300,
        INIT_TIMEOUT_MS: 10000,
        POST_LOAD_RECHECK_MS: 1000
    };

    const initialTabId = window.name;
    if (!initialTabId) return;

    let lastUrl = null;
    let lastTitle = null;
    const hasUserInteracted = CS.trackUserInteraction();

    const observer = new MutationObserver(CS.debounce(() => reportState(), TIMING.DEBOUNCE_MS));
    // Also observe <title> changes — ChatGPT updates it on conversation rename.
    let titleObserver = null;

    init();

    function init() {
        reportState();
        setTimeout(reportState, TIMING.POST_LOAD_RECHECK_MS);

        if (!startObserving()) {
            const initCheck = setInterval(() => {
                if (startObserving()) clearInterval(initCheck);
            }, TIMING.INIT_RETRY_MS);
            setTimeout(() => clearInterval(initCheck), TIMING.INIT_TIMEOUT_MS);
        }

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
        let currentTitle = null;

        let urlObj;
        try {
            urlObj = new URL(currentUrl);
        } catch (_) {
            return;
        }

        const isNewChat = ROUTES.NEW_CHAT.includes(urlObj.pathname);
        const isAutoRedirect = isNewChat && !hasUserInteracted();

        if (isNewChat) {
            currentTitle = DEFAULT_TITLE;
        } else {
            currentTitle = extractConversationTitle();
        }

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
        // Prefer the active sidebar item's text — most reliable indicator.
        const active = document.querySelector(SELECTORS.ACTIVE_SIDEBAR_ITEM);
        if (active) {
            const text = (active.textContent || '').trim();
            if (text && !BRAND_TITLES.has(text)) return text;
        }

        // Fallback: <title>, stripped of brand suffix.
        const docTitle = (document.title || '').replace(TITLE_SUFFIX_RE, '').trim();
        if (docTitle && !BRAND_TITLES.has(docTitle)) return docTitle;

        return DEFAULT_TITLE;
    }

    function startObserving() {
        const target = document.querySelector(SELECTORS.SIDEBAR_HISTORY)
            || document.querySelector(SELECTORS.SIDEBAR_NAV_FALLBACK);
        if (target) {
            observer.observe(target, {
                subtree: true,
                childList: true,
                characterData: true,
                attributes: true,
                attributeFilter: ['aria-current', 'class', 'href']
            });
            return true;
        }
        return false;
    }

    function observeTitle() {
        const titleEl = document.querySelector('head > title');
        if (!titleEl) return;
        titleObserver = new MutationObserver(CS.debounce(() => reportState(), TIMING.DEBOUNCE_MS));
        titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }
})();
