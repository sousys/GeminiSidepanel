const STORAGE_KEY_TABS = 'gemini_tabs';
const STORAGE_KEY_ACTIVE = 'gemini_active_tab';

const State = {
    tabs: [],
    activeTabId: null,
    listeners: [],

    async init() {
        const data = await chrome.storage.local.get([STORAGE_KEY_TABS, STORAGE_KEY_ACTIVE]);
        this.tabs = data[STORAGE_KEY_TABS] || [];
        this.activeTabId = data[STORAGE_KEY_ACTIVE] || null;

        // Deduplicate IDs to prevent shared iframes (ghost tabs)
        const seenIds = new Set();
        let stateChanged = false;
        this.tabs.forEach(tab => {
            if (seenIds.has(tab.id)) {
                tab.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                stateChanged = true;
            }
            seenIds.add(tab.id);
        });

        if (stateChanged) {
            this.save();
        }

        this.notify();
    },

    subscribe(listener) {
        this.listeners.push(listener);
    },

    notify() {
        this.listeners.forEach(cb => cb(this.tabs, this.activeTabId));
    },

    async save() {
        await chrome.storage.local.set({
            [STORAGE_KEY_TABS]: this.tabs,
            [STORAGE_KEY_ACTIVE]: this.activeTabId
        });
    },

    getTabs() {
        return this.tabs;
    },

    getActiveTabId() {
        return this.activeTabId;
    },

    getActiveTab() {
        return this.tabs.find(t => t.id === this.activeTabId);
    },

    addTab() {
        const newId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        const newTab = {
            id: newId,
            title: 'New',
            url: 'https://gemini.google.com/app'
        };
        
        this.tabs.unshift(newTab);
        this.activeTabId = newId;
        this.save();
        this.notify();
        return newId;
    },

    removeTab(id) {
        const index = this.tabs.findIndex(t => t.id === id);
        if (index === -1) return;

        const tabToRemove = this.tabs[index];

        this.tabs.splice(index, 1);

        if (id === this.activeTabId) {
            if (this.tabs.length > 0) {
                const newIndex = Math.max(0, index - 1);
                this.activeTabId = this.tabs[newIndex].id;
            } else {
                this.activeTabId = null; // UI might decide to create new
            }
        }
        
        this.save();
        this.notify();
    },

    setActiveTab(id) {
        if (this.activeTabId === id) return;
        this.activeTabId = id;
        this.save();
        this.notify();
    },

    updateTabUrl(id, url) {
        const tab = this.tabs.find(t => t.id === id);
        // Only update if URL actually changed
        if (tab && tab.url !== url) {
            tab.url = url;
            
            this.save();
            this.notify();
        }
    },

    updateTabTitle(id, title) {
        const tab = this.tabs.find(t => t.id === id);
        if (tab) {
            if (tab.title !== title) {
                tab.title = title;
                this.save();
                this.notify();
            }
        }
    }
};
