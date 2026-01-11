import { DOMIds } from './constants.js';

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
}
