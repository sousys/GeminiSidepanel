document.addEventListener('DOMContentLoaded', function() {
    const statusElement = document.getElementById('status');
    const themeRadios = document.querySelectorAll('input[name="theme"]');
    const zoomSlider = document.getElementById('zoomSlider');
    const zoomValue = document.getElementById('zoomValue');

    // --- Theme Logic ---
    chrome.storage.sync.get(['theme_preference', 'panel_zoom'], function(data) {
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
});