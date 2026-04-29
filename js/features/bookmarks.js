import { StorageKeys } from '../core/config.js';

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
        this.bookmarks = valid;
        this.notify();
    }

    notify() {
        this.dispatchEvent(new CustomEvent('bookmarks-changed', { detail: { bookmarks: this.bookmarks } }));
    }

    async save() {
        try {
            await chrome.storage.local.set({
                [StorageKeys.BOOKMARKS]: this.bookmarks
            });
        } catch (error) {
            console.error('Failed to save bookmarks:', error);
        }
        this.notify();
    }

    getBookmarks() {
        return this.bookmarks;
    }

    isBookmarked(url) {
        return this.bookmarks.some(b => b.url === url);
    }

    async add(title, url) {
        if (this.isBookmarked(url)) return;

        // Immutable add to keep with the rest of the codebase's pattern.
        this.bookmarks = [...this.bookmarks, { title, url, addedAt: Date.now() }];
        await this.save();
    }

    async remove(url) {
        this.bookmarks = this.bookmarks.filter(b => b.url !== url);
        await this.save();
    }

    async toggle(title, url) {
        if (this.isBookmarked(url)) {
            await this.remove(url);
            return false; // removed
        } else {
            await this.add(title, url);
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