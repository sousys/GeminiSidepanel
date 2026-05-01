import { CSSClasses, DOMIds, Timeouts } from '../core/config.js';
import { Icons } from '../core/icons.js';
import { getProviderById } from '../core/provider-registry.js';

/**
 * Tab strip component.
 *
 * Responsibilities:
 *  - Render one tab pill per Tab (with a small provider-icon prefix)
 *  - Render the provider picker (single "+" trigger that reveals a vertical
 *    menu of branded provider icons on hover, click, or keyboard)
 *  - Keyboard navigation across tab pills (Arrow / Enter / Delete)
 *  - HTML5 drag-and-drop reordering of tab pills
 *
 * All side effects on state are emitted as CustomEvents:
 *   'tab-switch'   { id }
 *   'tab-close'    { id }
 *   'new-tab'      { providerId }
 *   'tab-reorder'  { draggedId, targetId, position }
 */
export class TabBar extends EventTarget {
    constructor() {
        super();
        this.tabBar = null;
        this.addTabGroup = null;
        this.renderedTabs = new Map();
        this.exitingTabs = new Set();
        this.enabledProviders = []; // Provider config objects, in render order
        this.draggedId = null;

        // Provider picker state
        this.pickerTrigger = null;
        this.pickerMenu = null;
        this.isPickerOpen = false;
        this._pickerCloseTimeoutId = null;
        this._pickerHandlers = null;
        this._documentPickerHandlers = null;
    }

    init(element) {
        this.tabBar = element;
        this.addTabGroup = document.getElementById(DOMIds.ADD_TAB_GROUP);

        // Keyboard navigation across tab pills only.
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

        // Delegated drag-and-drop handlers.
        this.tabBar.addEventListener('dragover', (event) => this.onDragOver(event));
        this.tabBar.addEventListener('dragleave', (event) => this.onDragLeave(event));
        this.tabBar.addEventListener('drop', (event) => this.onDrop(event));
    }

    /**
     * Update which providers' "New Chat" buttons are visible.
     * @param {Array<{id:string,name:string,icon:string}>} providers
     */
    setEnabledProviders(providers) {
        this.enabledProviders = Array.isArray(providers) ? providers.slice() : [];
        if (this.addTabGroup) this.renderProviderPicker();
    }

    /**
     * Render the provider picker. Two layouts depending on enabled count:
     *
     *  - Multiple providers: a single "+" trigger that, on hover or click or
     *    keyboard activation, reveals a vertical menu of branded provider
     *    icons. Selecting one dispatches `'new-tab'`.
     *  - Single provider: a one-click button showing that provider's icon
     *    directly. No menu, no hover handlers — clicking dispatches
     *    `'new-tab'` immediately.
     *
     * The menu (multi-provider mode) lives inside the picker so CSS :hover
     * semantics work naturally, but uses position:fixed at runtime to escape
     * `.tab-bar`'s `overflow-x: auto` clipping.
     */
    renderProviderPicker() {
        if (!this.addTabGroup) return;

        // Preserve open state and focused-item index across rebuilds (e.g.
        // when providers are toggled in settings while the menu is open).
        // Solo mode has no menu, so wasOpen is irrelevant there.
        const wasOpen = this.isPickerOpen;
        const previouslyFocusedId = (document.activeElement && document.activeElement.closest)
            ? (document.activeElement.closest('.provider-picker-item') || {}).getAttribute?.('data-provider-id')
            : null;

        // Tear down any previous structure and listeners (null-safe; handles
        // both menu and solo modes).
        this._teardownPicker();

        this.addTabGroup.innerHTML = '';
        this.addTabGroup.classList.add('provider-picker');
        this.addTabGroup.classList.toggle('provider-picker--solo', this.enabledProviders.length === 1);

        // Hide the entire picker when no providers are enabled (defensive;
        // the settings dialog already guarantees at least one).
        if (this.enabledProviders.length === 0) {
            this.addTabGroup.hidden = true;
            return;
        }
        this.addTabGroup.hidden = false;

        // ----- Single-provider collapse -----------------------------------
        if (this.enabledProviders.length === 1) {
            const provider = this.enabledProviders[0];
            const trigger = document.createElement('button');
            trigger.className = 'provider-picker-trigger provider-picker-solo';
            trigger.type = 'button';
            trigger.setAttribute('aria-label', `New ${provider.name} chat`);
            trigger.setAttribute('title', `New ${provider.name} chat`);
            trigger.innerHTML = provider.icon;

            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                this.dispatchEvent(new CustomEvent('new-tab', { detail: { providerId: provider.id } }));
            });

