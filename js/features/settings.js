import { DOMIds } from '../core/config.js';

export class SettingsHandler {
    constructor() {
        this.statusElement = null;
        this.themeRadios = null;
        this.zoomSlider = null;
        this.zoomValue = null;
        this.persistenceCheckbox = null;
        this.closeBtn = null;
        this.modal = null;
    }

    init() {
        this.statusElement = document.getElementById('settingsStatus');
        this.themeRadios = document.querySelectorAll('input[name="theme"]');
        this.zoomSlider = document.getElementById('zoomSlider');
        this.zoomValue = document.getElementById('zoomValue');
        this.persistenceCheckbox = document.getElementById('persistenceCheckbox');
        this.closeBtn = document.getElementById('closeSettingsBtn');
        this.modal = document.getElementById('settingsModal');

        this.loadSettings();
        this.attachListeners();
    }

    loadSettings() {
        chrome.storage.sync.get(['theme_preference', 'panel_zoom', 'persistence_enabled'], (data) => {
            const currentTheme = data.theme_preference || 'system';
            if (this.themeRadios) {
                for (const radio of this.themeRadios) {
                    if (radio.value === currentTheme) {
                        radio.checked = true;
                        break;
                    }
                }
            }

            // --- Zoom Logic ---
            const currentZoom = data.panel_zoom || 100;
            if (this.zoomSlider) {
                this.zoomSlider.value = currentZoom;
            }
            if (this.zoomValue) {
                this.zoomValue.textContent = currentZoom + '%';
            }

            // --- Persistence Logic ---
            if (this.persistenceCheckbox) {
                // Default to true if undefined
                this.persistenceCheckbox.checked = data.persistence_enabled !== false;
            }
        });
    }

    attachListeners() {
        if (this.themeRadios) {
            this.themeRadios.forEach(radio => {
                radio.addEventListener('change', () => {
                    if (radio.checked) {
                        const theme = radio.value;
                        chrome.storage.sync.set({ 'theme_preference': theme }, () => {
                            this.showStatus('Theme preference saved!');
                        });
                    }
                });
            });
        }

        if (this.zoomSlider) {
            this.zoomSlider.addEventListener('input', () => {
                if (this.zoomValue) {
                    this.zoomValue.textContent = this.zoomSlider.value + '%';
                }
            });

            this.zoomSlider.addEventListener('change', () => {
                const zoom = parseInt(this.zoomSlider.value, 10);
                chrome.storage.sync.set({ 'panel_zoom': zoom }, () => {
                    this.showStatus('Zoom preference saved!');
                });
            });
        }

        if (this.persistenceCheckbox) {
            this.persistenceCheckbox.addEventListener('change', () => {
                const enabled = this.persistenceCheckbox.checked;
                chrome.storage.sync.set({ 'persistence_enabled': enabled }, () => {
                    this.showStatus('Persistence setting saved!');
                });
            });
        }
        
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => {
                this.closeModal();
            });
        }

        if (this.modal) {
             this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.closeModal();
                }
            });
        }
    }

    showStatus(message) {
        if (this.statusElement) {
            this.statusElement.textContent = message;
            setTimeout(() => { this.statusElement.textContent = ''; }, 2000);
        }
    }

    openModal() {
        if (this.modal) {
            this.modal.classList.add('open');
            // Refresh settings in case they were changed elsewhere
            this.loadSettings();
        }
    }

    closeModal() {
        if (this.modal) {
            this.modal.classList.remove('open');
        }
    }
    
    isOpen() {
        return this.modal && this.modal.classList.contains('open');
    }

    render(container) {
        container.insertAdjacentHTML('beforeend', this.getTemplate());
        this.init();
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
                        </div>
                        
                        <div id="settingsStatus"></div>
                    </div>
                </div>
            </div>
        `;
    }
}