import { CSSClasses, Timeouts, Permissions, MessageTypes } from '../core/config.js';
import { getProviderById } from '../core/provider-registry.js';
import { ProviderHints } from '../features/provider-hints.js';

export class IframeHandler {
    constructor() {
        this.contentArea = null;
        this.loadingQueue = new Set();
        this.loadingInterval = null;
        this.currentTabs = [];
        this.statePollInterval = null;
        this.onVisibilityChange = this.onVisibilityChange.bind(this);

        // Re-render hint strips whenever a hint is dismissed/reset elsewhere.
        ProviderHints.addEventListener('hints-changed', () => {
            this._refreshAllHintStrips();
        });
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

        // Remove wrappers (and their iframes) for deleted tabs.
        const currentWrappers = Array.from(
            this.contentArea.querySelectorAll('.tab-content-wrapper')
        );
        currentWrappers.forEach(wrapper => {
            const tabId = wrapper.getAttribute('data-tab-id');
            if (!tabs.find(t => t.id === tabId)) {
                wrapper.remove();
                this.loadingQueue.delete(tabId);
            }
        });

        tabs.forEach(tab => {
            let wrapper = this._getWrapper(tab.id);
            const isActive = tab.id === activeTabId;
            const isRecent = (Date.now() - (tab.lastActive || Date.now()) <= Timeouts.INACTIVITY_LIMIT);

            if (!wrapper && (isActive || isRecent)) {
                wrapper = this._createWrapper(tab);
                this.contentArea.appendChild(wrapper);
            }

            if (wrapper) {
                this._refreshHintStrip(wrapper, tab);
                const iframe = wrapper.querySelector('iframe');
                if (isActive) {
                    this.loadingQueue.delete(tab.id);
                    if (iframe && !iframe.getAttribute('src')) {
                        iframe.src = tab.url;
                    }
                    wrapper.classList.add(CSSClasses.ACTIVE);
                } else {
                    wrapper.classList.remove(CSSClasses.ACTIVE);
                    if (isRecent) {
                        if (iframe && !iframe.getAttribute('src')) {
                            this.loadingQueue.add(tab.id);
                        }
                    } else {
                        wrapper.remove();
                        this.loadingQueue.delete(tab.id);
                    }
                }
            }
        });

        this.processLoadingQueue();
    }

    _getWrapper(tabId) {
        if (!this.contentArea) return null;
        return this.contentArea.querySelector(
            `.tab-content-wrapper[data-tab-id="${CSS.escape(tabId)}"]`
        );
    }

    _createWrapper(tab) {
        const wrapper = document.createElement('div');
        wrapper.className = 'tab-content-wrapper';
        wrapper.setAttribute('data-tab-id', tab.id);

        const iframe = document.createElement('iframe');
        iframe.setAttribute('data-tab-id', tab.id);
        iframe.name = tab.id;
        iframe.frameBorder = '0';
        iframe.allow = Permissions.IFRAME;
        wrapper.appendChild(iframe);

        return wrapper;
    }

    /**
     * Add or remove the first-run limited-provider hint strip on a wrapper
     * based on (a) whether the tab's provider declares a `limitations.hint`
     * and (b) whether the user has dismissed that provider's hint.
     */
    _refreshHintStrip(wrapper, tab) {
        const provider = getProviderById(tab && tab.provider);
        const shouldShow = !!(
            provider &&
            provider.limited &&
            provider.limitations &&
            provider.limitations.hint &&
            !ProviderHints.isDismissed(provider.id)
        );

        const existing = wrapper.querySelector(':scope > .provider-hint-strip');
        if (!shouldShow) {
            if (existing) existing.remove();
            return;
        }
        if (existing) return; // Already shown; nothing to do.

        const strip = document.createElement('div');
        strip.className = 'provider-hint-strip';
        strip.setAttribute('role', 'status');
        strip.setAttribute('data-provider-id', provider.id);

        const text = document.createElement('span');
        text.className = 'provider-hint-text';
        text.textContent = provider.limitations.hint;
        strip.appendChild(text);

        const dismiss = document.createElement('button');
        dismiss.type = 'button';
        dismiss.className = 'provider-hint-dismiss';
        dismiss.textContent = 'Got it';
        dismiss.setAttribute('aria-label', `Dismiss ${provider.name} hint`);
        dismiss.addEventListener('click', () => {
            // Animate out, then dismiss in storage (which fires hints-changed
            // and re-renders all strips for this provider). Multiple
            // transition properties + a fallback timer can each call
            // finalize, so guard with a single-fire flag.
            if (strip._dismissing) return;
            strip._dismissing = true;
            strip.classList.add('provider-hint-strip--leaving');
            let fired = false;
            const finalize = () => {
                if (fired) return;
                fired = true;
                strip.removeEventListener('transitionend', finalize);
                ProviderHints.dismiss(provider.id);
            };
            strip.addEventListener('transitionend', finalize);
            // Fallback in case transitionend never fires (e.g. reduced motion).
            setTimeout(finalize, 400);
        });
        strip.appendChild(dismiss);

        wrapper.insertBefore(strip, wrapper.firstChild);
    }

    /**
     * Re-evaluate hint strips on every wrapper. Triggered by the
     * ProviderHints store when a hint is dismissed/reset somewhere.
     */
    _refreshAllHintStrips() {
        if (!this.contentArea) return;
        this.currentTabs.forEach(tab => {
            const wrapper = this._getWrapper(tab.id);
            if (wrapper) this._refreshHintStrip(wrapper, tab);
        });
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
