import { DOMIds, StorageKeys } from '../core/config.js';
import { getAllProviders } from '../core/provider-registry.js';
import { applyZoomToBody } from './zoom.js';

/**
 * Default state when no preference is persisted: every known provider enabled.
 */
function buildDefaultEnabledMap() {
    const map = {};
    for (const p of getAllProviders()) map[p.id] = true;
    return map;
}

export class SettingsManager extends EventTarget {
    constructor() {
        super();
        this.statusElement = null;
        this.themeRadios = null;
        this.zoomSlider = null;
        this.zoomValue = null;
        this.persistenceCheckbox = null;
        this.resetBrokenCheckbox = null;
        this.providersGroupEl = null;
        this.providerCheckboxes = []; // [{providerId, input}]
        this.closeBtn = null;
        this.modal = null;
        this.openReleaseNotesBtn = null;

        // Listen for cross-context changes to keep checkboxes in sync.
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync' && changes[StorageKeys.ENABLED_PROVIDERS]) {
                const next = changes[StorageKeys.ENABLED_PROVIDERS].newValue || {};
                this.syncProviderCheckboxes(next);
            }
        });
    }

    async init() {
        this.statusElement = document.getElementById('settingsStatus');
        this.themeRadios = document.querySelectorAll('input[name="theme"]');
        this.zoomSlider = document.getElementById('zoomSlider');
        this.zoomValue = document.getElementById('zoomValue');
        this.persistenceCheckbox = document.getElementById('persistenceCheckbox');
        this.resetBrokenCheckbox = document.getElementById('resetBrokenCheckbox');
        this.providersGroupEl = document.getElementById(DOMIds.PROVIDERS_GROUP);
        this.providerCheckboxes = Array.from(
            this.providersGroupEl ? this.providersGroupEl.querySelectorAll('input[type="checkbox"][data-provider-id]') : []
        ).map(input => ({ providerId: input.getAttribute('data-provider-id'), input }));
        this.closeBtn = document.getElementById('closeSettingsBtn');
        this.modal = document.getElementById('settingsModal');
        this.openReleaseNotesBtn = document.getElementById(DOMIds.OPEN_RELEASE_NOTES_BTN);

        this.populateVersionInfo();
        await this.loadSettings();
        this.attachListeners();
    }

    populateVersionInfo() {
        const manifest = chrome.runtime.getManifest();
        const versionEl = document.getElementById('extensionVersion');
        if (versionEl) versionEl.textContent = `v${manifest.version}`;
    }

    async loadSettings() {
        try {
            const data = await chrome.storage.sync.get([
                StorageKeys.THEME_PREF,
                StorageKeys.PANEL_ZOOM,
                StorageKeys.PERSISTENCE_PREF,
                StorageKeys.RESET_BROKEN_ON_START,
                StorageKeys.ENABLED_PROVIDERS
            ]);

            const currentTheme = data[StorageKeys.THEME_PREF] || 'system';
            if (this.themeRadios) {
                for (const radio of this.themeRadios) {
                    if (radio.value === currentTheme) {
                        radio.checked = true;
                        break;
                    }
                }
            }

            const currentZoom = data[StorageKeys.PANEL_ZOOM] || 100;
            if (this.zoomSlider) this.zoomSlider.value = currentZoom;
            if (this.zoomValue) this.zoomValue.textContent = currentZoom + '%';

            if (this.persistenceCheckbox) {
                this.persistenceCheckbox.checked = data[StorageKeys.PERSISTENCE_PREF] !== false;
            }

            if (this.resetBrokenCheckbox) {
                this.resetBrokenCheckbox.checked = !!data[StorageKeys.RESET_BROKEN_ON_START];
            }

            const enabledMap = data[StorageKeys.ENABLED_PROVIDERS] || buildDefaultEnabledMap();
            this.syncProviderCheckboxes(enabledMap);
        } catch (error) {
            console.error('Failed to load settings:', error);
            this.showStatus('Failed to load settings');
        }
    }

    syncProviderCheckboxes(enabledMap) {
        for (const { providerId, input } of this.providerCheckboxes) {
            input.checked = enabledMap[providerId] !== false;
        }
    }

    attachListeners() {
        if (this.themeRadios) {
            this.themeRadios.forEach(radio => {
                radio.addEventListener('change', async () => {
                    if (radio.checked) {
                        try {
                            await chrome.storage.sync.set({ [StorageKeys.THEME_PREF]: radio.value });
                            this.showStatus('Theme preference saved!');
                        } catch (error) {
                            console.error('Failed to save theme:', error);
                            this.showStatus('Failed to save theme');
                        }
                    }
                });
            });
        }

        if (this.zoomSlider) {
            // `input` fires on every value change (including during drag) —
            // update the label AND apply the zoom live so the user sees
            // resizing immediately. `change` fires once on commit (mouseup,
            // keyboard release, blur) and persists the chosen value.
            this.zoomSlider.addEventListener('input', () => {
                if (this.zoomValue) this.zoomValue.textContent = this.zoomSlider.value + '%';
                applyZoomToBody(this.zoomSlider.value);
            });
            this.zoomSlider.addEventListener('change', async () => {
                const zoom = parseInt(this.zoomSlider.value, 10);
                try {
                    await chrome.storage.sync.set({ [StorageKeys.PANEL_ZOOM]: zoom });
                    this.showStatus('Zoom preference saved!');
                } catch (error) {
                    console.error('Failed to save zoom:', error);
                    this.showStatus('Failed to save zoom');
                }
            });
        }

        if (this.persistenceCheckbox) {
            this.persistenceCheckbox.addEventListener('change', async () => {
                try {
                    await chrome.storage.sync.set({ [StorageKeys.PERSISTENCE_PREF]: this.persistenceCheckbox.checked });
                    this.showStatus('Persistence setting saved!');
                } catch (error) {
                    console.error('Failed to save persistence:', error);
                    this.showStatus('Failed to save persistence');
                }
            });
        }

        if (this.resetBrokenCheckbox) {
            this.resetBrokenCheckbox.addEventListener('change', async () => {
                try {
                    await chrome.storage.sync.set({ [StorageKeys.RESET_BROKEN_ON_START]: this.resetBrokenCheckbox.checked });
                    this.showStatus('Setting saved!');
                } catch (error) {
                    console.error('Failed to save reset broken setting:', error);
                    this.showStatus('Failed to save setting');
                }
            });
        }

        // Providers checkboxes — guard against disabling the last one.
        for (const { providerId, input } of this.providerCheckboxes) {
            input.addEventListener('change', async () => {
                const desired = this.collectEnabledMap();
                const anyEnabled = Object.values(desired).some(v => v === true);
                if (!anyEnabled) {
                    input.checked = true; // Revert in DOM
                    desired[providerId] = true;
                    this.showStatus('At least one provider must be enabled');
                    return;
                }
                try {
                    await chrome.storage.sync.set({ [StorageKeys.ENABLED_PROVIDERS]: desired });
                    this.showStatus('Providers updated');
                } catch (error) {
                    console.error('Failed to save enabled providers:', error);
                    this.showStatus('Failed to save providers');
                }
            });
        }

        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.closeModal());
        }

        if (this.openReleaseNotesBtn) {
            this.openReleaseNotesBtn.addEventListener('click', () => {
                this.dispatchEvent(new CustomEvent('release-notes-open'));
            });
        }

        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) this.closeModal();
            });
        }
    }

    collectEnabledMap() {
        const map = {};
        for (const { providerId, input } of this.providerCheckboxes) {
            map[providerId] = input.checked;
        }
        return map;
    }

    showStatus(message) {
        if (this.statusElement) {
            this.statusElement.textContent = message;
            setTimeout(() => { this.statusElement.textContent = ''; }, 2000);
        }
    }

    /**
     * Open the modal. If `firstRun` is true, surfaces the first-run notice
     * inside the Providers section and focuses the first provider checkbox.
     */
    async openModal({ firstRun = false } = {}) {
        if (!this.modal) return;
        this.modal.classList.add('open');
        await this.loadSettings();

        if (this.providersGroupEl) {
            if (firstRun) {
                this.providersGroupEl.setAttribute('data-first-run', 'true');
                const firstInput = this.providersGroupEl.querySelector('input[type="checkbox"][data-provider-id]');
                if (firstInput) firstInput.focus();
            } else {
                this.providersGroupEl.removeAttribute('data-first-run');
            }
        }
    }

    closeModal() {
        if (!this.modal) return;
        this.modal.classList.remove('open');
        if (this.providersGroupEl) this.providersGroupEl.removeAttribute('data-first-run');
    }

    isOpen() {
        return this.modal && this.modal.classList.contains('open');
    }

    render(container) {
        container.insertAdjacentHTML('beforeend', this.getTemplate());
        // Return the init() promise so callers can await full initialization
        // (storage reads + listener attachment) before opening the modal.
        return this.init();
    }

    getProvidersTemplate() {
        const items = getAllProviders().map(p => `
            <label>
                <input type="checkbox" id="provider-${p.id}" data-provider-id="${p.id}">
                ${p.name}
            </label>
        `).join('');
        return `
            <h2>Providers</h2>
            <div id="${DOMIds.PROVIDERS_GROUP}" class="settings-group providers-group">
                <p class="first-run-notice">Choose which AI providers you want to use. You can change this later.</p>
                ${items}
            </div>
        `;
    }

    getTemplate() {
        return `
            <div id="settingsModal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Settings</h2>
                        <button id="closeSettingsBtn" class="modal-close-btn">&times;</button>
                    </div>
                    <div id="settingsContent" style="padding: 16px; overflow-y: auto;">
                        ${this.getProvidersTemplate()}

                        <h2>Theme</h2>
                        <div id="themeSettings" class="settings-group">
                            <label><input type="radio" name="theme" value="system"> System</label>
                            <label><input type="radio" name="theme" value="dark"> Dark</label>
                            <label><input type="radio" name="theme" value="light"> Light</label>
                        </div>

                        <h2>Content Size: <span id="zoomValue">100%</span></h2>
                        <div id="zoomSettings" class="settings-group">
                            <input type="range" id="zoomSlider" min="50" max="120" step="10" value="100" list="zoom-values">
                            <datalist id="zoom-values">
                                <option value="50"></option>
                                <option value="60"></option>
                                <option value="70"></option>
                                <option value="80"></option>
                                <option value="90"></option>
                                <option value="100"></option>
                                <option value="110"></option>
                                <option value="120"></option>
                            </datalist>
                            <div class="zoom-labels">
                                <span>50%</span>
                                <span>60%</span>
                                <span>70%</span>
                                <span>80%</span>
                                <span>90%</span>
                                <span>100%</span>
                                <span>110%</span>
                                <span>120%</span>
                            </div>
                        </div>

                        <h2>Behavior</h2>
                        <div id="behaviorSettings" class="settings-group">
                            <label>
                                <input type="checkbox" id="persistenceCheckbox">
                                Persist tabs/state
                            </label>
                            <label>
                                <input type="checkbox" id="resetBrokenCheckbox">
                                Reset 'Broken' bookmarks on startup
                            </label>
                        </div>

                        <div id="settingsStatus"></div>

                        <h2>About</h2>
                        <div class="settings-about">
                            <div class="about-header">
                                <span class="about-name">AI MultiTab Sidepanel</span>
                                <span id="extensionVersion" class="about-version"></span>
                            </div>
                        </div>

                        <button id="${DOMIds.OPEN_RELEASE_NOTES_BTN}" class="settings-link-btn">
                            <span>Release Notes</span>
                            <span class="settings-link-chevron" aria-hidden="true">&rsaquo;</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
}
