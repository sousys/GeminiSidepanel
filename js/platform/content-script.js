(() => {
    // Capture the tab ID immediately in case the app overwrites window.name later
    const initialTabId = window.name;
    
    let lastUrl = location.href;
    let lastTitle = null;

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

    const EXTENSION_ORIGIN = chrome.runtime.getURL('').slice(0, -1);

    const reportState = () => {
        const currentUrl = location.href;
        
        let currentTitle = null; 
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
            const selectedItem = document.querySelector('.conversation.selected .conversation-title');
            const headerTitle = document.querySelector('.conversation-title');

            // Priority 1: Sidebar Active Link (Legacy/Standard)
            if (sidebarLink && sidebarLink.innerText.trim()) {
                currentTitle = sidebarLink.innerText.trim();
                titleFound = true;
            }
            // Priority 2: Selected Item in List (New HTML Structure)
            else if (selectedItem && selectedItem.innerText.trim()) {
                currentTitle = selectedItem.innerText.trim();
                titleFound = true;
            }
            // Priority 3: Header Title (Fallback)
            else if (headerTitle && headerTitle.innerText.trim()) {
                currentTitle = headerTitle.innerText.trim();
                titleFound = true;
            }
        }

        if (currentUrl !== lastUrl || (currentTitle !== null && currentTitle !== lastTitle)) {
            // Only send if we are embedded in the extension (parent origin matches)
            // or we just optimistically send to the extension origin.
            window.parent.postMessage({ 
                type: 'GEMINI_STATE_CHANGED', 
                url: currentUrl,
                title: currentTitle,
                tabId: initialTabId
            }, EXTENSION_ORIGIN);
            
            lastUrl = currentUrl;
            if (currentTitle !== null) {
                lastTitle = currentTitle;
            }
        }
    };

    // 1. Initial report
    reportState();

    // Utility: Debounce to coalesce rapid framework updates
    const debounce = (func, wait) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    };

    // 2. Targeted Observation (Replaces Polling)
    // We observe the sidebar (conversations-list) for title changes
    // specific logic for debounce: wait 100ms after last mutation to check state
    const observer = new MutationObserver(debounce(() => {
        reportState();
    }, 100));

    const startObserving = () => {
        // Target the specific Angular component for the conversation list
        const sidebar = document.querySelector('conversations-list');
        if (sidebar) {
            observer.observe(sidebar, { 
                subtree: true, 
                childList: true, 
                characterData: true, 
                attributes: true,
                attributeFilter: ['aria-current', 'class']
            });
            return true;
        }
        return false;
    };

    if (!startObserving()) {
        // If sidebar isn't ready, check briefly until it appears
        const initCheck = setInterval(() => {
            if (startObserving()) {
                clearInterval(initCheck);
            }
        }, 500);
        // Stop trying after 10 seconds to avoid infinite checking on non-standard pages
        setTimeout(() => clearInterval(initCheck), 10000);
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
})();