            this.addTabGroup.appendChild(trigger);
            this.pickerTrigger = trigger;
            this.pickerMenu = null;
            // No hover/menu handlers in solo mode.
            return;
        }

        // ----- Multi-provider menu ----------------------------------------
        // Trigger
        const trigger = document.createElement('button');
        trigger.className = 'provider-picker-trigger';
        trigger.type = 'button';
        trigger.setAttribute('aria-haspopup', 'menu');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-label', 'New chat');
        trigger.setAttribute('title', 'New chat');
        trigger.textContent = '+';

        // Menu
        const menu = document.createElement('div');
        menu.className = 'provider-picker-menu';
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-orientation', 'vertical');
        menu.hidden = true;

        for (const provider of this.enabledProviders) {
            const item = document.createElement('button');
            item.className = 'provider-picker-item';
            if (provider.limited) item.setAttribute('data-limited', 'true');
            item.type = 'button';
            item.setAttribute('role', 'menuitem');
            item.setAttribute('data-provider-id', provider.id);
            item.setAttribute('aria-label', `New ${provider.name} chat`);
            item.setAttribute('title', `New ${provider.name} chat`);
            item.tabIndex = -1;
            const iconSpan = document.createElement('span');
            iconSpan.className = 'provider-picker-item-icon';
            iconSpan.setAttribute('aria-hidden', 'true');
            iconSpan.innerHTML = provider.icon;
            item.appendChild(iconSpan);

            const nameSpan = document.createElement('span');
            nameSpan.className = 'provider-picker-item-name';
            nameSpan.textContent = provider.name;
            item.appendChild(nameSpan);

            if (provider.limited && provider.limitations && provider.limitations.short) {
                const hintSpan = document.createElement('span');
                hintSpan.className = 'provider-picker-item-hint';
                hintSpan.textContent = provider.limitations.short;
                item.appendChild(hintSpan);
            }

            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.dispatchEvent(new CustomEvent('new-tab', { detail: { providerId: provider.id } }));
                this.closePicker({ refocusTrigger: false });
            });
            menu.appendChild(item);
        }

        this.addTabGroup.appendChild(trigger);
        this.addTabGroup.appendChild(menu);

        this.pickerTrigger = trigger;
        this.pickerMenu = menu;

        this._attachPickerListeners();

        // Restore prior open/focus state.
        if (wasOpen) {
            this.openPicker({ focusFirstItem: false });
            if (previouslyFocusedId) {
                const restored = menu.querySelector(`.provider-picker-item[data-provider-id="${previouslyFocusedId}"]`);
                if (restored) restored.focus();
            }
        }
    }

    /**
     * Bind hover / click / keyboard / outside-click handlers for the picker.
     * All bound handlers are stored on `this._pickerHandlers` so they can be
     * removed cleanly on rebuild via `_teardownPicker()`.
     */
    _attachPickerListeners() {
        const root = this.addTabGroup;
        const trigger = this.pickerTrigger;
        const menu = this.pickerMenu;
        if (!root || !trigger || !menu) return;

        const handlers = this._pickerHandlers = {};

        // Hover: open immediately, close on leave with a small delay so the
        // user can move the cursor from the trigger to the menu.
        const HOVER_CLOSE_DELAY_MS = 150;

        handlers.onMouseEnter = () => {
            if (this._pickerCloseTimeoutId) {
                clearTimeout(this._pickerCloseTimeoutId);
                this._pickerCloseTimeoutId = null;
            }
            this.openPicker({ focusFirstItem: false });
        };
        handlers.onMouseLeave = () => {
            if (this._pickerCloseTimeoutId) clearTimeout(this._pickerCloseTimeoutId);
            this._pickerCloseTimeoutId = setTimeout(() => {
                this._pickerCloseTimeoutId = null;
                this.closePicker({ refocusTrigger: false });
            }, HOVER_CLOSE_DELAY_MS);
        };
        root.addEventListener('mouseenter', handlers.onMouseEnter);
        root.addEventListener('mouseleave', handlers.onMouseLeave);

        // Click on trigger toggles (sticky open for keyboard / touch users).
        handlers.onTriggerClick = (e) => {
            e.stopPropagation();
            if (this.isPickerOpen) {
                this.closePicker({ refocusTrigger: true });
            } else {
                this.openPicker({ focusFirstItem: false });
            }
        };
        trigger.addEventListener('click', handlers.onTriggerClick);

        // Keyboard on trigger: Enter/Space/ArrowDown opens and focuses first item.
        handlers.onTriggerKeydown = (e) => {
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.openPicker({ focusFirstItem: true });
            }
        };
        trigger.addEventListener('keydown', handlers.onTriggerKeydown);

        // Keyboard on menu: arrow navigation + Escape.
        handlers.onMenuKeydown = (e) => {
            const items = Array.from(menu.querySelectorAll('.provider-picker-item'));
            const idx = items.indexOf(document.activeElement);
            switch (e.key) {
                case 'ArrowDown': {
                    e.preventDefault();
                    const next = items[(idx + 1) % items.length];
                    if (next) next.focus();
                    break;
                }
                case 'ArrowUp': {
                    e.preventDefault();
                    const prev = items[(idx - 1 + items.length) % items.length];
                    if (prev) prev.focus();
                    break;
                }
                case 'Home': {
                    e.preventDefault();
                    if (items[0]) items[0].focus();
                    break;
                }
                case 'End': {
                    e.preventDefault();
                    if (items[items.length - 1]) items[items.length - 1].focus();
                    break;
                }
                case 'Escape': {
                    e.preventDefault();
                    this.closePicker({ refocusTrigger: true });
                    break;
                }
            }
        };
        menu.addEventListener('keydown', handlers.onMenuKeydown);
    }

    _teardownPicker() {
        if (this._pickerCloseTimeoutId) {
            clearTimeout(this._pickerCloseTimeoutId);
            this._pickerCloseTimeoutId = null;
        }
        const root = this.addTabGroup;
        const trigger = this.pickerTrigger;
        const menu = this.pickerMenu;
        const h = this._pickerHandlers;
        if (root && h) {
            if (h.onMouseEnter) root.removeEventListener('mouseenter', h.onMouseEnter);
            if (h.onMouseLeave) root.removeEventListener('mouseleave', h.onMouseLeave);
        }
        if (trigger && h) {
            if (h.onTriggerClick) trigger.removeEventListener('click', h.onTriggerClick);
            if (h.onTriggerKeydown) trigger.removeEventListener('keydown', h.onTriggerKeydown);
        }
        if (menu && h && h.onMenuKeydown) menu.removeEventListener('keydown', h.onMenuKeydown);
        // Also detach any document-level listeners that may be attached.
        this._detachDocumentPickerListeners();
        this._pickerHandlers = null;
        this.pickerTrigger = null;
        this.pickerMenu = null;
        this.isPickerOpen = false;
    }

    /**
     * Show the picker menu, position it relative to the trigger (using
     * position:fixed to escape ancestor overflow clipping), and attach
     * document-level outside-click / focusout / resize listeners.
     */
    openPicker({ focusFirstItem = false } = {}) {
        if (!this.pickerTrigger || !this.pickerMenu) return;
        if (this.isPickerOpen) {
            this._positionPickerMenu();
            return;
        }
        this.isPickerOpen = true;
        this.pickerMenu.hidden = false;
        this.pickerTrigger.setAttribute('aria-expanded', 'true');
        this._positionPickerMenu();
        this._attachDocumentPickerListeners();
        if (focusFirstItem) {
            const first = this.pickerMenu.querySelector('.provider-picker-item');
            if (first) first.focus();
        }
    }

    closePicker({ refocusTrigger = false } = {}) {
        if (!this.pickerTrigger || !this.pickerMenu) return;
        if (!this.isPickerOpen) return;
        this.isPickerOpen = false;
        this.pickerMenu.hidden = true;
        this.pickerTrigger.setAttribute('aria-expanded', 'false');
        // Clear inline positioning so it's re-computed fresh next open.
        this.pickerMenu.style.top = '';
        this.pickerMenu.style.left = '';
        this._detachDocumentPickerListeners();
        if (this._pickerCloseTimeoutId) {
            clearTimeout(this._pickerCloseTimeoutId);
            this._pickerCloseTimeoutId = null;
        }
        if (refocusTrigger) this.pickerTrigger.focus();
    }

    _positionPickerMenu() {
        if (!this.pickerTrigger || !this.pickerMenu) return;
        const rect = this.pickerTrigger.getBoundingClientRect();
        // Make menu position:fixed via inline style so it escapes
        // `.tab-bar { overflow-x: auto }` clipping.
        this.pickerMenu.style.position = 'fixed';
        this.pickerMenu.style.top = `${Math.round(rect.bottom)}px`;
        this.pickerMenu.style.left = `${Math.round(rect.left)}px`;
    }

    _attachDocumentPickerListeners() {
        if (this._documentPickerHandlers) return;
        const h = this._documentPickerHandlers = {};

        h.onDocumentMouseDown = (e) => {
            if (!this.addTabGroup) return;
            // Close if click is outside both trigger and menu.
            if (!this.addTabGroup.contains(e.target) && !this.pickerMenu.contains(e.target)) {
                this.closePicker({ refocusTrigger: false });
            }
        };
        document.addEventListener('mousedown', h.onDocumentMouseDown);

        h.onDocumentFocusIn = (e) => {
            if (!this.addTabGroup) return;
            if (!this.addTabGroup.contains(e.target) && !this.pickerMenu.contains(e.target)) {
                this.closePicker({ refocusTrigger: false });
            }
        };
        document.addEventListener('focusin', h.onDocumentFocusIn);

        h.onWindowResize = () => this._positionPickerMenu();
        window.addEventListener('resize', h.onWindowResize);
    }

    _detachDocumentPickerListeners() {
        const h = this._documentPickerHandlers;
        if (!h) return;
        if (h.onDocumentMouseDown) document.removeEventListener('mousedown', h.onDocumentMouseDown);
        if (h.onDocumentFocusIn) document.removeEventListener('focusin', h.onDocumentFocusIn);
        if (h.onWindowResize) window.removeEventListener('resize', h.onWindowResize);
        this._documentPickerHandlers = null;
    }

    render(tabs, activeTabId) {
        const currentIds = new Set(tabs.map(t => t.id));

        // Animate out removed tabs
        for (const [id, el] of this.renderedTabs) {
            if (!currentIds.has(id)) {
                if (!this.exitingTabs.has(id)) {
                    this.animateAndRemove(id, el);
                }
                this.renderedTabs.delete(id);
            }
        }

        // Render current tabs in order, anchored after the add-tab-group.
        let previousSibling = this.addTabGroup;

        tabs.forEach((tab) => {
            let tabEl = this.renderedTabs.get(tab.id);
            if (!tabEl) {
                tabEl = this.createTab(tab);
                this.renderedTabs.set(tab.id, tabEl);
            }
            this.updateTab(tabEl, tab, activeTabId);

            if (previousSibling) {
                if (previousSibling.nextSibling !== tabEl) {
                    previousSibling.after(tabEl);
                }
                previousSibling = tabEl;
            } else {
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
        tabEl.setAttribute('role', 'tab');
        tabEl.setAttribute('tabindex', '-1');
        tabEl.setAttribute('draggable', 'true');

        // Decorate tab with provider-limited accent stripe + enriched tooltip.
        const provider = getProviderById(tab.provider);
        if (provider && provider.limited) {
            tabEl.setAttribute('data-limited', 'true');
            if (provider.accentColor) {
                tabEl.style.setProperty('--provider-accent', provider.accentColor);
            }
        }
        tabEl.setAttribute('title', this._buildTabTooltip(tab, provider));

        tabEl.addEventListener('click', () =>
            this.dispatchEvent(new CustomEvent('tab-switch', { detail: { id: tab.id } }))
        );

        tabEl.addEventListener('dragstart', (event) => this.onDragStart(event, tab.id));
        tabEl.addEventListener('dragend', () => this.onDragEnd());

        // Provider icon (purely decorative; tab pill already has aria-label)
        const iconEl = document.createElement('span');
        iconEl.className = CSSClasses.TAB_PROVIDER_ICON;
        iconEl.setAttribute('aria-hidden', 'true');
        if (provider && provider.icon) {
            iconEl.innerHTML = provider.icon;
        }
        tabEl.appendChild(iconEl);

        const titleEl = document.createElement('span');
        titleEl.className = CSSClasses.TAB_TITLE;
        titleEl.textContent = tab.title;
        tabEl.appendChild(titleEl);

        const closeBtn = document.createElement('span');
        closeBtn.className = CSSClasses.CLOSE_TAB;
        closeBtn.textContent = Icons.CLOSE;
        closeBtn.setAttribute('role', 'button');
        closeBtn.setAttribute('tabindex', '-1');
        closeBtn.setAttribute('draggable', 'false');
        closeBtn.setAttribute('aria-label', `Close tab ${tab.title}`);
        // Prevent dragstart from initiating when grabbing the close button.
        closeBtn.addEventListener('mousedown', (e) => e.stopPropagation());
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

        const provider = getProviderById(tab.provider);

        const titleEl = el.querySelector(`.${CSSClasses.TAB_TITLE}`);
        if (titleEl && titleEl.textContent !== tab.title) {
            titleEl.textContent = tab.title;
        }
        // Always refresh tooltip — title changes are common, and it's cheap.
        el.setAttribute('title', this._buildTabTooltip(tab, provider));

        const closeBtn = el.querySelector(`.${CSSClasses.CLOSE_TAB}`);
        if (closeBtn) {
            closeBtn.setAttribute('aria-label', `Close tab ${tab.title}`);
        }

        // Keep provider icon in sync if a tab's provider ever changes
        // (defensive — currently providers are immutable per tab).
        const iconEl = el.querySelector(`.${CSSClasses.TAB_PROVIDER_ICON}`);
        if (iconEl) {
            const expected = (provider && provider.icon) || '';
            if (iconEl.innerHTML !== expected) {
                iconEl.innerHTML = expected;
            }
        }
    }

    /**
     * Compose a tab pill's `title` attribute. For limited-scope providers
     * the short limitation label is appended so the user discovers WHY the
     * tab looks/behaves differently on hover.
     */
    _buildTabTooltip(tab, provider) {
        const base = tab.title || '';
        if (provider && provider.limited && provider.limitations && provider.limitations.short) {
            return base ? `${base} \u2014 ${provider.limitations.short}` : provider.limitations.short;
        }
        return base;
    }

    animateAndRemove(id, el) {
        this.exitingTabs.add(id);
        el.classList.add(CSSClasses.SLIDE_OUT);

        const hadFocus = el.contains(document.activeElement);

        setTimeout(() => {
            el.remove();
            this.exitingTabs.delete(id);
            if (hadFocus && document.activeElement === document.body) {
                const activeTab = this.tabBar &&
                    this.tabBar.querySelector('.' + CSSClasses.TAB + '.' + CSSClasses.ACTIVE);
                if (activeTab) {
                    activeTab.focus();
                } else {
                    const firstAddBtn = this.addTabGroup && this.addTabGroup.querySelector('button');
                    if (firstAddBtn) firstAddBtn.focus();
                }
            }
        }, Timeouts.ANIMATION_DURATION);
    }

    // ---------------------------------------------------------------------
    // Drag-and-drop
    // ---------------------------------------------------------------------

    onDragStart(event, tabId) {
        if (this.exitingTabs.has(tabId)) {
            event.preventDefault();
            return;
        }
        this.draggedId = tabId;
        try {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', tabId);
        } catch (_) { /* some browsers throw if called twice */ }

        const el = this.renderedTabs.get(tabId);
        if (el) el.classList.add(CSSClasses.TAB_DRAGGING);
    }

    onDragOver(event) {
        if (!this.draggedId) return;
        const targetTab = event.target.closest('.' + CSSClasses.TAB);
        if (!targetTab) return;

        const targetId = targetTab.getAttribute('data-id');
        if (!targetId || targetId === this.draggedId) return;
        if (this.exitingTabs.has(targetId)) return;

        event.preventDefault();
        try { event.dataTransfer.dropEffect = 'move'; } catch (_) { /* noop */ }

        const rect = targetTab.getBoundingClientRect();
        const before = event.clientX < rect.left + rect.width / 2;

        this.clearDropIndicators();
        targetTab.classList.add(before ? CSSClasses.TAB_DROP_BEFORE : CSSClasses.TAB_DROP_AFTER);
    }

    onDragLeave(event) {
        // Only clear when we leave the tab bar entirely (event.relatedTarget is
        // null or outside the tab bar).
        if (!this.tabBar) return;
        const related = event.relatedTarget;
        if (related && this.tabBar.contains(related)) return;
        this.clearDropIndicators();
    }

    onDrop(event) {
        if (!this.draggedId) return;
        const targetTab = event.target.closest('.' + CSSClasses.TAB);
        if (!targetTab) {
            this.clearDropIndicators();
            return;
        }
        const targetId = targetTab.getAttribute('data-id');
        if (!targetId || targetId === this.draggedId) {
            this.clearDropIndicators();
            return;
        }

        event.preventDefault();

        const rect = targetTab.getBoundingClientRect();
        const position = event.clientX < rect.left + rect.width / 2 ? 'before' : 'after';

        this.dispatchEvent(new CustomEvent('tab-reorder', {
            detail: { draggedId: this.draggedId, targetId, position }
        }));

        this.clearDropIndicators();
    }

    onDragEnd() {
        if (this.draggedId) {
            const el = this.renderedTabs.get(this.draggedId);
            if (el) el.classList.remove(CSSClasses.TAB_DRAGGING);
        }
        this.draggedId = null;
        this.clearDropIndicators();
    }

    clearDropIndicators() {
        if (!this.tabBar) return;
        const marked = this.tabBar.querySelectorAll(
            '.' + CSSClasses.TAB_DROP_BEFORE + ', .' + CSSClasses.TAB_DROP_AFTER
        );
        marked.forEach(el => {
            el.classList.remove(CSSClasses.TAB_DROP_BEFORE, CSSClasses.TAB_DROP_AFTER);
        });
    }

    // ---------------------------------------------------------------------
    // Initial template
    // ---------------------------------------------------------------------

    renderUI(container) {
        container.insertAdjacentHTML('beforeend', this.getTemplate());
    }

    getTemplate() {
        return `
            <div class="tab-bar" id="${DOMIds.TAB_BAR}">
              <div class="add-tab-group" id="${DOMIds.ADD_TAB_GROUP}" role="group" aria-label="New chat"></div>
              <button class="toggle-bookmark-btn" id="${DOMIds.TOGGLE_BOOKMARK_BTN}" title="Toggle Bookmark" aria-label="Toggle bookmark"></button>
              <button class="open-browser-btn" id="${DOMIds.OPEN_BROWSER_BTN}" title="Open in Browser" aria-label="Open in browser">${Icons.OPEN_NEW}</button>
            </div>
        `;
    }
}
