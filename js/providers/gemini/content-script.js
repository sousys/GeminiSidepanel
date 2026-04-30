/**
 * Gemini-specific content script.
 *
 * Tracks SPA navigation + conversation titles inside Gemini iframes embedded
 * in the side panel, and reports state to the parent extension via postMessage.
 *
 * Depends on globalThis.__AIMS_CS (loaded by content-script-common.js
 * BEFORE this file via manifest.json content_scripts[].js ordering).
 */
(function () {
    const CS = globalThis.__AIMS_CS;
    if (!CS) {
        console.error('[AIMS Gemini] content-script-common not loaded');
        return;
    }

    const PROVIDER_ID = 'gemini';
    const DEFAULT_TITLE = 'New';

    // Routes that represent the "new chat" landing page. URL pathnames may or
    // may not have a trailing slash, so list both forms explicitly.
    const ROUTES = {
        NEW_CHAT: ['/app', '/app/']
    };

    const SELECTORS = {
        CONVERSATIONS_LIST: 'conversations-list',
        CONVERSATION_TITLE: '.conversation-title',
        JSLOG_BY_ID: (id) => `[jslog*="${id}"]`
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
        // Gemini auto-redirects deleted conversation deep links back to /app.
        // Distinguish that from a user-initiated "new chat" by checking
        // whether any user interaction has occurred since load.
        const isAutoRedirect = isNewChat && !hasUserInteracted();

        if (isNewChat) {
            currentTitle = DEFAULT_TITLE;
        } else {
            currentTitle = extractConversationTitle(urlObj);
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

    function extractConversationTitle(urlObj) {
        // Conversation id is the last path segment (e.g. /app/<id>).
        const segments = urlObj.pathname.split('/').filter(Boolean);
        const conversationId = segments[segments.length - 1];

        if (conversationId) {
            const sidebarItem = document.querySelector(SELECTORS.JSLOG_BY_ID(conversationId));
            if (sidebarItem) {
                const titleEl = sidebarItem.querySelector(SELECTORS.CONVERSATION_TITLE);
                if (titleEl) {
                    const text = (titleEl.textContent || '').trim();
                    if (text) return text;
                }
            }
        }

        return DEFAULT_TITLE;
    }

    function startObserving() {
        const list = document.querySelector(SELECTORS.CONVERSATIONS_LIST);
        if (list) {
            observer.observe(list, {
                subtree: true,
                childList: true,
                characterData: true,
                attributes: true,
                attributeFilter: ['jslog', 'class']
            });
            return true;
        }
        return false;
    }
})();
