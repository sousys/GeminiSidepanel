import { StateManager } from './store.js';
import { ViewRenderer } from '../components/ui-manager.js';
import { MessageTypes, DOMIds, StorageKeys } from './config.js';
import { ThemeManager } from '../features/theme.js';
import { ZoomManager } from '../features/zoom.js';
import { Icons } from './icons.js';
import { BookmarksManager } from '../features/bookmarks.js';
import { SettingsManager } from '../features/settings.js';
import { LinkValidator } from '../features/link-validator.js';
import {
    getAllProviders,
    getAllProviderIds,
    getProviderById,
    getProviderByOrigin,
    isCapabilityDisabled
} from './provider-registry.js';
import { ProviderHints } from '../features/provider-hints.js';

/**
 * Returns provider configs for currently-enabled providers, in registry order.
 */
function filterEnabled(enabledMap) {
    return getAllProviders().filter(p => enabledMap[p.id] !== false);
}

class App {
    constructor() {
        // enabledProviders cache; populated before state.init() runs.
        this.enabledMap = null;
        this.firstRun = false;

        this.state = new StateManager({
            resolveDefaultProvider: () => this.resolveDefaultProvider()
        });
        this.view = new ViewRenderer();
        this.bookmarks = new BookmarksManager();
        this.settings = new SettingsManager();
        this.themeManager = new ThemeManager();
        this.zoomManager = new ZoomManager();
    }

    resolveDefaultProvider() {
        const enabled = filterEnabled(this.enabledMap || {});
        if (enabled.length > 0) return enabled[0].id;
        // Last-resort fallback: first registered provider.
        const all = getAllProviderIds();
        return all.length > 0 ? all[0] : null;
    }

    async loadEnabledProviders() {
        try {
            const data = await chrome.storage.sync.get([StorageKeys.ENABLED_PROVIDERS]);
            const stored = data[StorageKeys.ENABLED_PROVIDERS];
            if (stored && typeof stored === 'object') {
                this.enabledMap = { ...stored };
                this.firstRun = false;
            } else {
                // First run — persist defaults immediately so dismissing the
                // first-run modal is non-blocking.
                this.enabledMap = {};
                for (const p of getAllProviders()) this.enabledMap[p.id] = true;
                this.firstRun = true;
                await chrome.storage.sync.set({
                    [StorageKeys.ENABLED_PROVIDERS]: this.enabledMap
                });
            }
        } catch (error) {
            console.error('Failed to load enabled providers, defaulting all on:', error);
            this.enabledMap = {};
            for (const p of getAllProviders()) this.enabledMap[p.id] = true;
            this.firstRun = false;
        }
    }

