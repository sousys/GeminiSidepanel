import { DOMIds, CSSClasses } from '../core/config.js';
import { TabBar } from './tabs-ui.js';
import { IframeHandler } from './web-views.js';
import { Icons } from '../core/icons.js';
import { BookmarksUI } from './bookmarks-ui.js';

export class ViewRenderer extends EventTarget {
    constructor() {
        super();
        this.tabBar = new TabBar();
        this.iframeHandler = new IframeHandler();
        this.bookmarksUI = new BookmarksUI();
        
        // UI Elements
        this.bookmarkBtn = null;
        this.toggleBookmarkBtn = null;
    }

    init() {
        const tabBarEl = document.getElementById(DOMIds.TAB_BAR);
        const contentAreaEl = document.getElementById(DOMIds.CONTENT_AREA);

        this.tabBar.init(tabBarEl);
        this.iframeHandler.init(contentAreaEl);
        this.bookmarksUI.init();

        // Forward events
        this.tabBar.addEventListener('tab-switch', (e) => {
            this.dispatchEvent(new CustomEvent('tab-switch', { detail: e.detail }));
            this.iframeHandler.checkTabState(e.detail.id);
        });

        this.tabBar.addEventListener('tab-close', (e) => {
            this.dispatchEvent(new CustomEvent('tab-close', { detail: e.detail }));
        });

        // Forward BookmarksUI events
        this.bookmarksUI.addEventListener('modal-open', () => {
            this.dispatchEvent(new CustomEvent('bookmarks-modal-open'));
        });

        this.bookmarksUI.addEventListener('bookmark-update', (e) => {
            this.dispatchEvent(new CustomEvent('bookmark-update', { detail: e.detail }));
        });

        this.bookmarksUI.addEventListener('bookmark-delete', (e) => {
            this.dispatchEvent(new CustomEvent('bookmark-delete', { detail: e.detail }));
        });

        this.bookmarksUI.addEventListener('bookmark-select', (e) => {
            this.dispatchEvent(new CustomEvent('bookmark-select', { detail: e.detail }));
        });

        // Initialize Bookmark UI Buttons
        this.bookmarkBtn = document.getElementById(DOMIds.BOOKMARK_BTN);
        this.toggleBookmarkBtn = document.getElementById(DOMIds.TOGGLE_BOOKMARK_BTN);
        
        if (this.bookmarkBtn) {
            this.bookmarkBtn.innerHTML = Icons.BOOKMARK_LIST;
            this.bookmarkBtn.addEventListener('click', () => {
                const modal = document.getElementById(DOMIds.BOOKMARKS_MODAL);
                if (modal && modal.classList.contains('open')) {
                    this.bookmarksUI.closeModal();
                } else {
                    this.bookmarksUI.openModal();
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
    }

    renderModals(container) {
        this.bookmarksUI.render(container);
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

    closeBookmarksModal() {
        this.bookmarksUI.closeModal();
    }

    renderBookmarksList(bookmarks) {
        this.bookmarksUI.renderList(bookmarks);
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