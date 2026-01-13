(function() {
    // ==========================================
    // 1. CONFIGURATION
    // ==========================================
    const CONFIG = {
        // Selectors are likely to break; keep them centralized here
        SELECTORS: {
            // Priority 1: Match the specific sidebar item using the ID
            // We look for divs (buttons) or links that contain the ID in their attributes
            SIDEBAR_ITEM_BY_ATTRIBUTE: (id) => `[jslog*="${id}"], a[href*="${id}"]`,
            SIDEBAR_CONTAINER: 'conversations-list'
        },
        // Timing settings
        TIMING: {
            DEBOUNCE_MS: 100,
            INIT_RETRY_MS: 300,
            INIT_TIMEOUT_MS: 10000
        },
        // Routes
        ROUTES: {
            NEW_CHAT: ['/app', '/app/']
        }
    };

    // ==========================================
    // 2. STATE & CORE VARIABLES
    // ==========================================
    const EXTENSION_ORIGIN = chrome.runtime.getURL('').slice(0, -1);
    
    // Capture the tab ID immediately in case window.name is overwritten later
    const initialTabId = window.name;
    
    let lastUrl = location.href;
    let lastTitle = null;

    // ==========================================
    // 3. OBSERVER SETUP
    // ==========================================
    const observer = new MutationObserver(debounce(() => {
        reportState();
    }, CONFIG.TIMING.DEBOUNCE_MS));

    // ==========================================
    // 4. START EXECUTION
    // ==========================================
    init();

    // ------------------------------------------------------------------------
    // Functions (Hoisted)
    // ------------------------------------------------------------------------

    function init() {
        reportState();

        // Try to attach observer (with retry if Angular hasn't loaded sidebar yet)
        if (!startObserving()) {
            const initCheck = setInterval(() => {
                if (startObserving()) {
                    clearInterval(initCheck);
                }
            }, CONFIG.TIMING.INIT_RETRY_MS);
            // Stop trying after safety timeout
            setTimeout(() => clearInterval(initCheck), CONFIG.TIMING.INIT_TIMEOUT_MS);
        }

        // Patch History API for SPA navigation support
        patchHistory('pushState');
        patchHistory('replaceState');
        window.addEventListener('popstate', reportState);

        // Listen for requests from the main extension
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'CHECK_STATE') {
                // Force report by invalidating cache
                lastUrl = null; 
                reportState();
            }
        });
    }

    function reportState() {
        const currentUrl = location.href;
        let currentTitle = null; 
        
        // Check if we are on the "New Chat" page based on URL
        const urlObj = new URL(currentUrl);
        const isNewChat = CONFIG.ROUTES.NEW_CHAT.includes(urlObj.pathname);

        if (isNewChat) {
            currentTitle = 'New';
        } else {
            // 1. Try to extract the conversation ID from the URL
            // Path structure: /app/{conversationId}
            const pathSegments = urlObj.pathname.split('/').filter(Boolean);
            console.log(pathSegments);
            const conversationId = (pathSegments.length > 1 && pathSegments[0] === 'app') ? pathSegments[1] : null;
            console.log('Conversation ID:', conversationId);

            if (conversationId) {
                const sidebarContainer = document.querySelector(CONFIG.SELECTORS.SIDEBAR_CONTAINER);
                
                if (sidebarContainer) {
                    const selector = CONFIG.SELECTORS.SIDEBAR_ITEM_BY_ATTRIBUTE(conversationId);
                    const sidebarItem = sidebarContainer.querySelector(selector);
                    
                    if (sidebarItem) {
                        // Try to find a title element inside (like .conversation-title), otherwise use the item's text
                        // We check for common title classes used in Gemini
                        const titleElement = sidebarItem.querySelector('.conversation-title') || sidebarItem;
                        currentTitle = titleElement.innerText.trim();
                    }
                }
            }
        }

        // Only send message if something actually changed
        if (currentUrl !== lastUrl || (currentTitle !== null && currentTitle !== lastTitle)) {
            
            // We use try-catch to safely handle cases where we are NOT in the side panel
            // (e.g. regular tab), which prevents console errors.
            try {
                if (window.parent !== window) {
                    window.parent.postMessage({ 
                        type: 'GEMINI_STATE_CHANGED', 
                        url: currentUrl,
                        title: currentTitle,
                        tabId: initialTabId
                    }, EXTENSION_ORIGIN);
                }
            } catch (err) {
                // Ignore cross-origin errors in regular tabs
            }
            
            lastUrl = currentUrl;
            if (currentTitle !== null) {
                lastTitle = currentTitle;
            }
        }
    }

    function startObserving() {
        const sidebar = document.querySelector(CONFIG.SELECTORS.SIDEBAR_CONTAINER);
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
    }

    function patchHistory(method) {
        const original = history[method];
        history[method] = function(...args) {
            const result = original.apply(this, args);
            reportState();
            return result;
        };
    }

    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

})();