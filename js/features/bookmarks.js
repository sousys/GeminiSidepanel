import { StorageKeys } from '../core/config.js';
import { getProviderByUrl } from '../core/provider-registry.js';

export class BookmarksManager extends EventTarget {
    constructor() {
        super();
        this.bookmarks = [];
    }

    async init() {
        let data;
        try {
            data = await chrome.storage.local.get([StorageKeys.BOOKMARKS]);
        } catch (error) {
            console.error('Failed to load bookmarks from storage, starting empty:', error);
            this.bookmarks = [];
            this.notify();
            return;
        }

        const raw = Array.isArray(data[StorageKeys.BOOKMARKS]) ? data[StorageKeys.BOOKMARKS] : [];
        const valid = raw.filter(b =>
            b && typeof b === 'object' &&
            typeof b.url === 'string' && b.url.length > 0 &&
            typeof b.title === 'string'
        );
        const discarded = raw.length - valid.length;
        if (discarded > 0) {
            console.warn(`BookmarksManager: discarded ${discarded} malformed bookmark entries from storage.`);
        }

        // Migration: backfill `providerId` for bookmarks saved before the
        // field existed. Inferred from the bookmark URL's origin.
        let migrated = false;
        this.bookmarks = valid.map(b => {
            if (typeof b.providerId === 'string' && b.providerId.length > 0) return b;
            const provider = getProviderByUrl(b.url);
            if (provider) {
                migrated = true;
                return { ...b, providerId: provider.id };
            }
            return b;
        });

        if (migrated) {
            // Persist the migration but emit a single change notification at
            // the end of init() (avoid double-notify on first load).
            await this._persist();
        }
        this.notify();
    }

    notify() {
        this.dispatchEvent(new CustomEvent('bookmarks-changed', { detail: { bookmarks: this.bookmarks } }));
    }

    /**
     * Internal: write the current bookmarks array to storage WITHOUT firing
     * a change notification. Use `save()` for the public mutate-and-notify path.
     */
    async _persist() {
        try {
            await chrome.storage.local.set({
                [StorageKeys.BOOKMARKS]: this.bookmarks
            });
        } catch (error) {
            console.error('Failed to save bookmarks:', error);
        }
    }

    async save() {
        await this._persist();
        this.notify();
    }

    getBookmarks() {
        return this.bookmarks;
    }

    isBookmarked(url) {
        return this.bookmarks.some(b => b.url === url);
    }

    async add(title, url, providerId) {
        if (this.isBookmarked(url)) return;

        // Resolve providerId: prefer explicit caller value, fall back to URL
        // origin lookup so bookmarks added via legacy code paths still get a
        // provider association.
        let resolvedProviderId = (typeof providerId === 'string' && providerId.length > 0)
            ? providerId
            : null;
        if (!resolvedProviderId) {
            const provider = getProviderByUrl(url);
            if (provider) resolvedProviderId = provider.id;
        }

        const entry = { title, url, addedAt: Date.now() };
        if (resolvedProviderId) entry.providerId = resolvedProviderId;

        // Immutable add to keep with the rest of the codebase's pattern.
        this.bookmarks = [...this.bookmarks, entry];
        await this.save();
    }

    async remove(url) {
        this.bookmarks = this.bookmarks.filter(b => b.url !== url);
        await this.save();
    }

    async toggle(title, url, providerId) {
        if (this.isBookmarked(url)) {
            await this.remove(url);
            return false; // removed
        } else {
            await this.add(title, url, providerId);
            return true; // added
        }
    }

    async update(url, newTitle) {
        let changed = false;
        this.bookmarks = this.bookmarks.map(b => {
            if (b.url === url && b.title !== newTitle) {
                changed = true;
                return { ...b, title: newTitle };
            }
            return b;
        });
        if (changed) await this.save();
    }

    async markBroken(url, isBroken) {
        let changed = false;
        this.bookmarks = this.bookmarks.map(b => {
            if (b.url === url && !!b.broken !== isBroken) {
                changed = true;
                return { ...b, broken: isBroken };
            }
            return b;
        });
        if (changed) await this.save();
    }

    async clearBrokenFlags() {
        let changed = false;
        this.bookmarks = this.bookmarks.map(b => {
            if (b.broken) {
                changed = true;
                return { ...b, broken: false };
            }
            return b;
        });

        if (changed) {
            await this.save();
        }
    }
}