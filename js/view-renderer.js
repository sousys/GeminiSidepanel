const ViewRenderer = {
    elements: {
        tabBar: null,
        contentArea: null,
        openBrowserBtn: null,
        coffeeBtn: null
    },

    init() {
        this.elements.tabBar = document.getElementById('tabBar');
        this.elements.contentArea = document.getElementById('content-area');
        this.elements.openBrowserBtn = document.getElementById('openBrowserBtn');
        
        // Update Open Browser Button Icon to standard 'Open in New' icon
        this.elements.openBrowserBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 0 24 24" width="20px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>';

        // Create Coffee Button
        this.elements.coffeeBtn = document.createElement('button');
        this.elements.coffeeBtn.className = 'coffee-btn';
        this.elements.coffeeBtn.title = 'Buy me a coffee';
        this.elements.coffeeBtn.innerHTML = '<svg style="transform: translateY(1px);" xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 0 24 24" width="20px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M18.5 3H6c-1.1 0-2 .9-2 2v5.71c0 3.83 2.95 7.18 6.78 7.29 3.96.12 7.22-3.06 7.22-7v-1h.5c1.93 0 3.5-1.57 3.5-3.5S20.43 3 18.5 3zM16 5v3H6V5h10zm2.5 3H18V5h.5c.83 0 1.5.67 1.5 1.5S19.33 8 18.5 8z"/></svg>';
        this.elements.coffeeBtn.onclick = () => window.open('https://buymeacoffee.com/sousys', '_blank');
        
        this.elements.openBrowserBtn.insertAdjacentElement('afterend', this.elements.coffeeBtn);
    },

    handleCloseTab(e, id) {
        e.stopPropagation(); 
        const tabEl = e.target.closest('.tab');
        if (tabEl) {
            tabEl.classList.add('slide-out');
            setTimeout(() => {
                State.removeTab(id);
                // If no tabs left, create one (UI logic)
                if (State.getTabs().length === 0) {
                    State.addTab();
                }
            }, 375);
        } else {
            State.removeTab(id);
            if (State.getTabs().length === 0) State.addTab();
        }
    },

    handleSwitchTab(id) {
        State.setActiveTab(id);
        
        // Check state of new active tab
        const activeIframe = this.elements.contentArea.querySelector(`iframe[data-tab-id="${id}"]`);
        if (activeIframe && activeIframe.contentWindow) {
            activeIframe.contentWindow.postMessage({ type: 'CHECK_STATE' }, '*');
        }
    },

    render(tabs, activeTabId) {
        this.renderTabBar(tabs, activeTabId);
        this.renderContent(tabs, activeTabId);
    },

    renderTabBar(tabs, activeTabId) {
        // Basic diffing: Clear and rebuild is okay for small N. 
        const existingTabs = this.elements.tabBar.querySelectorAll('.tab');
        existingTabs.forEach(t => t.remove());

        tabs.forEach((tab) => {
            const tabEl = document.createElement('div');
            tabEl.className = `tab ${tab.id === activeTabId ? 'active' : ''}`;
            
            // Use custom tooltip
            tabEl.setAttribute('data-tooltip', tab.title); 
            tabEl.addEventListener('mouseenter', TooltipUI.handleEnter);
            tabEl.addEventListener('mouseleave', TooltipUI.handleLeave);
            
            tabEl.onclick = () => this.handleSwitchTab(tab.id);
            
            const titleEl = document.createElement('span');
            titleEl.className = 'tab-title';
            titleEl.textContent = tab.title;
            tabEl.appendChild(titleEl);

            const closeBtn = document.createElement('span');
            closeBtn.className = 'close-tab';
            closeBtn.textContent = '\u00D7';
            closeBtn.onclick = (e) => this.handleCloseTab(e, tab.id);
            tabEl.appendChild(closeBtn);

            // Insert after 'New Tab' button, before 'Open Browser' button
            this.elements.tabBar.insertBefore(tabEl, this.elements.openBrowserBtn);
        });
    },

    renderContent(tabs, activeTabId) {
        // Remove iframes for deleted tabs
        const currentIframes = Array.from(this.elements.contentArea.querySelectorAll('iframe'));
        currentIframes.forEach(iframe => {
            const tabId = iframe.getAttribute('data-tab-id');
            if (!tabs.find(t => t.id === tabId)) {
                iframe.remove();
            }
        });

        // Create iframes for new tabs
        tabs.forEach(tab => {
            let iframe = this.elements.contentArea.querySelector(`iframe[data-tab-id="${tab.id}"]`);
            // Lazy load: Only create the iframe if it is the active tab to prevent parallel requests
            if (!iframe && tab.id === activeTabId) {
                iframe = document.createElement('iframe');
                iframe.setAttribute('data-tab-id', tab.id);
                iframe.name = tab.id; // Critical: Allows content-script to read window.name
                iframe.src = tab.url;
                iframe.frameBorder = "0";
                iframe.allow = "clipboard-write; camera; microphone";
                this.elements.contentArea.appendChild(iframe);
            }
        });

        // Update visibility
        const iframes = this.elements.contentArea.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            if (iframe.getAttribute('data-tab-id') === activeTabId) {
                iframe.classList.add('active');
            } else {
                iframe.classList.remove('active');
            }
        });
    }
};
