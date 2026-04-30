import { StorageKeys, Defaults, Timeouts } from './config.js';
import { generateId } from './utils.js';

export class StateManager {
    constructor() {
        this.tabs = [];
        this.activeTabId = null;
        this.listeners = [];
        this.saveDebounceTimer = null;
        // Cached locally so save() doesn't need to read storage on every debounced write.
        // Default to true; init() will refresh, and onChanged keeps it in sync.
        this.persistenceEnabled = true;
        // Guard against the constructor's empty `tabs = []` being written to
        // storage if pagehide fires before init() finishes loading.
        this.initialized = false;

        // Keep cached preference fresh if changed elsewhere (e.g. Settings page).
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync' && changes[StorageKeys.PERSISTENCE_PREF]) {
                this.persistenceEnabled = changes[StorageKeys.PERSISTENCE_PREF].newValue !== false;
            }
        });

        // Flush any pending debounced write before the side panel is closed.
        // pagehide is the only reliable lifecycle hook in the side panel context.
        // Registered in the constructor (not init) so we never miss an immediate
        // close; the `initialized` flag in flush() handles the not-yet-loaded case.
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

        // Defensive: stored value may be missing, null, or corrupted to a non-array.
        const rawTabs = Array.isArray(data[StorageKeys.TABS]) ? data[StorageKeys.TABS] : [];
        const originalCount = rawTabs.length;

        // Validate each entry before trusting it. Discard anything malformed.
        const validTabs = rawTabs.filter(t =>
            t && typeof t === 'object' &&
            typeof t.id === 'string' && t.id.length > 0 &&
            typeof t.url === 'string' && t.url.length > 0 &&
            typeof t.title === 'string'
        );

        const discarded = originalCount - validTabs.length;
        if (discarded > 0) {
            console.warn(`StateManager: discarded ${discarded} malformed tab entries from storage.`);
        }

        // Filter out extension pages (like Settings) from previous sessions
        const filteredTabs = validTabs.filter(t => !t.url.startsWith('chrome-extension://'));

        this.activeTabId = (typeof data[StorageKeys.ACTIVE_TAB] === 'string')
            ? data[StorageKeys.ACTIVE_TAB]
            : null;

        // Deduplicate IDs and ensure lastActive — without mutating original entries.
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

        // Ensure activeTabId is valid
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
        }, 500); // 500ms debounce
    }

    /**
     * Synchronously cancel any pending debounced save and write the current
     * state immediately. Called on pagehide so we don't lose the last edits
     * when the side panel is closed.
     */
    flush() {
        // CRITICAL: do nothing until init() has loaded actual state. Otherwise
        // an immediate pagehide (rapid open-then-close) would write the
        // constructor's empty tabs over the user's persisted data.
        if (!this.initialized) return;

        // Clear the timer FIRST so the pending callback can't fire after us.
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer);
            this.saveDebounceTimer = null;
        }
        if (!this.persistenceEnabled) return;

        try {
            const tabsToSave = this.tabs.filter(t => !t.url.startsWith('chrome-extension://'));
            // Fire-and-forget; pagehide can't await.
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

    addTab(title, url) {
        const newId = generateId();
        const newTab = {
            id: newId,
            title: title || Defaults.NEW_TAB_TITLE,
            url: url || Defaults.NEW_TAB_URL,
            lastActive: Date.now()
        };
        
        // Immutable add
        this.tabs = [newTab, ...this.tabs];
        this.activeTabId = newId;
        
        this.save();
        this.notify();
        return newId;
    }

    removeTab(id) {
        const index = this.tabs.findIndex(t => t.id === id);
        if (index === -1) return;

        // Immutable remove
        this.tabs = this.tabs.filter(t => t.id !== id);

        if (id === this.activeTabId) {
            if (this.tabs.length > 0) {
                // If we removed the active tab, select the next available one (or previous)
                const newIndex = Math.max(0, index - 1);
                // Be careful with bounds if index was 0
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
        
        // Update timestamps for both
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
            // Immutable update
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
             // Immutable update
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

    shouldKeepTabLoaded(tab) {
        if (tab.id === this.activeTabId) return true;
        const timeDiff = Date.now() - (tab.lastActive || Date.now());
        return timeDiff <= Timeouts.INACTIVITY_LIMIT;
    }
}