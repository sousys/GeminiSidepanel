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
        
        tabEl.addEventListener('click', () => this.dispatchEvent(new CustomEvent('tab-switch', { detail: { id: tab.id } })));
        
        const titleEl = document.createElement('span');
        titleEl.className = CSSClasses.TAB_TITLE;
        titleEl.textContent = tab.title;
        tabEl.appendChild(titleEl);

        const closeBtn = document.createElement('span');
        closeBtn.className = CSSClasses.CLOSE_TAB;
        closeBtn.textContent = Icons.CLOSE;
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
        } else {
            el.classList.remove(CSSClasses.ACTIVE);
        }

        const titleEl = el.querySelector(`.${CSSClasses.TAB_TITLE}`);
        if (titleEl && titleEl.textContent !== tab.title) {
            titleEl.textContent = tab.title;
            el.setAttribute('title', tab.title);
        }
    }

    animateAndRemove(id, el) {
        this.exitingTabs.add(id);
        el.classList.add(CSSClasses.SLIDE_OUT);
        
        setTimeout(() => {
            el.remove();
            this.exitingTabs.delete(id);
        }, Timeouts.ANIMATION_DURATION);
    }

    renderUI(container) {
        container.insertAdjacentHTML('beforeend', this.getTemplate());
    }

    getTemplate() {
        return `
            <div class="tab-bar" id="tabBar">
              <button class="add-tab-btn" id="addTabBtn" title="New Tab">+</button>
              <button class="toggle-bookmark-btn" id="toggleBookmarkBtn" title="Toggle Bookmark"></button>
              <button class="open-browser-btn" id="openBrowserBtn" title="Open in Browser">${Icons.OPEN_NEW}</button>
            </div>
        `;
    }
}