    async start() {
        // Render Components
        const modalsContainer = document.getElementById('modals-container');
        const tabBarContainer = document.getElementById('tab-bar-container');
        const browserContainer = document.getElementById('browser-container');

        if (modalsContainer) {
            await this.settings.render(modalsContainer);
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

        // Enabled-providers MUST load before state.init() so the default-
        // provider resolver is correct when the seed tab gets created.
        await this.loadEnabledProviders();
        this.view.setEnabledProviders(filterEnabled(this.enabledMap));

        // Pre-warm dismissed-hint cache so first render reads sync (avoids
        // a hint-strip flash for already-dismissed providers).
        await ProviderHints.load();

        this.bindEvents();

        // Initialize State & Bookmarks
        await this.state.init();
        await this.bookmarks.init();

        // Reset broken bookmark flags if user opted in.
        const settingsData = await chrome.storage.sync.get([StorageKeys.RESET_BROKEN_ON_START]);
        if (settingsData[StorageKeys.RESET_BROKEN_ON_START]) {
            await this.bookmarks.clearBrokenFlags();
        }

        // Ensure at least one tab exists.
        if (this.state.getTabs().length === 0) {
            this.state.addTab();
        }

        if (this.firstRun) {
            // Defaults already persisted; modal is informational. Open after
            // the rest of the UI is settled.
            this.settings.openModal({ firstRun: true });
        }
    }

    /**
     * Refresh the toolbar button states (bookmark + open-in-browser) for the
     * currently active tab. Driven by the active tab's provider's capability
     * descriptor: providers that opt out via
     * `limitations.capabilities.{bookmarks|openInBrowser} === false` get a
     * visually de-emphasized button with a click-to-explain popover.
     */
    refreshToolbarStates() {
        const activeTab = this.state.getActiveTab();
        if (!activeTab) {
            this.view.setBookmarkButtonState({ enabled: false, reason: '' });
            this.view.setOpenInBrowserState({ enabled: false, reason: '' });
            return;
        }
        const provider = getProviderById(activeTab.provider);
        const url = activeTab.url || '';
        const isExtensionUrl = url.startsWith('chrome-extension://') || url === '' || url === 'about:blank';

        // Bookmark button: disabled for extension/blank URLs OR providers that
        // opt out of bookmarks capability.
        const bookmarksDisabled = isExtensionUrl || isCapabilityDisabled(provider, 'bookmarks');
        const bookmarksReason = isExtensionUrl
            ? 'Bookmarks aren\u2019t available for this page.'
            : (provider && provider.limitations && provider.limitations.bookmarksReason) ||
              (provider && provider.limitations && provider.limitations.hint) || '';
        this.view.setBookmarkButtonState({ enabled: !bookmarksDisabled, reason: bookmarksReason });

        // Open-in-browser: disabled for extension/blank URLs OR providers
        // that opt out (e.g. Claude — opening in a browser tab loses the
        // session).
        const openInBrowserDisabled = isExtensionUrl || isCapabilityDisabled(provider, 'openInBrowser');
        const openInBrowserReason = isExtensionUrl
            ? 'Open this page in a browser tab once it has loaded.'
            : (provider && provider.limitations && provider.limitations.openInBrowserReason) ||
              (provider && provider.limitations && provider.limitations.hint) || '';
        this.view.setOpenInBrowserState({ enabled: !openInBrowserDisabled, reason: openInBrowserReason });
    }

    bindEvents() {
        // Subscribe to store changes to trigger render.
        this.state.subscribe((tabs, activeTabId) => {
            this.view.render(tabs, activeTabId);

            const activeTab = this.state.getActiveTab();
            if (activeTab) {
                this.view.updateBookmarkButton(this.bookmarks.isBookmarked(activeTab.url));
            }
            this.refreshToolbarStates();
        });

        this.bookmarks.addEventListener('bookmarks-changed', (e) => {
            this.view.renderBookmarksList(e.detail.bookmarks);
            const activeTab = this.state.getActiveTab();
            if (activeTab) {
                this.view.updateBookmarkButton(this.bookmarks.isBookmarked(activeTab.url));
            }
            this.refreshToolbarStates();
        });

        // Tab events
        this.view.addEventListener('tab-switch', (e) => {
            this.state.setActiveTab(e.detail.id);
        });

        this.view.addEventListener('tab-close', (e) => {
            this.state.removeTab(e.detail.id);
            if (this.state.getTabs().length === 0) {
                this.state.addTab();
            }
        });

        this.view.addEventListener('new-tab', (e) => {
            const providerId = e.detail && e.detail.providerId;
            this.state.addTab(undefined, undefined, providerId);
        });

        this.view.addEventListener('tab-reorder', (e) => {
            const { draggedId, targetId, position } = e.detail || {};
            this.state.reorderTabs(draggedId, targetId, position);
        });

        // Bookmark events
        this.view.addEventListener('bookmark-toggle', async () => {
            const activeTab = this.state.getActiveTab();
            if (!activeTab || !activeTab.url) return;
            if (activeTab.url.startsWith('chrome-extension://')) return;
            // Defense-in-depth: ui-manager's click handler already routes
            // disabled clicks to the explain-popover, but check here too in
            // case the event arrives via a future code path.
            const provider = getProviderById(activeTab.provider);
            if (isCapabilityDisabled(provider, 'bookmarks')) return;
            await this.bookmarks.toggle(activeTab.title, activeTab.url, activeTab.provider);
        });

        // Open-in-browser button (now wired via ui-manager).
        this.view.addEventListener('open-in-browser', async () => {
            const activeTab = this.state.getActiveTab();
            if (!activeTab || !activeTab.url) return;
            const provider = getProviderById(activeTab.provider);
            // Defense-in-depth: same as bookmark guard above.
            if (isCapabilityDisabled(provider, 'openInBrowser')) return;
            try {
                await chrome.tabs.create({ url: activeTab.url });
                this.state.removeTab(activeTab.id);
                if (this.state.getTabs().length === 0) {
                    this.state.addTab();
                }
            } catch (error) {
                console.error('Failed to open tab in browser:', error);
            }
        });

        this.view.addEventListener('bookmarks-modal-open', () => {
            this.view.renderBookmarksList(this.bookmarks.getBookmarks());
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
                return;
            }
            // Resolve provider from the bookmark URL's origin; fall back to
            // resolver default if unknown (and warn — should not normally happen
            // since bookmarks are only created from known-provider tabs).
            let providerId = null;
            try {
                const provider = getProviderByOrigin(new URL(bookmark.url).origin);
                if (provider) providerId = provider.id;
            } catch (err) {
                console.warn('bookmark-select: malformed URL', bookmark.url, err);
            }
            if (!providerId) {
                console.warn('bookmark-select: unknown origin for', bookmark.url, '— falling back to default provider');
                providerId = this.resolveDefaultProvider();
            }
            this.state.addTab(bookmark.title, bookmark.url, providerId);
        });

        const settingsBtn = document.getElementById(DOMIds.SETTINGS_BTN);
        if (settingsBtn) {
            settingsBtn.innerHTML = Icons.SETTINGS;
            settingsBtn.addEventListener('click', () => {
                if (this.settings.isOpen()) {
                    this.settings.closeModal();
                } else {
                    this.view.closeBookmarksModal();
                    this.view.closeReleaseNotes();
                    this.settings.openModal();
                }
            });
        }

        this.settings.addEventListener('release-notes-open', () => {
            this.settings.closeModal();
            this.view.openReleaseNotes();
        });

        this.view.addEventListener('bookmarks-opening', () => {
            this.settings.closeModal();
        });

        const coffeeBtn = document.getElementById(DOMIds.COFFEE_BTN);
        if (coffeeBtn) {
            coffeeBtn.innerHTML = Icons.COFFEE;
            coffeeBtn.addEventListener('click', () => window.open('https://buymeacoffee.com/sousys', '_blank'));
        }

        // Keep the tab bar's New Chat buttons in sync with provider preferences.
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace !== 'sync') return;
            if (!changes[StorageKeys.ENABLED_PROVIDERS]) return;
            const next = changes[StorageKeys.ENABLED_PROVIDERS].newValue;
            if (next && typeof next === 'object') {
                this.enabledMap = { ...next };
                this.view.setEnabledProviders(filterEnabled(this.enabledMap));
            }
        });

        // Listen for STATE_CHANGED messages from provider content scripts.
        window.addEventListener('message', (event) => {
            const provider = getProviderByOrigin(event.origin);
            if (!provider) return; // Unknown origin — drop silently.

            const data = event.data;
            if (!data || data.type !== MessageTypes.STATE_CHANGED) return;

            // Defense-in-depth: payload providerId must agree with origin.
            if (data.providerId && data.providerId !== provider.id) {
                console.warn('STATE_CHANGED providerId/origin mismatch, dropping');
                return;
            }

            const { tabId, url, title, isAutoRedirect } = data;
            if (!tabId) return;

            const existingTab = this.state.getTabs().find(t => t.id === tabId);

            // Provider-match check MUST run before broken-link check; otherwise
            // a stray message from one provider's iframe could falsely mark a
            // different provider's bookmark as broken (LinkValidator would be
            // called with the wrong intendedUrl/newChatRoutes pairing).
            if (existingTab && existingTab.provider !== provider.id) {
                console.warn('STATE_CHANGED for tab with mismatched provider, dropping');
                return;
            }

            if (existingTab && provider.autoRedirectsDeletedChats) {
                const broken = LinkValidator.isBrokenLink({
                    isAutoRedirect,
                    intendedUrl: existingTab.url,
                    newChatRoutes: provider.routes && provider.routes.newChat
                });
                if (broken) {
                    this.bookmarks.markBroken(existingTab.url, true);
                    return; // Do NOT update the URL in the store.
                }
            }

            this.state.updateTabUrl(tabId, url);
            if (title) this.state.updateTabTitle(tabId, title);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new App().start();
});
