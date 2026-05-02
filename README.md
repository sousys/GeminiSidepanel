# AI MultiTab Sidepanel

**AI MultiTab Sidepanel** is a Chrome Extension that integrates multiple AI providers (Gemini, ChatGPT, and Claude) directly into your browser's side panel. It provides a persistent, multi-tabbed experience, enabling you to maintain multiple conversation contexts across providers simultaneously without leaving your current webpage.


## Installation

This extension works in both **Google Chrome** and **Microsoft Edge**. Since it is not yet in the Chrome Web Store (or Edge Add-ons store), you can install it in Developer Mode:

1.  **Clone or Download** this repository to your local machine.
2.  Open **Chrome** (`chrome://extensions/`) or **Edge** (`edge://extensions/`) — or select **Manage extensions** from the browser menu (⋮ / … → Extensions → Manage extensions).
3.  Enable **Developer mode** by toggling the switch in the top-right corner.
4.  Click the **Load unpacked** button.
5.  Select the directory where you downloaded/cloned this project (ensure it contains the `manifest.json` file).
6.  The extension is now installed! Click the puzzle piece icon in your toolbar and pin **AI MultiTab Sidepanel** for easy access.

> **Tip:** For some providers (Gemini, ChatGPT, Claude) you may need to **log in once in a regular browser tab** before the side panel can show your account and conversations. Once logged in, the side panel will pick up your session automatically.

## Features

-   **Multi-Provider Support**: Use Google Gemini, OpenAI ChatGPT, and Anthropic Claude side-by-side. Enable/disable providers from Settings. Claude is a *lightweight integration* — it has no sidebar or chat history when embedded; bookmarks and "Open in browser" still work normally.
-   **Side Panel Integration**: Access your AI providers instantly alongside your browsing.
-   **Multi-Tab Support**: Create and manage multiple chat tabs across providers, with drag-and-drop reordering.
-   **Provider Picker**: A single **+** button reveals a hover/click/keyboard-accessible vertical menu of provider icons for starting a new chat with any enabled provider. When only one provider is enabled, the picker collapses to a one-click shortcut showing that provider's icon.
-   **Branded Provider Icons**: Each tab and bookmark displays the real provider logo (Gemini sparkle, OpenAI monoblossom, Claude wordmark) so you always know which AI you're looking at. Limited-scope providers also get a brand-colored accent stripe on the tab pill.
-   **Bookmarks & Saved Chats**: Save specific chats as bookmarks for quick access. Bookmarks remember their provider and display the matching provider icon. Edit titles/URLs, detect broken links automatically, and organize your favorite conversations.
-   **Live Zoom**: Adjust content size from 50% to 120% via the Settings drawer — the panel resizes in real time as you drag the slider.
-   **Release Notes**: View version history and changelog directly from within Settings.
-   **State Persistence (Optional)**: Open tabs and URLs are saved automatically by default. Disable in Settings to always start with a fresh session.
-   **Smart Resource Management**: Background tabs are lazy-loaded; inactive tabs are unloaded after 2 hours to save system resources.
-   **Reliable Title Sync**: The side panel periodically polls every mounted iframe for its current URL and title, ensuring tab titles stay accurate even inside heavy SPAs like ChatGPT without requiring manual interaction.
-   **Theme Support**: Syncs with your system or browser theme preferences (Dark/Light/System) with smooth transitions.
-   **Keyboard Navigation**: Arrow keys to switch tabs, Enter/Space to activate, Delete to close. Provider picker supports Arrow/Enter/Space/Escape. Roving tabindex with focus restoration.
-   **Accessibility**: ARIA labels on all icon buttons and the provider picker menu, screen-reader-friendly controls, focus management.
-   **Keyboard Shortcut**: Fast panel access via `Alt+G` (default).
-   **Seamless Navigation**: Open any chat in a full browser tab with a single click.

## Usage

1.  **Open the Panel**: Click the extension icon in the toolbar or press `Alt+G`.
2.  **Manage Tabs**:
    -   Click **+** (or hover over it) to open the provider picker, then click a provider icon to start a new chat.
    -   The provider picker is also keyboard-accessible: Tab to reach it, Enter/Space/Arrow keys to navigate, Escape to close.
    -   Click the **x** on a tab to close it (or press `Delete` when a tab is focused).
    -   Use **Arrow Left/Right** keys to navigate between tabs.
    -   Drag tabs to reorder them.
