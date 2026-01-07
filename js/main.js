// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    ViewRenderer.init();
    TooltipUI.init();
    await ThemeManager.init();
    
    // Subscribe to store changes to trigger render
    State.subscribe((tabs, activeTabId) => {
        ViewRenderer.render(tabs, activeTabId);
    });

    // Initialize Store (loads state)
    await State.init();

    // Ensure at least one tab exists
    if (State.getTabs().length === 0) {
        State.addTab();
    } // Store.init() calls notify(), which triggers render()

    const addTabBtn = document.getElementById('addTabBtn');
    addTabBtn.addEventListener('click', () => {
        State.addTab();
    });

    const openBrowserBtn = document.getElementById('openBrowserBtn');
    openBrowserBtn.addEventListener('click', () => {
        const activeTab = State.getActiveTab();
        if (activeTab && activeTab.url) {
            chrome.tabs.create({ url: activeTab.url });
        }
    });

    // Listen for URL/Title changes from the content script inside the iframe
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'GEMINI_STATE_CHANGED') {
            const contentArea = document.getElementById('content-area');
            let tabId = event.data.tabId;

            if (tabId) {
                State.updateTabUrl(tabId, event.data.url);
                
                // Pass raw title to State if valid; State now trusts the iframe source directly
                if (event.data.title) {
                    State.updateTabTitle(tabId, event.data.title);
                }
            }
        }
    });
});
