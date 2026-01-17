import { StorageKeys } from '../core/config.js';

export class BookmarksManager extends EventTarget {
    constructor() {
        super();
        this.bookmarks = [];
    }

    async init() {
        const data = await chrome.storage.local.get([StorageKeys.BOOKMARKS]);
        this.bookmarks = data[StorageKeys.BOOKMARKS] || [];
        this.notify();
    }

    notify() {
        this.dispatchEvent(new CustomEvent('bookmarks-changed', { detail: { bookmarks: this.bookmarks } }));
    }

    async save() {
        await chrome.storage.local.set({
            [StorageKeys.BOOKMARKS]: this.bookmarks
        });
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

        this.bookmarks.push({ title, url, addedAt: Date.now() });
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
        const index = this.bookmarks.findIndex(b => b.url === url);
        if (index !== -1) {
            this.bookmarks[index].title = newTitle;
            await this.save();
        }
    }

    async markBroken(url, isBroken) {
        const index = this.bookmarks.findIndex(b => b.url === url);
        if (index !== -1) {
            // Only save if the state actually changes
            if (!!this.bookmarks[index].broken !== isBroken) {
                this.bookmarks[index].broken = isBroken;
                await this.save();
            }
        }
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