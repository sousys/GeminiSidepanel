import { CSSClasses, Timeouts, Permissions, MessageTypes } from '../core/config.js';

export class IframeHandler {
    constructor() {
        this.contentArea = null;
        this.loadingQueue = new Set();
        this.loadingInterval = null;
        this.currentTabs = [];
    }

    init(element) {
        this.contentArea = element;
    }

    render(tabs, activeTabId) {
        this.currentTabs = tabs;
        
        // Remove iframes for deleted tabs
        const currentIframes = Array.from(this.contentArea.querySelectorAll('iframe'));
        currentIframes.forEach(iframe => {
            const tabId = iframe.getAttribute('data-tab-id');
            if (!tabs.find(t => t.id === tabId)) {
                iframe.remove();
                this.loadingQueue.delete(tabId);
            }
        });

        // Create iframes for new tabs or update existing
        tabs.forEach(tab => {
            let iframe = this.contentArea.querySelector(`iframe[data-tab-id="${tab.id}"]`);
            const isActive = tab.id === activeTabId;
            const isRecent = (Date.now() - (tab.lastActive || Date.now()) <= Timeouts.INACTIVITY_LIMIT);

            // Always create the iframe element if it's active or recent, 
            // even if we don't set the SRC yet (to reserve the DOM slot/state)
            if (!iframe && (isActive || isRecent)) {
                iframe = document.createElement('iframe');
                iframe.setAttribute('data-tab-id', tab.id);
                iframe.name = tab.id; 
                iframe.frameBorder = "0";
                iframe.allow = Permissions.IFRAME; 
                this.contentArea.appendChild(iframe);
            }

            if (iframe) {
                if (isActive) {
                    // Active tab: Load IMMEDIATELY and remove from background queue
                    this.loadingQueue.delete(tab.id);
                    if (!iframe.getAttribute('src')) {
                        iframe.src = tab.url;
                    }
                    iframe.classList.add(CSSClasses.ACTIVE);
                } else {
                    iframe.classList.remove(CSSClasses.ACTIVE);
                    
                    if (isRecent) {
                        // Recent tab: Check if loaded
                        if (!iframe.getAttribute('src')) {
                            // Not loaded? Queue it for background loading
                            this.loadingQueue.add(tab.id);
                        }
                    } else {
                        // Old tab: Unload and remove from queue
                        iframe.remove();
                        this.loadingQueue.delete(tab.id);
                    }
                }
            }
        });

        this.processLoadingQueue();
    }

    processLoadingQueue() {
        // This queue exists to lazy-load background tabs to save memory.
        // We process one tab every few seconds to avoid overwhelming the browser.

        if (this.loadingInterval) return; // Already running
        
        // If queue is empty, no need to start interval
        if (this.loadingQueue.size === 0) return;

        this.loadingInterval = setInterval(() => {
            if (this.loadingQueue.size === 0) {
                clearInterval(this.loadingInterval);
                this.loadingInterval = null;
                return;
            }

            // Get next tab ID from queue
            const nextId = this.loadingQueue.values().next().value;
            this.loadingQueue.delete(nextId);

            const tab = this.currentTabs.find(t => t.id === nextId);
            const iframe = this.contentArea.querySelector(`iframe[data-tab-id="${nextId}"]`);

            // Only load if it still exists, isn't loaded, and matches current data
            if (tab && iframe && !iframe.getAttribute('src')) {
                iframe.src = tab.url;
            }

        }, 1500); // Load one tab every 1.5 seconds
    }

    checkTabState(id) {
        const activeIframe = this.contentArea.querySelector(`iframe[data-tab-id="${id}"]`);
        if (activeIframe && activeIframe.contentWindow) {
            activeIframe.contentWindow.postMessage({ type: MessageTypes.CHECK_STATE }, '*');
        }
    }
}
