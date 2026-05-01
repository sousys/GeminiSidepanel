import { GeminiProvider } from '../providers/gemini/index.js';
import { ChatGPTProvider } from '../providers/chatgpt/index.js';
import { ClaudeProvider } from '../providers/claude/index.js';

/**
 * Central registry of AI providers.
 *
 * Each provider config has the shape:
 *   {
 *     id: string,
 *     name: string,
 *     origin: string,                    // exact origin used for postMessage validation
 *     newChatUrl: string,
 *     defaultTitle: string,
 *     domains: string[],                 // for declarativeNetRequest header stripping
 *     routes: { newChat: string[] },     // pathnames considered "new chat" landing
 *     autoRedirectsDeletedChats: boolean,
 *     icon: string,                      // inline SVG using currentColor
 *
 *     // OPTIONAL — for limited-scope providers (e.g. Claude). Read by generic
 *     // UI; safe to omit.
 *     limited?: boolean,
 *     accentColor?: string,              // brand color for the tab pill stripe
 *     limitations?: {
 *         short: string,                 // tooltip / picker hint
 *         hint: string,                  // settings note + first-run strip
 *         capabilities?: {               // optional per-capability opt-outs;
 *             [key: string]: boolean     // `false` disables the matching toolbar
 *         },                             // affordance via isCapabilityDisabled()
 *         [reasonKey: string]: string    // optional `<key>Reason` strings used as
 *     }                                  // the click-to-explain popover message
 *   }
 *
 * Provider-specific content-script (DOM scraping) logic intentionally lives
 * with each provider under js/providers/<id>/content-script.js — NOT here.
 */
const PROVIDERS = Object.freeze({
    [GeminiProvider.id]: GeminiProvider,
    [ChatGPTProvider.id]: ChatGPTProvider,
    [ClaudeProvider.id]: ClaudeProvider
});

const PROVIDER_LIST = Object.freeze(Object.values(PROVIDERS));

const PROVIDERS_BY_ORIGIN = Object.freeze(
    PROVIDER_LIST.reduce((acc, p) => {
        acc[p.origin] = p;
        return acc;
    }, {})
);

export function getProviderById(id) {
    return PROVIDERS[id] || null;
}

export function getProviderByOrigin(origin) {
    return PROVIDERS_BY_ORIGIN[origin] || null;
}

/**
 * Look up the provider that owns a given URL by parsing it and matching its
 * origin against the provider registry. Safe against malformed URLs.
 *
 * @param {string} url
 * @returns {object|null} Provider config, or null if URL cannot be parsed or
 *   its origin doesn't match any registered provider.
 */
export function getProviderByUrl(url) {
    if (typeof url !== 'string' || url.length === 0) return null;
    let origin;
    try {
        origin = new URL(url).origin;
    } catch (_) {
        return null;
    }
    return getProviderByOrigin(origin);
}

export function getAllProviders() {
    return PROVIDER_LIST;
}

export function getAllProviderIds() {
    return PROVIDER_LIST.map(p => p.id);
}

export function getAllProviderDomains() {
    const seen = new Set();
    for (const p of PROVIDER_LIST) {
        for (const d of p.domains) seen.add(d);
    }
    return Array.from(seen);
}

/**
 * Returns true when the provider has explicitly opted OUT of a capability
 * via `limitations.capabilities[key] === false`. Anything else (including
 * absent / undefined) is treated as "supported" — capability defaults are
 * positive so old/new providers without the limited descriptor work as
 * before.
 *
 * @param {object|null} provider Provider config (may be null/undefined).
 * @param {string} key Capability key, e.g. 'bookmarks', 'openInBrowser'.
 * @returns {boolean}
 */
export function isCapabilityDisabled(provider, key) {
    if (!provider || !provider.limitations || !provider.limitations.capabilities) return false;
    return provider.limitations.capabilities[key] === false;
}
