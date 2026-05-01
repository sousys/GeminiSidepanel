import { DOMIds, CSSClasses } from '../core/config.js';
import { TabBar } from './tabs-ui.js';
import { IframeHandler } from './web-views.js';
import { Icons } from '../core/icons.js';
import { BookmarksUI } from './bookmarks-ui.js';
import { ReleaseNotesUI } from './release-notes-ui.js';

export class ViewRenderer extends EventTarget {
    constructor() {
        super();
        this.tabBar = new TabBar();
        this.iframeHandler = new IframeHandler();
        this.bookmarksUI = new BookmarksUI();
        this.releaseNotesUI = new ReleaseNotesUI();

        // UI Elements
        this.bookmarkBtn = null;
        this.toggleBookmarkBtn = null;
        this.openBrowserBtn = null;

        // Single shared inline-popover element + auto-dismiss bookkeeping.
        this._popoverEl = null;
        this._popoverAnchor = null;
        this._popoverDismiss = null;
        this._popoverTimeoutId = null;
    }

    init() {
        const tabBarEl = document.getElementById(DOMIds.TAB_BAR);
        const contentAreaEl = document.getElementById(DOMIds.CONTENT_AREA);

        this.tabBar.init(tabBarEl);
        this.iframeHandler.init(contentAreaEl);
        this.bookmarksUI.init();
        this.releaseNotesUI.init();

        // Forward events
        this.tabBar.addEventListener('tab-switch', (e) => {
            this.dispatchEvent(new CustomEvent('tab-switch', { detail: e.detail }));
            this.iframeHandler.checkTabState(e.detail.id);
        });

        this.tabBar.addEventListener('tab-close', (e) => {
            this.dispatchEvent(new CustomEvent('tab-close', { detail: e.detail }));
        });

        this.tabBar.addEventListener('new-tab', (e) => {
            this.dispatchEvent(new CustomEvent('new-tab', { detail: e.detail }));
        });

        this.tabBar.addEventListener('tab-reorder', (e) => {
            this.dispatchEvent(new CustomEvent('tab-reorder', { detail: e.detail }));
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
        this.openBrowserBtn = document.getElementById(DOMIds.OPEN_BROWSER_BTN);

        if (this.openBrowserBtn) {
            this.openBrowserBtn.innerHTML = Icons.OPEN_NEW;
            this.openBrowserBtn.addEventListener('click', () => {
                if (this.openBrowserBtn.getAttribute('aria-disabled') === 'true') {
                    const reason = this.openBrowserBtn.dataset.disabledReason || '';
                    this.showInlinePopover(this.openBrowserBtn, reason);
                    return;
                }
                this.dispatchEvent(new CustomEvent('open-in-browser'));
            });
        }

        if (this.bookmarkBtn) {
            this.bookmarkBtn.innerHTML = Icons.BOOKMARK_LIST;
            this.bookmarkBtn.addEventListener('click', () => {
                const modal = document.getElementById(DOMIds.BOOKMARKS_MODAL);
                if (modal && modal.classList.contains('open')) {
                    this.bookmarksUI.closeModal();
                } else {
                    // Close other modals (release notes; settings is closed by app.js)
                    this.releaseNotesUI.closeModal();
                    this.dispatchEvent(new CustomEvent('bookmarks-opening'));
                    this.bookmarksUI.openModal();
                }
            });
        }

        if (this.toggleBookmarkBtn) {
            // Initial Icon (Outline)
            this.toggleBookmarkBtn.innerHTML = Icons.BOOKMARK_OUTLINE;
            this.toggleBookmarkBtn.addEventListener('click', () => {
                // When aria-disabled, surface the explanation popover instead
                // of toggling. Using `aria-disabled` (NOT the `disabled`
                // attribute) preserves click + tooltip behavior.
                if (this.toggleBookmarkBtn.getAttribute('aria-disabled') === 'true') {
                    const reason = this.toggleBookmarkBtn.dataset.disabledReason || '';
                    this.showInlinePopover(this.toggleBookmarkBtn, reason);
                    return;
                }
                this.dispatchEvent(new CustomEvent('bookmark-toggle'));
            });
        }
    }

    renderModals(container) {
        this.bookmarksUI.render(container);
        this.releaseNotesUI.render(container);
    }

    openReleaseNotes() {
        this.releaseNotesUI.openModal();
    }

    closeReleaseNotes() {
        this.releaseNotesUI.closeModal();
    }

    isReleaseNotesOpen() {
        return this.releaseNotesUI.isOpen();
    }

    render(tabs, activeTabId) {
        this.tabBar.render(tabs, activeTabId);
        this.iframeHandler.render(tabs, activeTabId);
    }

    setEnabledProviders(providers) {
        this.tabBar.setEnabledProviders(providers);
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

    /**
     * Set the toggle-bookmark button's enabled/disabled state. We use
     * `aria-disabled` (NOT the native `disabled` attribute) so the button
     * remains clickable for the click-to-explain popover and the tooltip
     * still surfaces on hover.
     *
     * @param {{enabled:boolean, reason?:string}} state
     */
    setBookmarkButtonState({ enabled, reason }) {
        this._applyDisabledState(this.toggleBookmarkBtn, enabled, reason, 'Toggle Bookmark');
    }

    /**
     * Set the open-in-browser button's enabled/disabled state.
     */
    setOpenInBrowserState({ enabled, reason }) {
        this._applyDisabledState(this.openBrowserBtn, enabled, reason, 'Open in Browser');
    }

    _applyDisabledState(btn, enabled, reason, defaultTitle) {
        if (!btn) return;
        const wasDisabled = btn.getAttribute('aria-disabled') === 'true';
        if (enabled) {
            btn.removeAttribute('aria-disabled');
            btn.classList.remove('is-disabled');
            delete btn.dataset.disabledReason;
            btn.setAttribute('title', defaultTitle);
            // If a popover is currently anchored to THIS button, dismiss it
            // since its message no longer applies.
            if (wasDisabled && this._popoverAnchor === btn) {
                this._dismissPopover();
            }
        } else {
            btn.setAttribute('aria-disabled', 'true');
            btn.classList.add('is-disabled');
            btn.dataset.disabledReason = reason || '';
            btn.setAttribute('title', reason || defaultTitle);
        }
    }

    /**
     * Show a transient inline popover anchored below the given element.
     * Single-instance: opening a new popover dismisses any previous one.
     * Auto-dismisses on next document click or after 6 seconds.
     */
    showInlinePopover(anchor, message) {
        this._dismissPopover();
        if (!anchor || !message) return;

        const pop = document.createElement('div');
        pop.className = 'inline-popover';
        pop.setAttribute('role', 'status');
        pop.textContent = message;
        document.body.appendChild(pop);
        this._popoverEl = pop;
        this._popoverAnchor = anchor;

        // Position: prefer below anchor, clamp to viewport. Width capped at
        // min(280px, viewportWidth - 16px) so it never overflows the
        // narrow side panel.
        const anchorRect = anchor.getBoundingClientRect();
        const viewportWidth = document.documentElement.clientWidth;
        const maxWidth = Math.max(120, Math.min(280, viewportWidth - 16));
        pop.style.maxWidth = `${maxWidth}px`;

        // Force layout to read the rendered size.
        const popRect = pop.getBoundingClientRect();
        let top = anchorRect.bottom + 6;
        // If it would overflow vertically, place above instead.
        if (top + popRect.height > document.documentElement.clientHeight - 4) {
            top = Math.max(4, anchorRect.top - popRect.height - 6);
        }
        let left = anchorRect.left + (anchorRect.width / 2) - (popRect.width / 2);
        left = Math.max(8, Math.min(left, viewportWidth - popRect.width - 8));

        pop.style.top = `${Math.round(top)}px`;
        pop.style.left = `${Math.round(left)}px`;

        // Auto-dismiss handlers.
        const onDocClick = (e) => {
            // Don't dismiss the popover that was JUST opened by the same click.
            if (pop.contains(e.target)) return;
            this._dismissPopover();
        };
        // Defer attach so the originating click doesn't immediately dismiss.
        setTimeout(() => {
            document.addEventListener('mousedown', onDocClick);
        }, 0);
        this._popoverDismiss = () => {
            document.removeEventListener('mousedown', onDocClick);
        };
        this._popoverTimeoutId = setTimeout(() => this._dismissPopover(), 6000);
    }

    _dismissPopover() {
        if (this._popoverTimeoutId) {
            clearTimeout(this._popoverTimeoutId);
            this._popoverTimeoutId = null;
        }
        if (this._popoverDismiss) {
            try { this._popoverDismiss(); } catch (_) { /* noop */ }
            this._popoverDismiss = null;
        }
        if (this._popoverEl) {
            this._popoverEl.remove();
            this._popoverEl = null;
        }
        this._popoverAnchor = null;
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
                <button class="toolbar-btn" id="bookmarkBtn" title="Bookmarks" aria-label="Bookmarks"></button>
                <button class="toolbar-btn" id="coffeeBtn" title="Buy me a coffee" aria-label="Buy me a coffee"></button>
                <button class="toolbar-btn" id="settingsBtn" title="Settings" aria-label="Settings"></button>
              </div>
            </div>
        `;
    }
}