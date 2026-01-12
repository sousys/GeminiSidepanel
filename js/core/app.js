import { StateManager } from './store.js';
import { ViewRenderer } from '../components/ui-manager.js';
import { MessageTypes, DOMIds, Origins } from './config.js';
import { ThemeManager } from '../features/theme.js';
import { ZoomManager } from '../features/zoom.js';
import { Icons } from './icons.js';
import { BookmarksManager } from '../features/bookmarks.js';
import { SettingsManager } from '../features/settings.js';

class App {
    constructor() {
        this.state = new StateManager();
        this.view = new ViewRenderer();
        this.bookmarks = new BookmarksManager();
        this.settings = new SettingsManager();
        this.themeManager = new ThemeManager();
        this.zoomManager = new ZoomManager();
    }

    async start() {
        // Render Components
        const modalsContainer = document.getElementById('modals-container');
        const tabBarContainer = document.getElementById('tab-bar-container');
        const browserContainer = document.getElementById('browser-container');

        if (modalsContainer) {
            this.settings.render(modalsContainer);
            this.view.renderModals(modalsContainer);
        }

        if (tabBarContainer && this.view.tabBar) {
            this.view.tabBar.renderUI(tabBarContainer);
        }

        if (browserContainer) {
            this.view.renderBrowser(browserContainer);
        }

        this.view.init();
        
        // Initialize Features
        await this.themeManager.init();
        this.zoomManager.init();
        
        this.bindEvents();

        // Initialize State & Bookmarks
        await this.state.init();
        await this.bookmarks.init();
        
        // Ensure at least one tab exists
        if (this.state.getTabs().length === 0) {
            this.state.addTab();
        }
    }

    bindEvents() {
        // Subscribe to store changes to trigger render
        this.state.subscribe((tabs, activeTabId) => {
            this.view.render(tabs, activeTabId);
            
            // Update bookmark button state for the new active tab
            const activeTab = this.state.getActiveTab();
            if (activeTab) {
                this.view.updateBookmarkButton(this.bookmarks.isBookmarked(activeTab.url));
            }
        });

        // Subscribe to bookmarks changes
        this.bookmarks.addEventListener('bookmarks-changed', (e) => {
            const currentBookmarks = e.detail.bookmarks;
            this.view.renderBookmarksList(currentBookmarks);
            
            // Also update the button state as the active tab might have been affected
            const activeTab = this.state.getActiveTab();
            if (activeTab) {
                this.view.updateBookmarkButton(this.bookmarks.isBookmarked(activeTab.url));
            }
        });

        // View Events
        this.view.addEventListener('tab-switch', (e) => {
            this.state.setActiveTab(e.detail.id);
        });

        this.view.addEventListener('tab-close', (e) => {
            this.state.removeTab(e.detail.id);
            // Ensure at least one tab exists
            if (this.state.getTabs().length === 0) {
                this.state.addTab();
            }
        });

        // Bookmark Events
        this.view.addEventListener('bookmark-toggle', async () => {
            const activeTab = this.state.getActiveTab();
            if (activeTab && activeTab.url && !activeTab.url.startsWith('chrome-extension://')) {
                await this.bookmarks.toggle(activeTab.title, activeTab.url);
            }
        });

        this.view.addEventListener('bookmarks-modal-open', () => {
            // Refresh list just in case
            this.view.renderBookmarksList(this.bookmarks.getBookmarks());
            // Close settings if open
            this.settings.closeModal();
        });

        this.view.addEventListener('bookmark-delete', async (e) => {
            await this.bookmarks.remove(e.detail.url);
        });

        this.view.addEventListener('bookmark-update', async (e) => {
            await this.bookmarks.update(e.detail.url, e.detail.title);
        });

        this.view.addEventListener('bookmark-select', (e) => {
            const bookmark = e.detail;
            const existingTab = this.state.getTabs().find(t => t.url === bookmark.url);
            
            if (existingTab) {
                this.state.setActiveTab(existingTab.id);
            } else {
                this.state.addTab(bookmark.title, bookmark.url);
            }
        });

        const addTabBtn = document.getElementById(DOMIds.ADD_TAB_BTN);
        if (addTabBtn) {
            addTabBtn.addEventListener('click', () => {
                this.state.addTab();
            });
        }

        const openBrowserBtn = document.getElementById(DOMIds.OPEN_BROWSER_BTN);
        if (openBrowserBtn) {
            openBrowserBtn.innerHTML = Icons.OPEN_NEW;
            openBrowserBtn.addEventListener('click', () => {
                const activeTab = this.state.getActiveTab();
                if (activeTab && activeTab.url) {
                    chrome.tabs.create({ url: activeTab.url });
                    this.state.removeTab(activeTab.id);
                    if (this.state.getTabs().length === 0) {
                        this.state.addTab();
                    }
                }
            });
        }

        const settingsBtn = document.getElementById(DOMIds.SETTINGS_BTN);
        if (settingsBtn) {
            settingsBtn.innerHTML = Icons.SETTINGS;
            settingsBtn.addEventListener('click', () => {
                if (this.settings.isOpen()) {
                    this.settings.closeModal();
                } else {
                    // Close bookmarks if open
                    this.view.closeBookmarksModal();
                    this.settings.openModal();
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
                    this.state.updateTabUrl(tabId, event.data.url);
                    
                    // Pass raw title to State if valid
                    if (event.data.title) {
                        this.state.updateTabTitle(tabId, event.data.title);
                    }
                }
            }
        });
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new App().start();
});
