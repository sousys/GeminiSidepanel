export const TooltipUI = {
    timer: null,
    DELAY: 200, // Half of typical ~1s delay

    init() {
        if (!document.getElementById('custom-tooltip')) {
            const tooltip = document.createElement('div');
            tooltip.id = 'custom-tooltip';
            document.body.appendChild(tooltip);
        }
    },

    show(text, targetRect) {
        const tooltip = document.getElementById('custom-tooltip');
        if (!tooltip) return;

        tooltip.textContent = text;
        tooltip.style.display = 'block';

        // Position tooltip below the element, centered horizontally
        const tooltipRect = tooltip.getBoundingClientRect();
        let left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
        let top = targetRect.bottom + 4; // 4px gap

        // Prevent going off screen
        if (left < 0) left = 4;
        if (left + tooltipRect.width > window.innerWidth) left = window.innerWidth - tooltipRect.width - 4;
        
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    },

    hide() {
        const tooltip = document.getElementById('custom-tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    },

    handleEnter(e) {
        // Need to bind context or access TooltipManager directly
        const text = e.currentTarget.getAttribute('data-tooltip');
        if (!text) return;

        // Clear any existing timer to avoid overlaps
        if (TooltipUI.timer) clearTimeout(TooltipUI.timer);

        const rect = e.currentTarget.getBoundingClientRect();
        TooltipUI.timer = setTimeout(() => {
            TooltipUI.show(text, rect);
        }, TooltipUI.DELAY);
    },

    handleLeave() {
        if (TooltipUI.timer) clearTimeout(TooltipUI.timer);
        TooltipUI.hide();
    }
};
