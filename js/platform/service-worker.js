chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

chrome.runtime.onInstalled.addListener(function () {
    chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1],
        addRules: [{
            // Strip ONLY the headers that block iframe embedding of Gemini.
            // X-Content-Type-Options must NOT be removed (MIME sniffing protection).
            // CORS headers must NOT be modified (unnecessary for iframe embedding).
            id: 1,
            priority: 1,
            action: {
                type: "modifyHeaders",
                responseHeaders: [
                    {
                        header: "content-security-policy",
                        operation: "remove"
                    },
                    {
                        header: "x-frame-options",
                        operation: "remove"
                    }
                ]
            },
            condition: {
                resourceTypes: [
                    "main_frame",
                    "sub_frame"
                ],
                requestDomains: [
                    "gemini.google.com",
                    "accounts.google.com",
                    "consent.google.com",
                    "labs.google.com"
                ]
            }
        }]
    }).catch(err => console.error('updateDynamicRules failed:', err));
});
