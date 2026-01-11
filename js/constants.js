export const StorageKeys = {
    TABS: 'gemini_tabs',
    ACTIVE_TAB: 'gemini_active_tab',
    PERSISTENCE_PREF: 'persistence_enabled',
    BOOKMARKS: 'gemini_bookmarks'
};

export const MessageTypes = {
    GEMINI_STATE_CHANGED: 'GEMINI_STATE_CHANGED',
    CHECK_STATE: 'CHECK_STATE'
};

export const CSSClasses = {
    TAB: 'tab',
    ACTIVE: 'active',
    SLIDE_OUT: 'slide-out',
    TAB_TITLE: 'tab-title',
    CLOSE_TAB: 'close-tab',
    COFFEE_BTN: 'coffee-btn',
    BOOKMARKED: 'bookmarked'
};

export const DOMIds = {
    TAB_BAR: 'tabBar',
    CONTENT_AREA: 'content-area',
    OPEN_BROWSER_BTN: 'openBrowserBtn',
    ADD_TAB_BTN: 'addTabBtn',
    SETTINGS_BTN: 'settingsBtn',
    BOOKMARK_BTN: 'bookmarkBtn',
    TOGGLE_BOOKMARK_BTN: 'toggleBookmarkBtn',
    BOOKMARKS_MODAL: 'bookmarksModal',
    CLOSE_MODAL_BTN: 'closeModalBtn',
    BOOKMARKS_LIST: 'bookmarksList',
    EDIT_BOOKMARK_DIALOG: 'editBookmarkDialog',
    EDIT_BOOKMARK_TITLE: 'editBookmarkTitle',
    EDIT_BOOKMARK_URL: 'editBookmarkUrl',
    CANCEL_EDIT_BTN: 'cancelEditBtn',
    SAVE_EDIT_BTN: 'saveEditBtn'
};

export const Origins = {
    GEMINI: 'https://gemini.google.com'
};

export const Defaults = {
    NEW_TAB_TITLE: 'New',
    NEW_TAB_URL: 'https://gemini.google.com/app'
};

export const Timeouts = {
    INACTIVITY_LIMIT: 2 * 60 * 60 * 1000, // 2 Hours
    ANIMATION_DURATION: 375
};

export const Permissions = {
    IFRAME: "clipboard-write; camera; microphone"
};