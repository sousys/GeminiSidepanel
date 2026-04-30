import { StorageKeys, Timeouts } from './config.js';
import { generateId } from './utils.js';
import { getProviderById } from './provider-registry.js';

/**
 * @typedef {Object} Tab
 * @property {string} id          - Unique id (crypto.randomUUID())
 * @property {string} title       - Conversation title or provider default
 * @property {string} url         - Current iframe URL
 * @property {number} lastActive  - Timestamp; used for inactivity unloading
 * @property {string} provider    - Provider id (e.g. 'gemini', 'chatgpt')
 * @property {boolean} [broken]   - Set when a deep link auto-redirected
 */

export class StateManager {
    /**
     * @param {Object} [options]
     * @param {() => string} [options.resolveDefaultProvider] - Returns provider id
     *   to use when addTab() is called without an explicit providerId. Should be
     *   wired by the App layer to consult the user's enabled-providers preference.
     */
    constructor({ resolveDefaultProvider } = {}) {
        this.tabs = [];
        this.activeTabId = null;
        this.listeners = [];
        this.saveDebounceTimer = null;
        this.resolveDefaultProvider = typeof resolveDefaultProvider === 'function'
            ? resolveDefaultProvider
            : () => null;

        // Cached locally so save() doesn't need to read storage on every debounced write.
        this.persistenceEnabled = true;
        // Guard against the constructor's empty `tabs = []` being written to
        // storage if pagehide fires before init() finishes loading.
        this.initialized = false;

        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync' && changes[StorageKeys.PERSISTENCE_PREF]) {
                this.persistenceEnabled = changes[StorageKeys.PERSISTENCE_PREF].newValue !== false;
            }
        });

        // Flush any pending debounced write before the side panel is closed.
        window.addEventListener('pagehide', () => this.flush());
    }

    async init() {
        try {
            const prefData = await chrome.storage.sync.get([StorageKeys.PERSISTENCE_PREF]);
            this.persistenceEnabled = prefData[StorageKeys.PERSISTENCE_PREF] !== false;
        } catch (error) {
            console.error('Failed to read persistence preference, defaulting to enabled:', error);
            this.persistenceEnabled = true;
        }

        if (!this.persistenceEnabled) {
            this.tabs = [];
            this.activeTabId = null;
            this.initialized = true;
            this.notify();
            return;
        }

        let data;
        try {
            data = await chrome.storage.local.get([StorageKeys.TABS, StorageKeys.ACTIVE_TAB]);
        } catch (error) {
            console.error('Failed to load tabs from storage, starting empty:', error);
            this.tabs = [];
            this.activeTabId = null;
            this.initialized = true;
            this.notify();
            return;
        }

        const rawTabs = Array.isArray(data[StorageKeys.TABS]) ? data[StorageKeys.TABS] : [];
        const originalCount = rawTabs.length;

        // Validate each entry. Discard anything malformed or referencing an
        // unknown provider (no backwards compatibility — provider field is required).
        const validTabs = rawTabs.filter(t =>
            t && typeof t === 'object' &&
            typeof t.id === 'string' && t.id.length > 0 &&
            typeof t.url === 'string' && t.url.length > 0 &&
            typeof t.title === 'string' &&
            typeof t.provider === 'string' && t.provider.length > 0 &&
            getProviderById(t.provider) !== null
        );

        const discarded = originalCount - validTabs.length;
        if (discarded > 0) {
            console.warn(`StateManager: discarded ${discarded} malformed tab entries from storage.`);
        }

        const filteredTabs = validTabs.filter(t => !t.url.startsWith('chrome-extension://'));

        this.activeTabId = (typeof data[StorageKeys.ACTIVE_TAB] === 'string')
            ? data[StorageKeys.ACTIVE_TAB]
            : null;

        const seenIds = new Set();
        let stateChanged = discarded > 0 || filteredTabs.length !== originalCount;

        const newTabs = filteredTabs.map(tab => {
            let updatedTab = tab;
            if (!updatedTab.lastActive) {
                updatedTab = { ...updatedTab, lastActive: Date.now() };
                stateChanged = true;
            }
            if (seenIds.has(updatedTab.id)) {
                updatedTab = { ...updatedTab, id: generateId() };
                stateChanged = true;
            }
            seenIds.add(updatedTab.id);
            return updatedTab;
        });

        this.tabs = newTabs;

        const activeTabExists = this.tabs.some(t => t.id === this.activeTabId);
        if (this.tabs.length > 0 && !activeTabExists) {
            this.activeTabId = this.tabs[0].id;
            stateChanged = true;
        } else if (this.tabs.length === 0 && this.activeTabId) {
            this.activeTabId = null;
            stateChanged = true;
        }

        if (stateChanged) {
            this.save();
        }

        this.initialized = true;
        this.notify();
    }

    subscribe(listener) {
        this.listeners.push(listener);
    }

    notify() {
        this.listeners.forEach(cb => cb(this.tabs, this.activeTabId));
    }

    save() {
        if (this.saveDebounceTimer) clearTimeout(this.saveDebounceTimer);

        this.saveDebounceTimer = setTimeout(async () => {
            this.saveDebounceTimer = null;
            if (!this.persistenceEnabled) return;

            try {
                const tabsToSave = this.tabs.filter(t => !t.url.startsWith('chrome-extension://'));
                await chrome.storage.local.set({
                    [StorageKeys.TABS]: tabsToSave,
                    [StorageKeys.ACTIVE_TAB]: this.activeTabId
                });
            } catch (error) {
                console.error('Failed to persist tabs to storage:', error);
            }
        }, 500);
    }

    /**
     * Synchronously cancel any pending debounced save and write the current
     * state immediately. Called on pagehide to avoid losing the last edits
     * when the side panel is closed.
     */
    flush() {
        if (!this.initialized) return;

        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer);
            this.saveDebounceTimer = null;
        }
        if (!this.persistenceEnabled) return;

        try {
            const tabsToSave = this.tabs.filter(t => !t.url.startsWith('chrome-extension://'));
            chrome.storage.local.set({
                [StorageKeys.TABS]: tabsToSave,
                [StorageKeys.ACTIVE_TAB]: this.activeTabId
            }).catch(err => console.error('flush() failed:', err));
        } catch (error) {
            console.error('flush() threw:', error);
        }
    }

    getTabs() {
        return this.tabs;
    }

    getActiveTabId() {
        return this.activeTabId;
    }

    getActiveTab() {
        return this.tabs.find(t => t.id === this.activeTabId);
    }

    /**
     * Creates a new tab. providerId is required in practice — if omitted, the
     * resolveDefaultProvider callback supplied at construction time is used.
     * Title and URL default to the provider's defaults if not supplied.
     *
     * @returns {string|null} New tab id, or null if no provider could be resolved.
     */
    addTab(title, url, providerId) {
        const resolvedId = providerId || this.resolveDefaultProvider();
        const provider = resolvedId ? getProviderById(resolvedId) : null;
        if (!provider) {
            console.error('StateManager.addTab: cannot resolve provider', { providerId, resolvedId });
            return null;
        }

        const newId = generateId();
        const newTab = {
            id: newId,
            title: title || provider.defaultTitle,
            url: url || provider.newChatUrl,
            lastActive: Date.now(),
            provider: provider.id
        };

        this.tabs = [newTab, ...this.tabs];
        this.activeTabId = newId;

        this.save();
        this.notify();
        return newId;
    }

    removeTab(id) {
        const index = this.tabs.findIndex(t => t.id === id);
        if (index === -1) return;

        this.tabs = this.tabs.filter(t => t.id !== id);

        if (id === this.activeTabId) {
            if (this.tabs.length > 0) {
                const newIndex = Math.max(0, index - 1);
                const safeIndex = Math.min(newIndex, this.tabs.length - 1);
                this.activeTabId = this.tabs[safeIndex].id;
            } else {
                this.activeTabId = null;
            }
        }

        this.save();
        this.notify();
    }

    setActiveTab(id) {
        if (this.activeTabId === id) return;

        const oldTabId = this.activeTabId;
        this.activeTabId = id;

        const now = Date.now();
        this.tabs = this.tabs.map(t => {
            if (t.id === id || t.id === oldTabId) {
                return { ...t, lastActive: now };
            }
            return t;
        });

        this.save();
        this.notify();
    }

    updateTabUrl(id, url) {
        const index = this.tabs.findIndex(t => t.id === id);
        if (index === -1) return;

        const tab = this.tabs[index];
        if (tab.url !== url) {
            const updatedTab = { ...tab, url };
            this.tabs = [
                ...this.tabs.slice(0, index),
                updatedTab,
                ...this.tabs.slice(index + 1)
            ];
            this.save();
            this.notify();
        }
    }

    updateTabTitle(id, title) {
        const index = this.tabs.findIndex(t => t.id === id);
        if (index === -1) return;

        const tab = this.tabs[index];
        if (tab.title !== title) {
            const updatedTab = { ...tab, title };
            this.tabs = [
                ...this.tabs.slice(0, index),
                updatedTab,
                ...this.tabs.slice(index + 1)
            ];
            this.save();
            this.notify();
        }
    }

    /**
     * Reorder tabs by moving `draggedId` relative to `targetId`.
     * Does not modify lastActive (reordering is not activation).
     *
     * @param {string} draggedId
     * @param {string} targetId
     * @param {'before'|'after'} position
     */
    reorderTabs(draggedId, targetId, position) {
        if (!draggedId || !targetId || draggedId === targetId) return;
        if (position !== 'before' && position !== 'after') return;

        const draggedTab = this.tabs.find(t => t.id === draggedId);
        const targetIndex = this.tabs.findIndex(t => t.id === targetId);
        if (!draggedTab || targetIndex === -1) return;

        const without = this.tabs.filter(t => t.id !== draggedId);
        // Recompute target index in the filtered array.
        const newTargetIndex = without.findIndex(t => t.id === targetId);
        if (newTargetIndex === -1) return;

        const insertAt = position === 'before' ? newTargetIndex : newTargetIndex + 1;
        const next = [
            ...without.slice(0, insertAt),
            draggedTab,
            ...without.slice(insertAt)
        ];

        // No-op if order unchanged.
        const orderUnchanged = next.every((t, i) => t.id === this.tabs[i].id);
        if (orderUnchanged) return;

        this.tabs = next;
        this.save();
        this.notify();
    }

    shouldKeepTabLoaded(tab) {
        if (tab.id === this.activeTabId) return true;
        const timeDiff = Date.now() - (tab.lastActive || Date.now());
        return timeDiff <= Timeouts.INACTIVITY_LIMIT;
    }
}
