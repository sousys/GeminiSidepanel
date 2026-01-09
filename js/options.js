document.addEventListener('DOMContentLoaded', function() {
    const statusElement = document.getElementById('status');
    const themeRadios = document.querySelectorAll('input[name="theme"]');
    const zoomSlider = document.getElementById('zoomSlider');
    const zoomValue = document.getElementById('zoomValue');
    const persistenceCheckbox = document.getElementById('persistenceCheckbox');

    // --- Theme Logic ---
    chrome.storage.sync.get(['theme_preference', 'panel_zoom', 'persistence_enabled'], function(data) {
        const currentTheme = data.theme_preference || 'system';
        for (const radio of themeRadios) {
            if (radio.value === currentTheme) {
                radio.checked = true;
                break;
            }
        }

        // --- Zoom Logic ---
        const currentZoom = data.panel_zoom || 100;
        if (zoomSlider) {
            zoomSlider.value = currentZoom;
        }
        if (zoomValue) {
            zoomValue.textContent = currentZoom + '%';
        }

        // --- Persistence Logic ---
        if (persistenceCheckbox) {
            // Default to true if undefined
            persistenceCheckbox.checked = data.persistence_enabled !== false;
        }
    });

    themeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.checked) {
                const theme = this.value;
                chrome.storage.sync.set({ 'theme_preference': theme }, function() {
                    if (statusElement) {
                        statusElement.textContent = 'Theme preference saved!';
                        setTimeout(() => { statusElement.textContent = ''; }, 2000);
                    }
                });
            }
        });
    });

    if (zoomSlider) {
        zoomSlider.addEventListener('input', function() {
            if (zoomValue) {
                zoomValue.textContent = this.value + '%';
            }
        });

        zoomSlider.addEventListener('change', function() {
            const zoom = parseInt(this.value, 10);
            chrome.storage.sync.set({ 'panel_zoom': zoom }, function() {
                if (statusElement) {
                    statusElement.textContent = 'Zoom preference saved!';
                    setTimeout(() => { statusElement.textContent = ''; }, 2000);
                }
            });
        });
    }

    if (persistenceCheckbox) {
        persistenceCheckbox.addEventListener('change', function() {
            const enabled = this.checked;
            chrome.storage.sync.set({ 'persistence_enabled': enabled }, function() {
                if (statusElement) {
                    statusElement.textContent = 'Persistence setting saved!';
                    setTimeout(() => { statusElement.textContent = ''; }, 2000);
                }
            });
        });
    }
});