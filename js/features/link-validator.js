export class LinkValidator {
    /**
     * Evaluates if a redirect indicates a broken link.
     * @param {Object} params
     * @param {boolean} params.isAutoRedirect - Flag from content script indicating non-user initiated redirect to /app
     * @param {string} params.intendedUrl - The URL the tab was supposed to be on
     * @param {string} params.currentUrl - The URL the tab is currently on (the redirect destination)
     * @returns {boolean} - True if the link is considered broken
     */
    static isBrokenLink({ isAutoRedirect, intendedUrl, currentUrl }) {
        if (!isAutoRedirect) return false;
        if (!intendedUrl) return false;

        try {
            const intendedUrlObj = new URL(intendedUrl);
            // Check if the user's intended URL was ALREADY "New Chat"
            // If they wanted New Chat, and got New Chat, it's not broken.
            const wasNewChat = intendedUrlObj.pathname === '/app' || intendedUrlObj.pathname === '/app/';
            
            // If we were redirected to /app (isAutoRedirect) but we didn't start there,
            // it means the deep link failed.
            return !wasNewChat;
        } catch (e) {
            console.warn('LinkValidator: Failed to parse intended URL', e);
            return false;
        }
    }
}
