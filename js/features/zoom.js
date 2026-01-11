export class ZoomManager {
    constructor() {
        this.STORAGE_KEY = 'panel_zoom';
    }

    init() {
        // Initial load
        chrome.storage.sync.get(this.STORAGE_KEY, (data) => {
            const currentZoom = data[this.STORAGE_KEY] || 100;
            this.applyZoom(currentZoom);
        });

        // Listen for changes
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync' && changes[this.STORAGE_KEY]) {
                this.applyZoom(changes[this.STORAGE_KEY].newValue);
            }
        });
    }

    applyZoom(zoomPercent) {
        if (!zoomPercent) return;
        const zoomLevel = parseInt(zoomPercent, 10) / 100;
        document.body.style.zoom = zoomLevel;
        document.body.style.height = (100 / zoomLevel) + 'vh';
    }
}