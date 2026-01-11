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

    render(container) {
        container.insertAdjacentHTML('beforeend', this.getTemplate());
    }

    getTemplate() {
        return `
            <div id="bookmarksModal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Bookmarks</h2>
                        <button id="closeModalBtn" class="modal-close-btn">&times;</button>
                    </div>
                    <div id="bookmarksList">
                        <!-- Bookmarks will be populated here -->
                    </div>
                </div>
            </div>

            <div id="editBookmarkDialog" class="edit-dialog-overlay">
                <div class="edit-dialog-content">
                    <div class="edit-dialog-header">Edit Bookmark</div>
                    
                    <div class="edit-form-group">
                        <label class="edit-form-label">Name</label>
                        <input type="text" id="editBookmarkTitle" class="edit-form-input">
                    </div>
                    
                    <div class="edit-form-group">
                        <label class="edit-form-label">URL</label>
                        <input type="text" id="editBookmarkUrl" class="edit-form-input" readonly>
                    </div>

                    <div class="edit-dialog-actions">
                        <button id="cancelEditBtn" class="btn btn-secondary">Cancel</button>
                        <button id="saveEditBtn" class="btn btn-primary">Save</button>
                    </div>
                </div>
            </div>

            <div id="deleteConfirmDialog" class="edit-dialog-overlay">
                <div class="edit-dialog-content" style="width: 250px;">
                    <div class="edit-dialog-header">Delete Bookmark?</div>
                    <div class="edit-form-label" style="margin-bottom: 8px;">Are you sure you want to delete this bookmark?</div>
                    <div class="edit-dialog-actions">
                        <button id="cancelDeleteBtn" class="btn btn-secondary">Cancel</button>
                        <button id="confirmDeleteBtn" class="btn btn-primary" style="background: #ff6b6b; color: white;">Delete</button>
                    </div>
                </div>
            </div>
        `;
    }
}