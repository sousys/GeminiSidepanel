import { StorageKeys } from '../core/config.js';

const DEFAULT_ZOOM = 100;
const MIN_ZOOM = 50;
const MAX_ZOOM = 120;

/**
 * Apply a zoom percentage to the document body. Clamps the value to the
 * supported range and updates `body.style.height` so layout still fits the
 * viewport (CSS `zoom` shrinks the visual size but not the content height).
 *
 * Exported as a standalone helper so UI controls (e.g. the settings slider)
 * can preview zoom changes live during drag without depending on an instance
 * of `ZoomManager`.
 *
 * @param {number|string} zoomPercent
 */
export function applyZoomToBody(zoomPercent) {
    const parsed = parseInt(zoomPercent, 10) || DEFAULT_ZOOM;
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, parsed));
    const zoomLevel = clamped / 100;
    document.body.style.zoom = zoomLevel;
    document.body.style.height = (100 / zoomLevel) + 'vh';
}

export class ZoomManager {
    constructor() {
        this.DEFAULT_ZOOM = DEFAULT_ZOOM;
        this.MIN_ZOOM = MIN_ZOOM;
        this.MAX_ZOOM = MAX_ZOOM;
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
        applyZoomToBody(zoomPercent);
    }
}