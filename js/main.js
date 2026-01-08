import { StateManager } from './state-handler.js';
import { ViewRenderer } from './view-renderer.js';
import { MessageTypes, DOMIds, Origins } from './constants.js';
import { ThemeManager } from './theme-handler.js';
import { Icons } from './icons.js';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Globals (TooltipUI, ThemeManager) are initialized by their own scripts or here if needed.
    // tooltips.js has init called by main previously?
    // Original main.js:
    // ViewRenderer.init();
    // TooltipUI.init();
    // await ThemeManager.init();
    
    const state = new StateManager();
    const view = new ViewRenderer();

    view.init();
    
    await ThemeManager.init();
    
    // Subscribe to store changes to trigger render
    state.subscribe((tabs, activeTabId) => {
        view.render(tabs, activeTabId);
    });

    // View Events
    view.addEventListener('tab-switch', (e) => {
        state.setActiveTab(e.detail.id);
    });

    view.addEventListener('tab-close', (e) => {
        state.removeTab(e.detail.id);
        // Ensure at least one tab exists
        if (state.getTabs().length === 0) {
            state.addTab();
        }
    });

    // Initialize Store (loads state)
    await state.init();

    // Ensure at least one tab exists
    if (state.getTabs().length === 0) {
        state.addTab();
    } 

    const addTabBtn = document.getElementById(DOMIds.ADD_TAB_BTN);
    if (addTabBtn) {
        addTabBtn.addEventListener('click', () => {
            state.addTab();
        });
    }

    const openBrowserBtn = document.getElementById(DOMIds.OPEN_BROWSER_BTN);
    if (openBrowserBtn) {
        openBrowserBtn.innerHTML = Icons.OPEN_NEW;
        openBrowserBtn.addEventListener('click', () => {
            const activeTab = state.getActiveTab();
            if (activeTab && activeTab.url) {
                chrome.tabs.create({ url: activeTab.url });
            }
        });
    }

    const coffeeBtn = document.getElementById('coffeeBtn');
    if (coffeeBtn) {
        coffeeBtn.innerHTML = Icons.COFFEE;
        coffeeBtn.addEventListener('click', () => window.open('https://buymeacoffee.com/sousys', '_blank'));
    }

    // Listen for URL/Title changes from the content script inside the iframe
    window.addEventListener('message', (event) => {
        if (event.origin !== Origins.GEMINI) return;

        if (event.data && event.data.type === MessageTypes.GEMINI_STATE_CHANGED) {
            let tabId = event.data.tabId;

            if (tabId) {
                state.updateTabUrl(tabId, event.data.url);
                
                // Pass raw title to State if valid
                if (event.data.title) {
                    state.updateTabTitle(tabId, event.data.title);
                }
            }
        }
    });
});