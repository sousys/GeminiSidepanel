import { CSSClasses, DOMIds, Timeouts } from '../core/config.js';
import { Icons } from '../core/icons.js';

export class TabBar extends EventTarget {
    constructor() {
        super();
        this.tabBar = null;
        this.addTabBtn = null;
        this.renderedTabs = new Map();
        this.exitingTabs = new Set();
    }

    init(element) {
        this.tabBar = element;
        this.addTabBtn = document.getElementById(DOMIds.ADD_TAB_BTN);

        // Single delegated keydown handler for tab-bar keyboard navigation.
        // Filters strictly to `.tab` elements so close button keys aren't consumed.
        this.tabBar.addEventListener('keydown', (event) => {
            if (!event.target.matches('.' + CSSClasses.TAB)) return;

            const tabs = Array.from(this.tabBar.querySelectorAll('.' + CSSClasses.TAB));
            const idx = tabs.indexOf(event.target);
            if (idx === -1) return;

            switch (event.key) {
                case 'ArrowRight': {
                    const next = tabs[(idx + 1) % tabs.length];
                    if (next) next.focus();
                    event.preventDefault();
                    break;
                }
                case 'ArrowLeft': {
                    const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
                    if (prev) prev.focus();
                    event.preventDefault();
                    break;
                }
                case 'Enter':
                case ' ': {
                    const id = event.target.getAttribute('data-id');
                    if (id) {
                        this.dispatchEvent(new CustomEvent('tab-switch', { detail: { id } }));
                    }
                    // Prevent Space from scrolling the page.
                    event.preventDefault();
                    break;
                }
                case 'Delete': {
                    const id = event.target.getAttribute('data-id');
                    if (id) {
                        this.dispatchEvent(new CustomEvent('tab-close', { detail: { id } }));
                    }
                    event.preventDefault();
                    break;
                }
            }
        });
    }

    render(tabs, activeTabId) {
        const currentIds = new Set(tabs.map(t => t.id));

        // 1. Handle Removed Tabs (Animate out)
        for (const [id, el] of this.renderedTabs) {
            if (!currentIds.has(id)) {
                if (!this.exitingTabs.has(id)) {
                    this.animateAndRemove(id, el);
                }
                this.renderedTabs.delete(id);
            }
        }

        // 2. Render Current Tabs
        let previousSibling = this.addTabBtn;
        
        tabs.forEach((tab) => {
            let tabEl = this.renderedTabs.get(tab.id);

            if (!tabEl) {
                tabEl = this.createTab(tab);
                this.renderedTabs.set(tab.id, tabEl);
            }

            this.updateTab(tabEl, tab, activeTabId);

            // Ensure DOM Order
            if (previousSibling) {
                if (previousSibling.nextSibling !== tabEl) {
                    previousSibling.after(tabEl);
                }
                previousSibling = tabEl;
            } else {
                // Fallback if add button is missing
                if (this.tabBar.lastChild !== tabEl) {
                    this.tabBar.appendChild(tabEl);
                }
                previousSibling = tabEl;
            }
        });
    }

    createTab(tab) {
        const tabEl = document.createElement('div');
        tabEl.className = CSSClasses.TAB;
        tabEl.setAttribute('data-id', tab.id);
        tabEl.setAttribute('title', tab.title);
        tabEl.setAttribute('role', 'tab');
        // Roving tabindex: updateTab() sets 0 for active, -1 for inactive.
        tabEl.setAttribute('tabindex', '-1');

        tabEl.addEventListener('click', () => this.dispatchEvent(new CustomEvent('tab-switch', { detail: { id: tab.id } })));

        const titleEl = document.createElement('span');
        titleEl.className = CSSClasses.TAB_TITLE;
        titleEl.textContent = tab.title;
        tabEl.appendChild(titleEl);

        const closeBtn = document.createElement('span');
        closeBtn.className = CSSClasses.CLOSE_TAB;
        closeBtn.textContent = Icons.CLOSE;
        closeBtn.setAttribute('role', 'button');
        // Intentionally NOT in sequential tab order: with N tabs open this would
        // double the keyboard tab stops in the bar. The keyboard close affordance
        // is Delete-on-focused-tab (handled in the tab-bar keydown delegate).
        closeBtn.setAttribute('tabindex', '-1');
        closeBtn.setAttribute('aria-label', `Close tab ${tab.title}`);
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.dispatchEvent(new CustomEvent('tab-close', { detail: { id: tab.id } }));
        });
        tabEl.appendChild(closeBtn);

        return tabEl;
    }

    updateTab(el, tab, activeTabId) {
        if (tab.id === activeTabId) {
            el.classList.add(CSSClasses.ACTIVE);
            el.setAttribute('tabindex', '0');
            el.setAttribute('aria-selected', 'true');
        } else {
            el.classList.remove(CSSClasses.ACTIVE);
            el.setAttribute('tabindex', '-1');
            el.setAttribute('aria-selected', 'false');
        }

        const titleEl = el.querySelector(`.${CSSClasses.TAB_TITLE}`);
        if (titleEl && titleEl.textContent !== tab.title) {
            titleEl.textContent = tab.title;
            el.setAttribute('title', tab.title);
        }

        // Keep close-button label in sync if title changed.
        const closeBtn = el.querySelector(`.${CSSClasses.CLOSE_TAB}`);
        if (closeBtn) {
            closeBtn.setAttribute('aria-label', `Close tab ${tab.title}`);
        }
    }

    animateAndRemove(id, el) {
        this.exitingTabs.add(id);
        el.classList.add(CSSClasses.SLIDE_OUT);

        // Capture focus state at queue time. Restoration in the timeout requires
        // BOTH (a) focus was on the removed tab when removal began, AND (b) focus
        // hasn't since moved elsewhere (e.g. user clicked into the iframe during
        // the 200ms animation). Without (b) we'd yank focus back from wherever
        // the user has just navigated.
        const hadFocus = el.contains(document.activeElement);

        setTimeout(() => {
            el.remove();
            this.exitingTabs.delete(id);
            if (hadFocus && document.activeElement === document.body) {
                const activeTab = this.tabBar && this.tabBar.querySelector('.' + CSSClasses.TAB + '.' + CSSClasses.ACTIVE);
                if (activeTab) {
                    activeTab.focus();
                } else if (this.addTabBtn) {
                    this.addTabBtn.focus();
                }
            }
        }, Timeouts.ANIMATION_DURATION);
    }

    renderUI(container) {
        container.insertAdjacentHTML('beforeend', this.getTemplate());
    }

    getTemplate() {
        return `
            <div class="tab-bar" id="tabBar">
              <button class="add-tab-btn" id="addTabBtn" title="New Tab" aria-label="New tab">+</button>
              <button class="toggle-bookmark-btn" id="toggleBookmarkBtn" title="Toggle Bookmark" aria-label="Toggle bookmark"></button>
              <button class="open-browser-btn" id="openBrowserBtn" title="Open in Browser" aria-label="Open in browser">${Icons.OPEN_NEW}</button>
            </div>
        `;
    }
}