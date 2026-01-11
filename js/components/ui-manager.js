import { DOMIds, CSSClasses } from '../core/config.js';
import { TabBar } from './tabs-ui.js';
import { IframeHandler } from './web-views.js';
import { Icons } from '../core/icons.js';

export class ViewRenderer extends EventTarget {
    constructor() {
        super();
        this.tabBar = new TabBar();
        this.iframeHandler = new IframeHandler();
        
        // UI Elements
        this.bookmarkBtn = null;
        this.toggleBookmarkBtn = null;
        this.bookmarksModal = null;
        this.bookmarksList = null;
        this.closeModalBtn = null;
    }

    init() {
        const tabBarEl = document.getElementById(DOMIds.TAB_BAR);
        const contentAreaEl = document.getElementById(DOMIds.CONTENT_AREA);

        this.tabBar.init(tabBarEl);
        this.iframeHandler.init(contentAreaEl);

        // Forward events
        this.tabBar.addEventListener('tab-switch', (e) => {
            this.dispatchEvent(new CustomEvent('tab-switch', { detail: e.detail }));
            this.iframeHandler.checkTabState(e.detail.id);
        });

        this.tabBar.addEventListener('tab-close', (e) => {
            this.dispatchEvent(new CustomEvent('tab-close', { detail: e.detail }));
        });

        // Initialize Bookmark UI
        this.bookmarkBtn = document.getElementById(DOMIds.BOOKMARK_BTN);
        this.toggleBookmarkBtn = document.getElementById(DOMIds.TOGGLE_BOOKMARK_BTN);
        this.bookmarksModal = document.getElementById(DOMIds.BOOKMARKS_MODAL);
        this.bookmarksList = document.getElementById(DOMIds.BOOKMARKS_LIST);
        this.closeModalBtn = document.getElementById(DOMIds.CLOSE_MODAL_BTN);
        
        // Edit Dialog UI
        this.editDialog = document.getElementById(DOMIds.EDIT_BOOKMARK_DIALOG);
        this.editTitleInput = document.getElementById(DOMIds.EDIT_BOOKMARK_TITLE);
        this.editUrlInput = document.getElementById(DOMIds.EDIT_BOOKMARK_URL);
        this.cancelEditBtn = document.getElementById(DOMIds.CANCEL_EDIT_BTN);
        this.saveEditBtn = document.getElementById(DOMIds.SAVE_EDIT_BTN);
        this.currentEditingUrl = null;

        // Delete Confirm UI
        this.deleteConfirmDialog = document.getElementById(DOMIds.DELETE_CONFIRM_DIALOG);
        this.cancelDeleteBtn = document.getElementById(DOMIds.CANCEL_DELETE_BTN);
        this.confirmDeleteBtn = document.getElementById(DOMIds.CONFIRM_DELETE_BTN);
        this.bookmarkToDelete = null;

        if (this.bookmarkBtn) {
            this.bookmarkBtn.innerHTML = Icons.BOOKMARK_LIST;
            this.bookmarkBtn.addEventListener('click', () => {
                if (this.bookmarksModal && this.bookmarksModal.classList.contains('open')) {
                    this.closeBookmarksModal();
                } else {
                    this.openBookmarksModal();
                }
            });
        }

        if (this.toggleBookmarkBtn) {
            // Initial Icon (Outline)
            this.toggleBookmarkBtn.innerHTML = Icons.BOOKMARK_OUTLINE;
            this.toggleBookmarkBtn.addEventListener('click', () => {
                this.dispatchEvent(new CustomEvent('bookmark-toggle'));
            });
        }

        if (this.closeModalBtn) {
            this.closeModalBtn.addEventListener('click', () => {
                this.closeBookmarksModal();
            });
        }

        // Close modal on outside click
        if (this.bookmarksModal) {
            this.bookmarksModal.addEventListener('click', (e) => {
                if (e.target === this.bookmarksModal) {
                    this.closeBookmarksModal();
                }
            });
        }
        
        // Edit Dialog Events
        if (this.cancelEditBtn) {
            this.cancelEditBtn.addEventListener('click', () => this.closeEditDialog());
        }
        
        if (this.saveEditBtn) {
            this.saveEditBtn.addEventListener('click', () => {
                const newTitle = this.editTitleInput.value.trim();
                if (newTitle && this.currentEditingUrl) {
                    this.dispatchEvent(new CustomEvent('bookmark-update', { 
                        detail: { url: this.currentEditingUrl, title: newTitle } 
                    }));
                    this.closeEditDialog();
                }
            });
        }
        
        if (this.editDialog) {
            this.editDialog.addEventListener('click', (e) => {
                if (e.target === this.editDialog) {
                    this.closeEditDialog();
                }
            });
        }

        // Delete Confirm Events
        if (this.cancelDeleteBtn) {
            this.cancelDeleteBtn.addEventListener('click', () => this.closeDeleteConfirmDialog());
        }

        if (this.confirmDeleteBtn) {
            this.confirmDeleteBtn.addEventListener('click', () => {
                if (this.bookmarkToDelete) {
                    this.dispatchEvent(new CustomEvent('bookmark-delete', { detail: this.bookmarkToDelete }));
                    this.closeDeleteConfirmDialog();
                }
            });
        }

        if (this.deleteConfirmDialog) {
            this.deleteConfirmDialog.addEventListener('click', (e) => {
                if (e.target === this.deleteConfirmDialog) {
                    this.closeDeleteConfirmDialog();
                }
            });
        }
    }

