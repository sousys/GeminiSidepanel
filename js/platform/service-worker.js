import { getAllProviderDomains } from '../core/provider-registry.js';

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

chrome.runtime.onInstalled.addListener(() => {
    const requestDomains = getAllProviderDomains();

    chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1],
        addRules: [{
            // Strip ONLY the headers that block iframe embedding of provider pages.
            // X-Content-Type-Options must NOT be removed (MIME sniffing protection).
            // CORS headers must NOT be modified (unnecessary for iframe embedding).
            id: 1,
            priority: 1,
            action: {
                type: "modifyHeaders",
                responseHeaders: [
                    { header: "content-security-policy", operation: "remove" },
                    { header: "x-frame-options", operation: "remove" }
                ]
            },
            condition: {
                resourceTypes: ["main_frame", "sub_frame"],
                requestDomains
            }
        }]
    }).catch(err => console.error('updateDynamicRules failed:', err));
});
