import { DOMIds, CSSClasses } from '../core/config.js';
import { Icons } from '../core/icons.js';

export class BookmarksUI extends EventTarget {
    constructor() {
        super();
        this.listElement = null;
        this.modal = null;
        this.closeModalBtn = null;
        
        // Edit Dialog
        this.editDialog = null;
        this.editTitleInput = null;
        this.editUrlInput = null;
        this.cancelEditBtn = null;
        this.saveEditBtn = null;
        this.currentEditingUrl = null;

        // Delete Dialog
        this.deleteConfirmDialog = null;
        this.cancelDeleteBtn = null;
        this.confirmDeleteBtn = null;
        this.bookmarkToDelete = null;
    }

    render(container) {
        container.insertAdjacentHTML('beforeend', this.getTemplate());
    }

    init() {
        // Cache DOM elements
        this.modal = document.getElementById(DOMIds.BOOKMARKS_MODAL);
        this.listElement = document.getElementById(DOMIds.BOOKMARKS_LIST);
        this.closeModalBtn = document.getElementById(DOMIds.CLOSE_MODAL_BTN);

        this.editDialog = document.getElementById(DOMIds.EDIT_BOOKMARK_DIALOG);
        this.editTitleInput = document.getElementById(DOMIds.EDIT_BOOKMARK_TITLE);
        this.editUrlInput = document.getElementById(DOMIds.EDIT_BOOKMARK_URL);
        this.cancelEditBtn = document.getElementById(DOMIds.CANCEL_EDIT_BTN);
        this.saveEditBtn = document.getElementById(DOMIds.SAVE_EDIT_BTN);

        this.deleteConfirmDialog = document.getElementById(DOMIds.DELETE_CONFIRM_DIALOG);
        this.cancelDeleteBtn = document.getElementById(DOMIds.CANCEL_DELETE_BTN);
        this.confirmDeleteBtn = document.getElementById(DOMIds.CONFIRM_DELETE_BTN);

        this.bindEvents();
    }

    bindEvents() {
        // Modal Close
        if (this.closeModalBtn) {
            this.closeModalBtn.addEventListener('click', () => this.closeModal());
        }

        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.closeModal();
                }
            });
        }

        // Edit Dialog
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

        // Delete Dialog
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

    renderList(bookmarks) {
        if (!this.listElement) return;

        this.listElement.innerHTML = '';

        if (bookmarks.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'empty-state';
            emptyEl.textContent = 'No saved chats yet.';
            this.listElement.appendChild(emptyEl);
            return;
        }

        bookmarks.forEach(bookmark => {
            const itemEl = document.createElement('div');
            itemEl.className = 'bookmark-item';
            if (bookmark.broken) {
                itemEl.classList.add('broken');
            }

            const titleEl = document.createElement('span');
            titleEl.className = 'bookmark-title';
            titleEl.textContent = bookmark.title;
            titleEl.title = bookmark.title; // Tooltip
            
            // Open bookmark on click
            titleEl.addEventListener('click', () => {
                this.dispatchEvent(new CustomEvent('bookmark-select', { detail: bookmark }));
                this.closeModal();
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
            this.listElement.appendChild(itemEl);
        });
    }

    openModal() {
        if (this.modal) {
            this.modal.classList.add('open');
            this.dispatchEvent(new CustomEvent('modal-open'));
        }
    }

    closeModal() {
        if (this.modal) {
            this.modal.classList.remove('open');
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

    getTemplate() {
        return `
            <div id="${DOMIds.BOOKMARKS_MODAL}" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Bookmarks</h2>
                        <button id="${DOMIds.CLOSE_MODAL_BTN}" class="modal-close-btn">&times;</button>
                    </div>
                    <div id="${DOMIds.BOOKMARKS_LIST}">
                        <!-- Bookmarks will be populated here -->
                    </div>
                </div>
            </div>

            <div id="${DOMIds.EDIT_BOOKMARK_DIALOG}" class="edit-dialog-overlay">
                <div class="edit-dialog-content">
                    <div class="edit-dialog-header">Edit Bookmark</div>
                    
                    <div class="edit-form-group">
                        <label class="edit-form-label">Name</label>
                        <input type="text" id="${DOMIds.EDIT_BOOKMARK_TITLE}" class="edit-form-input">
                    </div>
                    
                    <div class="edit-form-group">
                        <label class="edit-form-label">URL</label>
                        <input type="text" id="${DOMIds.EDIT_BOOKMARK_URL}" class="edit-form-input" readonly>
                    </div>

                    <div class="edit-dialog-actions">
                        <button id="${DOMIds.CANCEL_EDIT_BTN}" class="btn btn-secondary">Cancel</button>
                        <button id="${DOMIds.SAVE_EDIT_BTN}" class="btn btn-primary">Save</button>
                    </div>
                </div>
            </div>

            <div id="${DOMIds.DELETE_CONFIRM_DIALOG}" class="edit-dialog-overlay">
                <div class="edit-dialog-content" style="width: 250px;">
                    <div class="edit-dialog-header">Delete Bookmark?</div>
                    <div class="edit-form-label" style="margin-bottom: 8px;">Are you sure you want to delete this bookmark?</div>
                    <div class="edit-dialog-actions">
                        <button id="${DOMIds.CANCEL_DELETE_BTN}" class="btn btn-secondary">Cancel</button>
                        <button id="${DOMIds.CONFIRM_DELETE_BTN}" class="btn btn-primary" style="background: #ff6b6b; color: white;">Delete</button>
                    </div>
                </div>
            </div>
        `;
    }
}
