export class LinkValidator {
    /**
     * Evaluates whether a redirect indicates a broken (deleted) deep link.
     *
     * Pattern: a deep link was opened, the provider auto-redirected the page
     * to its "new chat" landing because the conversation no longer exists,
     * and no user interaction triggered the change.
     *
     * @param {Object} params
     * @param {boolean} params.isAutoRedirect - Content-script-supplied flag:
     *     true iff destination matches `newChatRoutes` AND user did not interact.
     * @param {string} params.intendedUrl     - URL the tab was supposed to be on.
     * @param {string[]} params.newChatRoutes - Pathnames considered "new chat"
     *     for the relevant provider (from provider.routes.newChat).
     * @returns {boolean}
     */
    static isBrokenLink({ isAutoRedirect, intendedUrl, newChatRoutes }) {
        if (!isAutoRedirect) return false;
        if (!intendedUrl) return false;
        if (!Array.isArray(newChatRoutes) || newChatRoutes.length === 0) return false;

        try {
            const intendedUrlObj = new URL(intendedUrl);
            // If the user's intended URL was already a "new chat" route, the
            // redirect-to-new-chat is expected, not a broken link.
            const wasNewChat = newChatRoutes.includes(intendedUrlObj.pathname);
            return !wasNewChat;
        } catch (e) {
            console.warn('LinkValidator: Failed to parse intended URL', e);
            return false;
        }
    }
}
