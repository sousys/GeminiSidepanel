(() => {
    // Capture the tab ID immediately in case the app overwrites window.name later
    const initialTabId = window.name;
    
    let lastUrl = location.href;
    let lastTitle = document.title;

    // Inject CSS to ensure the conversation title/header remains visible
    // This addresses issues where the header might be hidden in narrow views or during loading
    const style = document.createElement('style');
    style.textContent = `
        .conversation-title {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
        }
    `;
    (document.head || document.documentElement).appendChild(style);

    const reportState = () => {
        const currentUrl = location.href;
        
        // Fallback to document title (cleaned)
        let currentTitle = document.title.replace(/ - Gemini$/, '').trim();
        let titleFound = false;

        // Check if we are on the "New Chat" page based on URL
        const urlObj = new URL(currentUrl);
        const isNewChat = urlObj.pathname === '/app' || urlObj.pathname === '/app/';

        if (isNewChat) {
            currentTitle = 'New';
            titleFound = true;
        } else {
            // Try to fetch the specific conversation title from the UI
            const sidebarLink = document.querySelector('a[aria-current="page"]');
            const headerTitle = document.querySelector('.conversation-title');

            // Priority 1: Sidebar Active Link (Ensures we only get the title of the *active* session)
            if (sidebarLink && sidebarLink.innerText.trim()) {
                currentTitle = sidebarLink.innerText.trim();
                titleFound = true;
            }
            // Priority 2: Header Title (Fallback)
            else if (headerTitle && headerTitle.innerText.trim()) {
                currentTitle = headerTitle.innerText.trim();
                titleFound = true;
            }
        }

        // Filter out generic loading titles if we didn't find a specific one
        if (!isNewChat && !titleFound) {
            if (currentTitle === 'Gemini' || currentTitle === 'Google Gemini') {
                currentTitle = null;
            }
        }

        if (currentUrl !== lastUrl || currentTitle !== lastTitle) {
            window.parent.postMessage({ 
                type: 'GEMINI_STATE_CHANGED', 
                url: currentUrl,
                title: currentTitle,
                tabId: initialTabId
            }, '*');
            lastUrl = currentUrl;
            lastTitle = currentTitle;
        }
    };

    // 1. Initial report
    reportState();

    // 2. Observer for DOM changes (Title header, URL updates via framework, etc.)
    const startObserver = () => {
        let debounceTimer;
        const domObserver = new MutationObserver(() => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(reportState, 300);
        });
        
        const targetNode = document.body || document.documentElement;

        if (targetNode && targetNode.nodeType === Node.ELEMENT_NODE) {
            try {
                domObserver.observe(targetNode, { childList: true, subtree: true, characterData: true });
            } catch (e) {
                console.error("Gemini Sidepanel: Failed to start observer", e);
            }
        } else {
            // Retry if document is not ready
            setTimeout(startObserver, 500);
        }
    };

    if (document.body) {
        startObserver();
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            reportState();
            startObserver();
        });
    }

    // 3. Intercept History API for URL changes (SPAs)
    const patchHistory = (method) => {
        const original = history[method];
        history[method] = function(...args) {
            const result = original.apply(this, args);
            reportState();
            return result;
        };
    };
    patchHistory('pushState');
    patchHistory('replaceState');
    window.addEventListener('popstate', reportState);

    // 4. Message Listener
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'CHECK_STATE') {
            // Force report even if no change detected locally (reset lastUrl to force send)
            lastUrl = null; 
            reportState();
        }
    });

    // 5. Polling Fallback (Safety net for missed events)
    setInterval(reportState, 1000);
})();
