import { StorageKeys } from '../core/config.js';

export class ThemeManager {
    constructor() {
        this.currentMode = 'system'; // 'system', 'light', 'dark'
        this.systemMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        this.themeReady = false;
    }

    async init() {
        // Load preference
        const data = await chrome.storage.sync.get(StorageKeys.THEME_PREF);
        this.currentMode = data[StorageKeys.THEME_PREF] || 'system';
        
        this.apply();

        // Listen for storage changes (e.g. changed in Settings page)
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync' && changes[StorageKeys.THEME_PREF]) {
                this.currentMode = changes[StorageKeys.THEME_PREF].newValue;
                this.apply();
            }
        });

        // Listen for system preference changes
        this.systemMediaQuery.addEventListener('change', () => {
            if (this.currentMode === 'system') {
                this.apply();
            }
        });
    }

    apply() {
        let effectiveTheme = this.currentMode;

        if (this.currentMode === 'system') {
            effectiveTheme = this.systemMediaQuery.matches ? 'dark' : 'light';
        }

        if (effectiveTheme === 'light') {
            document.body.classList.add('light-theme');
            document.body.classList.remove('dark-theme');
        } else {
            document.body.classList.remove('light-theme');
            document.body.classList.add('dark-theme');
        }

        // Enable smooth transitions only AFTER the initial paint, so the user
        // doesn't see the theme animate in from the default styles on load.
        if (!this.themeReady) {
            this.themeReady = true;
            requestAnimationFrame(() => document.body.classList.add('theme-ready'));
        }
    }

    async setTheme(mode) {
        this.currentMode = mode;
        this.apply();
        await chrome.storage.sync.set({ [StorageKeys.THEME_PREF]: mode });
    }
}
