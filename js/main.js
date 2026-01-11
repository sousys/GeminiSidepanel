import { StateManager } from './state-handler.js';
import { ViewRenderer } from './view-renderer.js';
import { MessageTypes, DOMIds, Origins } from './constants.js';
import { ThemeManager } from './theme-handler.js';
import { SizeHandler } from './size-handler.js';
import { Icons } from './icons.js';
import { BookmarksManager } from './bookmarks.js';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    
    const state = new StateManager();
    const view = new ViewRenderer();
    const bookmarks = new BookmarksManager();

    view.init();
    
    await ThemeManager.init();
    SizeHandler.init();
    
    // Subscribe to store changes to trigger render
    state.subscribe((tabs, activeTabId) => {
        view.render(tabs, activeTabId);
        
        // Update bookmark button state for the new active tab
        const activeTab = state.getActiveTab();
        if (activeTab) {
            view.updateBookmarkButton(bookmarks.isBookmarked(activeTab.url));
        }
    });

    // Subscribe to bookmarks changes
    bookmarks.addEventListener('bookmarks-changed', (e) => {
        const currentBookmarks = e.detail.bookmarks;
        view.renderBookmarksList(currentBookmarks);
        
        // Also update the button state as the active tab might have been affected
        const activeTab = state.getActiveTab();
        if (activeTab) {
            view.updateBookmarkButton(bookmarks.isBookmarked(activeTab.url));
        }
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

    // Bookmark Events
    view.addEventListener('bookmark-toggle', async () => {
        const activeTab = state.getActiveTab();
        if (activeTab && activeTab.url && !activeTab.url.startsWith('chrome-extension://')) {
            await bookmarks.toggle(activeTab.title, activeTab.url);
        }
    });

    view.addEventListener('bookmarks-modal-open', () => {
        // Refresh list just in case
        view.renderBookmarksList(bookmarks.getBookmarks());
    });

    view.addEventListener('bookmark-delete', async (e) => {
        await bookmarks.remove(e.detail.url);
    });

    view.addEventListener('bookmark-update', async (e) => {
        await bookmarks.update(e.detail.url, e.detail.title);
    });

    view.addEventListener('bookmark-select', (e) => {
        const bookmark = e.detail;
        const existingTab = state.getTabs().find(t => t.url === bookmark.url);
        
        if (existingTab) {
            state.setActiveTab(existingTab.id);
        } else {
            state.addTab(bookmark.title, bookmark.url);
        }
    });

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
                state.removeTab(activeTab.id);
                if (state.getTabs().length === 0) {
                    state.addTab();
                }
            }
        });
    }

    const settingsBtn = document.getElementById(DOMIds.SETTINGS_BTN);
    if (settingsBtn) {
        settingsBtn.innerHTML = Icons.SETTINGS;
        settingsBtn.addEventListener('click', () => {
            const settingsUrl = chrome.runtime.getURL('html/settings.html');
            const existingTab = state.getTabs().find(t => t.url === settingsUrl);
            
            if (existingTab) {
                if (state.getActiveTabId() === existingTab.id) {
                    // Toggle off: Close if already active
                    state.removeTab(existingTab.id);
                    // Ensure at least one tab exists (handled by tab-close listener usually, but removeTab triggers it)
                    if (state.getTabs().length === 0) {
                        state.addTab();
                    }
                } else {
                    // Switch to existing
                    state.setActiveTab(existingTab.id);
                }
            } else {
                state.addTab('Settings', settingsUrl);
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

    // Initialize Store (loads state)
    await state.init();
    await bookmarks.init(); // Initialize bookmarks

    // Ensure at least one tab exists
    if (state.getTabs().length === 0) {
        state.addTab();
    } 
});
