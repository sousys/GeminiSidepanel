import { DOMIds } from './constants.js';
import { TabBar } from './tab-bar.js';
import { ContentManager } from './content-manager.js';

export class ViewRenderer extends EventTarget {
    constructor() {
        super();
        this.tabBar = new TabBar();
        this.contentManager = new ContentManager();
    }

    init() {
        const tabBarEl = document.getElementById(DOMIds.TAB_BAR);
        const contentAreaEl = document.getElementById(DOMIds.CONTENT_AREA);

        this.tabBar.init(tabBarEl);
        this.contentManager.init(contentAreaEl);

        // Forward events
        this.tabBar.addEventListener('tab-switch', (e) => {
            this.dispatchEvent(new CustomEvent('tab-switch', { detail: e.detail }));
            this.contentManager.checkTabState(e.detail.id);
        });

        this.tabBar.addEventListener('tab-close', (e) => {
            this.dispatchEvent(new CustomEvent('tab-close', { detail: e.detail }));
        });
    }

    render(tabs, activeTabId) {
        this.tabBar.render(tabs, activeTabId);
        this.contentManager.render(tabs, activeTabId);
    }
}
