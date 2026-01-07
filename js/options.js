document.addEventListener('DOMContentLoaded', function() {
    const statusElement = document.getElementById('status');
    const themeRadios = document.querySelectorAll('input[name="theme"]');

    // --- Theme Logic ---
    chrome.storage.sync.get('theme_preference', function(data) {
        const currentTheme = data.theme_preference || 'system';
        for (const radio of themeRadios) {
            if (radio.value === currentTheme) {
                radio.checked = true;
                break;
            }
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
});