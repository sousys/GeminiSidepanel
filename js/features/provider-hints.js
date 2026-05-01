/**
 * Per-provider one-time UI hint dismissal state.
 *
 * Currently used by the iframe first-run hint strip rendered above
 * limited-scope providers (e.g. Claude). Backed by chrome.storage.local
 * (NOT sync) — the hint is purely a UI affordance and shouldn't waste
 * sync quota.
 *
 * Pattern of use:
 *   1. App.start() awaits ProviderHints.load() once at boot.
 *   2. Render code reads ProviderHints.isDismissed(id) synchronously.
 *   3. The dismiss button calls ProviderHints.dismiss(id) which writes-
 *      through to storage and triggers an in-memory cache update.
 */
const STORAGE_KEY = 'dismissedProviderHints';

class ProviderHintsStore extends EventTarget {
    constructor() {
        super();
        this._cache = null; // { [providerId]: true }
        this._loaded = false;
    }

    async load() {
        if (this._loaded) return;
        try {
            const data = await chrome.storage.local.get([STORAGE_KEY]);
            const stored = data[STORAGE_KEY];
            this._cache = (stored && typeof stored === 'object') ? { ...stored } : {};
        } catch (error) {
            console.warn('ProviderHints.load failed, starting fresh:', error);
            this._cache = {};
        }
        this._loaded = true;

        // Cross-context sync: another side panel instance dismissing/resetting
        // a hint should propagate to ours so the strip mirrors immediately.
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace !== 'local' || !changes[STORAGE_KEY]) return;
            const next = changes[STORAGE_KEY].newValue;
            this._cache = (next && typeof next === 'object') ? { ...next } : {};
            this.dispatchEvent(new CustomEvent('hints-changed'));
        });
    }

    isDismissed(providerId) {
        if (!this._loaded || !providerId) return false;
        return this._cache[providerId] === true;
    }

    async dismiss(providerId) {
        if (!providerId) return;
        // Optimistic in-memory update so callers can re-render immediately.
        this._cache = { ...(this._cache || {}), [providerId]: true };
        try {
            await chrome.storage.local.set({ [STORAGE_KEY]: this._cache });
        } catch (error) {
            console.error('ProviderHints.dismiss failed:', error);
        }
        this.dispatchEvent(new CustomEvent('hints-changed'));
    }

    async resetAll() {
        this._cache = {};
        try {
            await chrome.storage.local.set({ [STORAGE_KEY]: {} });
        } catch (error) {
            console.error('ProviderHints.resetAll failed:', error);
        }
        this.dispatchEvent(new CustomEvent('hints-changed'));
    }
}

export const ProviderHints = new ProviderHintsStore();