    render(tabs, activeTabId) {
        this.tabBar.render(tabs, activeTabId);
        this.iframeHandler.render(tabs, activeTabId);
    }

    updateBookmarkButton(isBookmarked) {
        if (!this.toggleBookmarkBtn) return;

        if (isBookmarked) {
            this.toggleBookmarkBtn.innerHTML = Icons.BOOKMARK_FILLED;
            this.toggleBookmarkBtn.classList.add(CSSClasses.BOOKMARKED);
        } else {
            this.toggleBookmarkBtn.innerHTML = Icons.BOOKMARK_OUTLINE;
            this.toggleBookmarkBtn.classList.remove(CSSClasses.BOOKMARKED);
        }
    }

    openBookmarksModal() {
        if (this.bookmarksModal) {
            this.bookmarksModal.classList.add('open');
            this.dispatchEvent(new CustomEvent('bookmarks-modal-open'));
        }
    }

    closeBookmarksModal() {
        if (this.bookmarksModal) {
            this.bookmarksModal.classList.remove('open');
        }
    }
    
    openEditDialog(bookmark) {
        if (this.editDialog) {
            this.currentEditingUrl = bookmark.url;
            this.editTitleInput.value = bookmark.title;
            this.editUrlInput.value = bookmark.url;
            this.editDialog.classList.add('open');
            this.editTitleInput.focus();
        }
    }

    closeEditDialog() {
        if (this.editDialog) {
            this.editDialog.classList.remove('open');
            this.currentEditingUrl = null;
        }
    }

    openDeleteConfirmDialog(bookmark) {
        if (this.deleteConfirmDialog) {
            this.bookmarkToDelete = bookmark;
            this.deleteConfirmDialog.classList.add('open');
        }
    }

    closeDeleteConfirmDialog() {
        if (this.deleteConfirmDialog) {
            this.deleteConfirmDialog.classList.remove('open');
            this.bookmarkToDelete = null;
        }
    }

    renderBookmarksList(bookmarks) {
        if (!this.bookmarksList) return;

        this.bookmarksList.innerHTML = '';

        if (bookmarks.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'empty-state';
            emptyEl.textContent = 'No saved chats yet.';
            this.bookmarksList.appendChild(emptyEl);
            return;
        }

        bookmarks.forEach(bookmark => {
            const itemEl = document.createElement('div');
            itemEl.className = 'bookmark-item';

            const titleEl = document.createElement('span');
            titleEl.className = 'bookmark-title';
            titleEl.textContent = bookmark.title;
            titleEl.title = bookmark.title; // Tooltip
            
            // Open bookmark on click
            titleEl.addEventListener('click', () => {
                this.dispatchEvent(new CustomEvent('bookmark-select', { detail: bookmark }));
                this.closeBookmarksModal();
            });

            // Edit Button
            const editBtn = document.createElement('button');
            editBtn.className = 'bookmark-action-btn';
            editBtn.innerHTML = Icons.EDIT;
            editBtn.title = 'Edit';
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openEditDialog(bookmark);
            });

            // Delete Button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'bookmark-action-btn bookmark-delete-btn';
            deleteBtn.innerHTML = Icons.DELETE;
            deleteBtn.title = 'Remove';
            
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openDeleteConfirmDialog(bookmark);
            });

            itemEl.appendChild(titleEl);
            itemEl.appendChild(editBtn);
            itemEl.appendChild(deleteBtn);
            this.bookmarksList.appendChild(itemEl);
        });
    }

    renderBrowser(container) {
        container.insertAdjacentHTML('beforeend', this.getBrowserTemplate());
    }

    getBrowserTemplate() {
        return `
            <div id="content-wrapper">
              <div id="content-area"></div>
              <div id="side-toolbar">
                <button class="toolbar-btn" id="bookmarkBtn" title="Bookmarks"></button>
                <button class="toolbar-btn" id="coffeeBtn" title="Buy me a coffee"></button>
                <button class="toolbar-btn" id="settingsBtn" title="Settings"></button>
              </div>
            </div>
        `;
    }
}