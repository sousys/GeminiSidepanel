import { DOMIds } from '../core/config.js';

const RELEASE_NOTES = [
    {
        version: 'v0.4.0',
        items: [
            'Improved security: reduced unnecessary header modifications',
            'Added data validation and error recovery for stored tabs & bookmarks',
            'Flush pending state on panel close to prevent data loss',
            'Use crypto.randomUUID() for tab IDs (collision-safe)',
            'Smooth theme transitions (no flash on panel open)',
            'Material 3 tonal error colors (WCAG AA contrast)',
            'Keyboard navigation for tab bar (arrows, Enter, Delete)',
            'ARIA labels on icon buttons for screen readers',
            'Focus restoration after closing tabs (no focus theft)',
            'Release Notes & version info in Settings'
        ]
    },
    {
        version: 'v0.3.0',
        items: [
            'Bookmarks with edit & broken-link detection',
            'Persistent tabs across panel reopens',
            'Light & dark theme with system preference',
            'Content zoom (50%–120%)',
            'Open current tab in browser',
            'Buy-me-a-coffee link in toolbar'
        ]
    }
];

export class ReleaseNotesUI extends EventTarget {
    constructor() {
        super();
        this.modal = null;
        this.closeBtn = null;
    }

    render(container) {
        container.insertAdjacentHTML('beforeend', this.getTemplate());
    }

    init() {
        this.modal = document.getElementById(DOMIds.RELEASE_NOTES_MODAL);
        this.closeBtn = document.getElementById(DOMIds.CLOSE_RELEASE_NOTES_BTN);
        this.bindEvents();
    }

    bindEvents() {
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.closeModal());
        }
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.closeModal();
                }
            });
        }
    }

    openModal() {
        if (this.modal) {
            this.modal.classList.add('open');
            this.dispatchEvent(new CustomEvent('modal-open'));
        }
    }

    closeModal() {
        if (this.modal) {
            this.modal.classList.remove('open');
        }
    }

    isOpen() {
        return this.modal && this.modal.classList.contains('open');
    }

    getTemplate() {
        const entries = RELEASE_NOTES.map(entry => `
            <div class="release-entry">
                <div class="release-version">${entry.version}</div>
                <ul class="release-list">
                    ${entry.items.map(item => `<li>${this.escapeHtml(item)}</li>`).join('')}
                </ul>
            </div>
        `).join('');

        return `
            <div id="${DOMIds.RELEASE_NOTES_MODAL}" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Release Notes</h2>
                        <button id="${DOMIds.CLOSE_RELEASE_NOTES_BTN}" class="modal-close-btn" aria-label="Close release notes">&times;</button>
                    </div>
                    <div class="release-notes">
                        ${entries}
                    </div>
                </div>
            </div>
        `;
    }

    escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}
