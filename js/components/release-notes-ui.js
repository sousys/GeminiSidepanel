import { DOMIds } from '../core/config.js';

export class ReleaseNotesUI extends EventTarget {
    constructor() {
        super();
        this.modal = null;
        this.closeBtn = null;
        this.contentEl = null;
        this.releaseNotes = null;
    }

    render(container) {
        container.insertAdjacentHTML('beforeend', this.getTemplate());
    }

    init() {
        this.modal = document.getElementById(DOMIds.RELEASE_NOTES_MODAL);
        this.closeBtn = document.getElementById(DOMIds.CLOSE_RELEASE_NOTES_BTN);
        this.contentEl = this.modal ? this.modal.querySelector('.release-notes') : null;
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

    async loadData() {
        if (this.releaseNotes !== null) {
            return this.releaseNotes;
        }
        try {
            const url = chrome.runtime.getURL('data/release-notes.json');
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            this.releaseNotes = Array.isArray(data) ? data : [];
        } catch (err) {
            console.error('[ReleaseNotesUI] Failed to load release notes:', err);
            this.releaseNotes = [];
        }
        return this.releaseNotes;
    }

    async openModal() {
        if (!this.modal) return;
        const data = await this.loadData();
        this.renderEntries(data);
        this.modal.classList.add('open');
        this.dispatchEvent(new CustomEvent('modal-open'));
    }

    closeModal() {
        if (this.modal) {
            this.modal.classList.remove('open');
        }
    }

    isOpen() {
        return this.modal && this.modal.classList.contains('open');
    }

    renderEntries(data) {
        if (!this.contentEl) return;
        if (!data || data.length === 0) {
            this.contentEl.innerHTML = '<div class="empty-state">No release notes available.</div>';
            return;
        }
        const html = data.map(entry => `
            <div class="release-entry">
                <div class="release-version">${this.escapeHtml(entry.version)}</div>
                <ul class="release-list">
                    ${(entry.items || []).map(item => `<li>${this.escapeHtml(item)}</li>`).join('')}
                </ul>
            </div>
        `).join('');
        this.contentEl.innerHTML = html;
    }

    getTemplate() {
        return `
            <div id="${DOMIds.RELEASE_NOTES_MODAL}" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Release Notes</h2>
                        <button id="${DOMIds.CLOSE_RELEASE_NOTES_BTN}" class="modal-close-btn" aria-label="Close release notes">&times;</button>
                    </div>
                    <div class="release-notes"></div>
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
