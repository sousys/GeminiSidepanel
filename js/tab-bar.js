import { CSSClasses, DOMIds, Timeouts } from './constants.js';
import { Icons } from './icons.js';
import { TooltipUI } from './tooltips.js';

export class TabBar extends EventTarget {
    constructor() {
        super();
        this.tabBar = null;
        this.renderedTabs = new Map();
    }

    init(element) {
        this.tabBar = element;
    }

    render(tabs, activeTabId) {
        const currentIds = new Set(tabs.map(t => t.id));

        // 1. Remove deleted tabs
        for (const [id, el] of this.renderedTabs) {
            if (!currentIds.has(id)) {
                el.remove();
                this.renderedTabs.delete(id);
            }
        }

        // 2. Create or Update tabs
        let previousSibling = document.getElementById(DOMIds.ADD_TAB_BTN);
        
        tabs.forEach((tab) => {
            let tabEl = this.renderedTabs.get(tab.id);

            if (!tabEl) {
                // Create new
                tabEl = document.createElement('div');
                tabEl.className = CSSClasses.TAB;
                tabEl.setAttribute('data-id', tab.id);
                
                // Tooltips
                tabEl.setAttribute('data-tooltip', tab.title); 
                tabEl.addEventListener('mouseenter', TooltipUI.handleEnter);
                tabEl.addEventListener('mouseleave', TooltipUI.handleLeave);
                
                // Event Listeners
                tabEl.addEventListener('click', () => this.dispatchSwitchTab(tab.id));
                
                const titleEl = document.createElement('span');
                titleEl.className = CSSClasses.TAB_TITLE;
                titleEl.textContent = tab.title;
                tabEl.appendChild(titleEl);

                const closeBtn = document.createElement('span');
                closeBtn.className = CSSClasses.CLOSE_TAB;
                closeBtn.textContent = Icons.CLOSE;
                closeBtn.addEventListener('click', (e) => this.handleCloseTab(e, tab.id));
                tabEl.appendChild(closeBtn);

                this.renderedTabs.set(tab.id, tabEl);
            }

            // Update Active State
            if (tab.id === activeTabId) {
                tabEl.classList.add(CSSClasses.ACTIVE);
            } else {
                tabEl.classList.remove(CSSClasses.ACTIVE);
            }

            // Update Title
            const titleEl = tabEl.querySelector(`.${CSSClasses.TAB_TITLE}`);
            if (titleEl && titleEl.textContent !== tab.title) {
                titleEl.textContent = tab.title;
                tabEl.setAttribute('data-tooltip', tab.title);
            }

            // Ensure DOM Order
            if (previousSibling.nextSibling !== tabEl) {
                previousSibling.after(tabEl);
            }
            previousSibling = tabEl;
        });
    }

    handleCloseTab(e, id) {
        e.stopPropagation(); 
        const tabEl = this.renderedTabs.get(id);
        
        if (tabEl) {
            tabEl.classList.add(CSSClasses.SLIDE_OUT);
            setTimeout(() => {
                this.dispatchEvent(new CustomEvent('tab-close', { detail: { id } }));
            }, Timeouts.ANIMATION_DURATION);
        } else {
            this.dispatchEvent(new CustomEvent('tab-close', { detail: { id } }));
        }
    }

    dispatchSwitchTab(id) {
        this.dispatchEvent(new CustomEvent('tab-switch', { detail: { id } }));
    }
}