3.  **Bookmarks**:
    -   Click the **bookmark icon** in the tab bar to save/unsave the current chat.
    -   Access your saved chats via the **Bookmarks list** button in the right sidebar.
    -   Each bookmark shows the provider's icon before its title.
    -   Click on a bookmark to open it. Use the **edit (pencil)** icon to rename bookmarks or the **delete (trash)** icon to remove them.
    -   Broken bookmarks (deleted or moved conversations) are detected automatically and visually flagged.
4.  **Settings**: Click the **Settings (gear icon)** at the bottom of the right sidebar to open the **Settings Drawer**:
    -   Configure theme preferences (System, Light, or Dark).
    -   Adjust the content zoom level (50%–120%) — the panel resizes live as you drag.
    -   Enable or disable tab persistence.
    -   Enable or disable individual providers.
    -   View **Release Notes** for version history.
5.  **Buy Me a Coffee**: Support link available in the right sidebar toolbar.

## Technical Architecture

This extension uses a modern, modular **Component-Based Architecture** with **JS-Driven UI Rendering**. The codebase is organized into layers: core logic, reusable components, feature modules, provider integrations, and platform-specific scripts.

### Architectural Layers

1.  **Core (`js/core/`)**:
    -   **`app.js`**: Main entry point and controller. Initializes the application, composes components, and coordinates inter-component events (including 3-way mutual exclusion between Settings, Bookmarks, and Release Notes modals). Listens for `STATE_CHANGED` postMessages from provider content scripts.
    -   **`store.js`**: Centralized State Manager. Single source of truth for tabs and active state, with persistence, validation, and debounced writes to `chrome.storage`.
    -   **`config.js`**: Constants for storage keys, DOM IDs, CSS classes, timeouts, origins, and defaults.
    -   **`icons.js`**: SVG icon definitions used across the UI.
    -   **`provider-registry.js`**: Provider lookup helpers (`getProviderById`, `getProviderByOrigin`, `getProviderByUrl`) used across the app.
    -   **`utils.js`**: Shared utility functions (e.g., `crypto.randomUUID()`-based ID generation).

