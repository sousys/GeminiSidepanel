import { CSSClasses, Timeouts, Permissions, MessageTypes } from '../core/config.js';
import { getProviderById } from '../core/provider-registry.js';

export class IframeHandler {
    constructor() {
        this.contentArea = null;
        this.loadingQueue = new Set();
        this.loadingInterval = null;
        this.currentTabs = [];
        this.statePollInterval = null;
        this.onVisibilityChange = this.onVisibilityChange.bind(this);
    }

    init(element) {
        this.contentArea = element;
        document.addEventListener('visibilitychange', this.onVisibilityChange);
        if (document.visibilityState !== 'hidden') {
            this.startStatePolling();
        }
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

        tabs.forEach(tab => {
            let iframe = this.contentArea.querySelector(`iframe[data-tab-id="${tab.id}"]`);
            const isActive = tab.id === activeTabId;
            const isRecent = (Date.now() - (tab.lastActive || Date.now()) <= Timeouts.INACTIVITY_LIMIT);

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
                    this.loadingQueue.delete(tab.id);
                    if (!iframe.getAttribute('src')) {
                        iframe.src = tab.url;
                    }
                    iframe.classList.add(CSSClasses.ACTIVE);
                } else {
                    iframe.classList.remove(CSSClasses.ACTIVE);
                    if (isRecent) {
                        if (!iframe.getAttribute('src')) {
                            this.loadingQueue.add(tab.id);
                        }
                    } else {
                        iframe.remove();
                        this.loadingQueue.delete(tab.id);
                    }
                }
            }
        });

        this.processLoadingQueue();
    }

    processLoadingQueue() {
        if (this.loadingInterval) return;
        if (this.loadingQueue.size === 0) return;

        this.loadingInterval = setInterval(() => {
            if (this.loadingQueue.size === 0) {
                clearInterval(this.loadingInterval);
                this.loadingInterval = null;
                return;
            }

            const nextId = this.loadingQueue.values().next().value;
            this.loadingQueue.delete(nextId);

            const tab = this.currentTabs.find(t => t.id === nextId);
            const iframe = this.contentArea.querySelector(`iframe[data-tab-id="${nextId}"]`);

            if (tab && iframe && !iframe.getAttribute('src')) {
                iframe.src = tab.url;
            }
        }, 1500);
    }

    /**
     * Asks a tab's content script to re-report its current state.
     * postMessage targetOrigin is resolved from the tab's provider config so
     * we never broadcast to '*'.
     */
    checkTabState(id) {
        const iframe = this.contentArea.querySelector(`iframe[data-tab-id="${id}"]`);
        const tab = this.currentTabs.find(t => t.id === id);
        this.postCheckState(iframe, tab);
    }

    /**
     * Pings every mounted iframe with CHECK_STATE. Used by the periodic poll
     * to catch SPA navigations that in-iframe observers miss (notably
     * ChatGPT, whose React DOM is too volatile to observe reliably).
     */
    checkAllTabStates() {
        if (!this.contentArea) return;
        this.currentTabs.forEach(tab => {
            const iframe = this.contentArea.querySelector(`iframe[data-tab-id="${tab.id}"]`);
            this.postCheckState(iframe, tab);
        });
    }

    /**
     * Internal: posts a CHECK_STATE message to a single iframe if it is
     * mounted, has a contentWindow, and is currently sitting on the provider
     * origin (not still on about:blank during the load gap).
     */
    postCheckState(iframe, tab) {
        if (!iframe || !iframe.contentWindow || !tab || !tab.url) return;

        const provider = getProviderById(tab.provider);
        if (!provider) return; // Defensive: store should have rejected unknown providers.

        // postMessage with a mismatched targetOrigin does NOT throw — it
        // logs a console error and drops the message, so a try/catch around
        // the postMessage call is not enough. Same-origin access to
        // contentWindow.location.href succeeds; cross-origin access throws
        // a SecurityError. Use that as the signal: only post when access
        // throws (== iframe has navigated to the provider origin).
        let isCrossOrigin = false;
        try {
            // Touching .href triggers the cross-origin check.
            void iframe.contentWindow.location.href;
        } catch (_) {
            isCrossOrigin = true;
        }
        if (!isCrossOrigin) return; // Still on about:blank / extension origin.

        try {
            iframe.contentWindow.postMessage(
                { type: MessageTypes.CHECK_STATE },
                provider.origin
            );
        } catch (_) {
            // Iframe may still be loading — safe to ignore.
        }
    }

    startStatePolling() {
        if (this.statePollInterval) return;
        this.statePollInterval = setInterval(
            () => this.checkAllTabStates(),
            Timeouts.STATE_POLL_INTERVAL_MS
        );
    }

    stopStatePolling() {
        if (!this.statePollInterval) return;
        clearInterval(this.statePollInterval);
        this.statePollInterval = null;
    }

    onVisibilityChange() {
        if (document.visibilityState === 'hidden') {
            this.stopStatePolling();
        } else {
            // Catch up immediately on becoming visible, then resume polling.
            this.checkAllTabStates();
            this.startStatePolling();
        }
    }
}
