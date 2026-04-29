import { StorageKeys } from '../core/config.js';

export class ZoomManager {
    constructor() {
        this.DEFAULT_ZOOM = 100;
        this.MIN_ZOOM = 50;
        this.MAX_ZOOM = 120;
    }

    async init() {
        await this.loadZoomLevel();

        // Listen for changes
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync' && changes[StorageKeys.PANEL_ZOOM]) {
                this.applyZoom(changes[StorageKeys.PANEL_ZOOM].newValue);
            }
        });
    }

    async loadZoomLevel() {
        try {
            const data = await chrome.storage.sync.get(StorageKeys.PANEL_ZOOM);
            const currentZoom = data[StorageKeys.PANEL_ZOOM] || this.DEFAULT_ZOOM;
            this.applyZoom(currentZoom);
        } catch (error) {
            console.error('Failed to load zoom level:', error);
            this.applyZoom(this.DEFAULT_ZOOM);
        }
    }

    applyZoom(zoomPercent) {
        // Clamp against corrupt, NaN, or out-of-range values from storage.
        const parsed = parseInt(zoomPercent, 10) || this.DEFAULT_ZOOM;
        const clamped = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, parsed));
        const zoomLevel = clamped / 100;
        document.body.style.zoom = zoomLevel;
        document.body.style.height = (100 / zoomLevel) + 'vh';
    }
}