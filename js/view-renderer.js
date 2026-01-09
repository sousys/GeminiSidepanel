import { DOMIds } from './constants.js';
import { TabBar } from './tab-bar.js';
import { IframeHandler } from './iframe-handler.js';

export class ViewRenderer extends EventTarget {
    constructor() {
        super();
        this.tabBar = new TabBar();
        this.iframeHandler = new IframeHandler();
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
    }

    render(tabs, activeTabId) {
        this.tabBar.render(tabs, activeTabId);
        this.iframeHandler.render(tabs, activeTabId);
    }
}
