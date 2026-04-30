export const StorageKeys = {
    TABS: 'tabs',
    ACTIVE_TAB: 'active_tab',
    BOOKMARKS: 'bookmarks',
    PERSISTENCE_PREF: 'persistence_enabled',
    RESET_BROKEN_ON_START: 'reset_broken_on_start',
    THEME_PREF: 'theme_preference',
    PANEL_ZOOM: 'panel_zoom',
    ENABLED_PROVIDERS: 'enabled_providers'
};

export const MessageTypes = {
    STATE_CHANGED: 'STATE_CHANGED',
    CHECK_STATE: 'CHECK_STATE'
};

export const CSSClasses = {
    TAB: 'tab',
    ACTIVE: 'active',
    SLIDE_OUT: 'slide-out',
    TAB_TITLE: 'tab-title',
    CLOSE_TAB: 'close-tab',
    COFFEE_BTN: 'coffee-btn',
    BOOKMARKED: 'bookmarked',
    TAB_PROVIDER_ICON: 'tab-provider-icon',
    TAB_DRAGGING: 'dragging',
    TAB_DROP_BEFORE: 'drop-before',
    TAB_DROP_AFTER: 'drop-after'
};

export const DOMIds = {
    TAB_BAR: 'tabBar',
    CONTENT_AREA: 'content-area',
    OPEN_BROWSER_BTN: 'openBrowserBtn',
    ADD_TAB_GROUP: 'addTabGroup',
    SETTINGS_BTN: 'settingsBtn',
    COFFEE_BTN: 'coffeeBtn',
    BOOKMARK_BTN: 'bookmarkBtn',
    TOGGLE_BOOKMARK_BTN: 'toggleBookmarkBtn',
    BOOKMARKS_MODAL: 'bookmarksModal',
    CLOSE_MODAL_BTN: 'closeModalBtn',
    BOOKMARKS_LIST: 'bookmarksList',
    EDIT_BOOKMARK_DIALOG: 'editBookmarkDialog',
    EDIT_BOOKMARK_TITLE: 'editBookmarkTitle',
    EDIT_BOOKMARK_URL: 'editBookmarkUrl',
    CANCEL_EDIT_BTN: 'cancelEditBtn',
    SAVE_EDIT_BTN: 'saveEditBtn',
    DELETE_CONFIRM_DIALOG: 'deleteConfirmDialog',
    CANCEL_DELETE_BTN: 'cancelDeleteBtn',
    CONFIRM_DELETE_BTN: 'confirmDeleteBtn',
    SETTINGS_MODAL: 'settingsModal',
    CLOSE_SETTINGS_BTN: 'closeSettingsBtn',
    RELEASE_NOTES_MODAL: 'releaseNotesModal',
    OPEN_RELEASE_NOTES_BTN: 'openReleaseNotesBtn',
    CLOSE_RELEASE_NOTES_BTN: 'closeReleaseNotesBtn',
    PROVIDERS_GROUP: 'providersGroup'
};

export const Timeouts = {
    INACTIVITY_LIMIT: 2 * 60 * 60 * 1000, // 2 Hours
    ANIMATION_DURATION: 375,
    // How often the side panel pings each mounted iframe with CHECK_STATE so
    // provider content scripts re-report their current URL/title. Acts as a
    // safety net for SPAs (notably ChatGPT) where DOM-observer-based
    // navigation detection inside the iframe is unreliable.
    STATE_POLL_INTERVAL_MS: 2000
};

export const Permissions = {
    IFRAME: "clipboard-write; camera; microphone"
};