2.  **Components (`js/components/`)**:
    -   **`ui-manager.js` (ViewRenderer)**: Primary UI orchestrator. Composes TabBar, IframeHandler, BookmarksUI, and ReleaseNotesUI. Manages modal lifecycle and event delegation.
    -   **`tabs-ui.js` (TabBar)**: Tab strip rendering with branded provider icons, switching, animations (slide-in/out), keyboard navigation (roving tabindex), and focus management. Hosts the provider picker (`+` button with hover/click/keyboard-accessible dropdown).
    -   **`web-views.js` (IframeHandler)**: Creates and manages `iframe` elements with lazy-loading and inactivity-based unloading. Runs a 2-second poll that sends `CHECK_STATE` to every mounted iframe, ensuring SPA navigation events (especially in ChatGPT's volatile React DOM) are always reflected in tab titles. Pauses polling when the side panel is hidden to save resources.
    -   **`bookmarks-ui.js` (BookmarksUI)**: Bookmarks modal DOM, edit/delete sub-dialogs, broken-link indicators, and provider-icon rendering per bookmark.
    -   **`release-notes-ui.js` (ReleaseNotesUI)**: Release Notes modal with async JSON data loading, session-lifetime caching, and XSS-safe HTML rendering.

3.  **Features (`js/features/`)**:
    -   **`bookmarks.js`**: Bookmark storage, CRUD operations, data validation, and single-notify migration (adds `providerId` to legacy bookmarks on first load).
    -   **`link-validator.js`**: Detects broken deep links by checking redirect-to-new-chat behavior.
    -   **`settings.js`**: User preferences (theme, zoom, persistence, enabled providers) and Settings panel UI.
    -   **`theme.js`**: Theme application, system-preference synchronization, and flash-of-wrong-theme prevention.
    -   **`zoom.js`**: Content scaling with clamped range (50–120%), live-update on drag, and corrupt-value protection.

4.  **Providers (`js/providers/`)**:
    -   **`content-script-common.js`**: Shared utilities injected into all provider iframes before the provider-specific script. Exposes `debounce`, `patchHistory`, `trackUserInteraction`, `sendStateUpdate`, and `listenForCheckState` on `globalThis.__AIMS_CS`.
    -   **`gemini/content-script.js`**: Gemini-specific SPA navigation tracker. Observes the `conversations-list` custom element (stable across React renders) and extracts conversation titles via URL-derived IDs and sidebar DOM lookup.
    -   **`gemini/index.js`**: Gemini provider configuration (origin, routes, icon, etc.).
    -   **`chatgpt/content-script.js`**: ChatGPT-specific SPA navigation tracker. Observes the `#history` element with a `MutationObserver` and also watches `<head><title>` for rename events. Works in concert with the parent's 2-second `CHECK_STATE` poll to guarantee title accuracy.
    -   **`chatgpt/index.js`**: ChatGPT provider configuration.
    -   **`claude/content-script.js`**: Claude-specific tracker. Claude renders a stripped composer-only layout when embedded in an iframe (no sidebar, no chat history), so titles are extracted from `<title>` only.
    -   **`claude/index.js`**: Claude provider configuration. Includes the optional `limited` / `limitations` capability descriptor consumed generically by the UI to render the tab accent stripe, settings chips, first-run hint strip, and disabled toolbar buttons.

5.  **Platform (`js/platform/`)**:
    -   **`service-worker.js`**: Background service worker. Uses `declarativeNetRequest` to strip `content-security-policy` and `x-frame-options` headers, allowing AI providers to be embedded in the side panel iframe.

### Key Design Decisions

-   **JS-Driven Rendering**: HTML is minimal (`sidepanel.html` is a skeleton). All UI components (tabs, modals, lists, provider picker) are rendered dynamically via JavaScript template literals.
-   **Event-Driven Communication**: Components extend `EventTarget` and communicate via `CustomEvent` dispatching. State changes propagate through a pub/sub pattern.
-   **Provider Content-Script Bridge**: Content scripts use `postMessage` with a strict `targetOrigin` (the extension's own origin) to report `STATE_CHANGED` events. The parent polls with `CHECK_STATE` every 2 seconds as a reliable fallback for SPAs that replace DOM nodes the observer is attached to.
-   **CSS Architecture**: Styles are split into four scoped files (`base.css` → `components.css` → `modals.css` → `settings.css`) loaded in dependency order. CSS custom properties enable theming.
-   **Performance**: Lazy-loaded background tabs, debounced state persistence, session-lifetime data caching, `requestAnimationFrame`-gated theme transitions, and visibility-aware polling (paused when the panel is hidden).
-   **Security**: XSS protection via `escapeHtml()` on all user-facing data rendering. `crypto.randomUUID()` for collision-safe IDs. Minimal header stripping in the service worker. `postMessage` calls always use provider-specific `targetOrigin`, never `'*'`.

## Project Structure

```text
├── css/
│   ├── base.css             # Theme variables, resets, layout containers
│   ├── components.css       # Tabs, provider picker, buttons, content area, animations
│   ├── modals.css           # Modal infrastructure, bookmarks, dialogs, release-notes content
│   └── settings.css         # Settings panel form controls, slider, about section
├── data/
│   └── release-notes.json   # Version history (loaded at runtime via fetch)
├── html/
│   └── sidepanel.html       # Main entry point (skeleton)
├── images/                  # Extension icons and provider SVGs
│   ├── logo-{16,32,48,128}.png
│   ├── gemini-color.svg
│   ├── OpenAI-black-monoblossom.svg
│   └── OpenAI-white-monoblossom.svg
├── js/
│   ├── components/          # UI Components
│   │   ├── bookmarks-ui.js
│   │   ├── release-notes-ui.js
│   │   ├── tabs-ui.js
│   │   ├── ui-manager.js
│   │   └── web-views.js
│   ├── core/                # Core Application Logic
│   │   ├── app.js
│   │   ├── config.js
│   │   ├── icons.js
│   │   ├── provider-registry.js
│   │   ├── store.js
│   │   └── utils.js
│   ├── features/            # Feature Modules
│   │   ├── bookmarks.js
│   │   ├── link-validator.js
│   │   ├── settings.js
│   │   ├── theme.js
│   │   └── zoom.js
│   ├── platform/            # Browser/Extension Platform Scripts
│   │   └── service-worker.js
│   └── providers/           # Provider Content Scripts
│       ├── content-script-common.js
│       ├── chatgpt/
│       │   ├── content-script.js
│       │   └── index.js
│       └── gemini/
│           ├── content-script.js
│           └── index.js
├── manifest.json            # Extension configuration (Manifest V3)
└── README.md                # This file
```

## Version

Current version: **0.7.0** — see `data/release-notes.json` for full changelog.