import { StorageKeys, Defaults, Timeouts } from './constants.js';
import { generateId } from './utils.js';

export class StateManager {
    constructor() {
        this.tabs = [];
        this.activeTabId = null;
        this.listeners = [];
        this.saveDebounceTimer = null;
    }

    async init() {
        const data = await chrome.storage.local.get([StorageKeys.TABS, StorageKeys.ACTIVE_TAB]);
        this.tabs = data[StorageKeys.TABS] || [];
        this.activeTabId = data[StorageKeys.ACTIVE_TAB] || null;

        // Deduplicate IDs
        const seenIds = new Set();
        let stateChanged = false;
        
        const newTabs = this.tabs.map(tab => {
            // Ensure lastActive exists
            if (!tab.lastActive) {
                tab.lastActive = Date.now();
                stateChanged = true;
            }

            if (seenIds.has(tab.id)) {
                stateChanged = true;
                return { ...tab, id: generateId() };
            }
            seenIds.add(tab.id);
            return tab;
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
            await chrome.storage.local.set({
                [StorageKeys.TABS]: this.tabs,
                [StorageKeys.ACTIVE_TAB]: this.activeTabId
            });
        }, 500); // 500ms debounce
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

    addTab() {
        const newId = generateId();
        const newTab = {
            id: newId,
            title: Defaults.NEW_TAB_TITLE,
            url: Defaults.NEW_TAB_URL,
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