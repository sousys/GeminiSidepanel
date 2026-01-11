export const ThemeManager = {
    STORAGE_KEY: 'theme_preference',
    currentMode: 'system', // 'system', 'light', 'dark'
    systemMediaQuery: window.matchMedia('(prefers-color-scheme: dark)'),

    async init() {
        // Load preference
        const data = await chrome.storage.sync.get(this.STORAGE_KEY);
        this.currentMode = data[this.STORAGE_KEY] || 'system';
        
        this.apply();

        // Listen for storage changes (e.g. changed in Settings page)
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync' && changes[this.STORAGE_KEY]) {
                this.currentMode = changes[this.STORAGE_KEY].newValue;
                this.apply();
            }
        });

        // Listen for system preference changes
        this.systemMediaQuery.addEventListener('change', () => {
            if (this.currentMode === 'system') {
                this.apply();
            }
        });
    },

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
    },

    async setTheme(mode) {
        this.currentMode = mode;
        this.apply();
        await chrome.storage.sync.set({ [this.STORAGE_KEY]: mode });
    }
};
