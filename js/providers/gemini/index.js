/**
 * Gemini provider configuration.
 *
 * Provider-specific DOM scraping logic lives in ./content-script.js.
 * This module only exposes data consumed by the extension UI / state layer.
 */
export const GeminiProvider = {
    id: 'gemini',
    name: 'Gemini',
    origin: 'https://gemini.google.com',
    newChatUrl: 'https://gemini.google.com/app',
    defaultTitle: 'New',
    domains: [
        'gemini.google.com',
        'accounts.google.com',
        'consent.google.com',
        'labs.google.com'
    ],
    routes: {
        // Pathnames considered the "new chat" landing page. Used by LinkValidator
        // to detect auto-redirects from deleted deep-linked conversations.
        newChat: ['/app', '/app/']
    },
    // Gemini auto-redirects deleted /app/<id> deep links to /app, enabling
    // broken-bookmark detection.
    autoRedirectsDeletedChats: true,
    // Brand sparkle (Gemini). Solid blue fill instead of the multicolor gradient
    // version, because gradient `id` attributes would collide across multiple
    // tabs rendering the same SVG. Solid color keeps the brand recognizable.
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="#3186FF"/></svg>'
};
