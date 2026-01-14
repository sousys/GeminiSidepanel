export class ZoomManager {
    constructor() {
        this.STORAGE_KEY = 'panel_zoom';
        this.DEFAULT_ZOOM = 100;
    }

    async init() {
        await this.loadZoomLevel();

        // Listen for changes
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync' && changes[this.STORAGE_KEY]) {
                this.applyZoom(changes[this.STORAGE_KEY].newValue);
            }
        });
    }

    async loadZoomLevel() {
        try {
            const data = await chrome.storage.sync.get(this.STORAGE_KEY);
            const currentZoom = data[this.STORAGE_KEY] || this.DEFAULT_ZOOM;
            this.applyZoom(currentZoom);
        } catch (error) {
            console.error('Failed to load zoom level:', error);
            this.applyZoom(this.DEFAULT_ZOOM);
        }
    }

    applyZoom(zoomPercent) {
        if (!zoomPercent) return;
        const zoomLevel = parseInt(zoomPercent, 10) / 100;
        document.body.style.zoom = zoomLevel;
        document.body.style.height = (100 / zoomLevel) + 'vh';
    }
}