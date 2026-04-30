# Gemini Side Panel Extended

**Gemini Side Panel Extended** is a Chrome Extension that integrates Google Gemini directly into your browser's side panel. It provides a persistent, multi-tabbed experience, enabling you to maintain multiple conversation contexts simultaneously without leaving your current webpage.

## Features

-   **Side Panel Integration**: Access Google Gemini instantly alongside your browsing.
-   **Multi-Tab Support**: Create and manage multiple Gemini tabs within the side panel.
-   **Bookmarks & Saved Chats**: Save specific chats as bookmarks for quick access. Edit titles/URLs, detect broken links automatically, and organize your favorite conversations.
-   **Release Notes**: View version history and changelog directly from within Settings.
-   **State Persistence (Optional)**: Open tabs and URLs are saved automatically by default. Disable in Settings to always start with a fresh session.
-   **Smart Resource Management**: Background tabs are lazy-loaded; inactive tabs are unloaded after 2 hours to save system resources.
-   **Theme Support**: Syncs with your system or browser theme preferences (Dark/Light/System) with smooth transitions.
-   **Customizable Zoom**: Adjust content size from 50% to 120% via the Settings drawer.
-   **Keyboard Navigation**: Arrow keys to switch tabs, Enter/Space to activate, Delete to close. Roving tabindex with focus restoration.
-   **Accessibility**: ARIA labels on all icon buttons, screen-reader-friendly controls, focus management.
-   **Keyboard Shortcut**: Fast panel access via `Alt+G` (default).
-   **Seamless Navigation**: Open any Gemini chat in a full browser tab with a single click.

## Installation

Since this extension is not yet in the Chrome Web Store, you can install it in Developer Mode:

1.  **Clone or Download** this repository to your local machine.
2.  Open Google Chrome and navigate to `chrome://extensions/`.
3.  Enable **Developer mode** by toggling the switch in the top-right corner.
4.  Click the **Load unpacked** button.
5.  Select the directory where you downloaded/cloned this project (ensure it contains the `manifest.json` file).
6.  The extension is now installed! Click the puzzle piece icon in your toolbar and pin **Gemini Side Panel Extended** for easy access.

## Usage

1.  **Open the Panel**: Click the extension icon in the toolbar or press `Alt+G`.
2.  **Manage Tabs**:
    -   Click **+** to add a new fresh Gemini session.
    -   Click the **x** on a tab to close it (or press `Delete` when a tab is focused).
    -   Use **Arrow Left/Right** keys to navigate between tabs.
    -   Switch between tabs to maintain different conversation contexts (e.g., "Coding", "Writing", "General").
3.  **Bookmarks**:
    -   Click the **bookmark icon** in the tab bar to save/unsave the current chat.
    -   Access your saved chats via the **Bookmarks list** button in the right sidebar.
    -   Click on a bookmark to open it. Use the **edit (pencil)** icon to rename bookmarks or the **delete (trash)** icon to remove them.
    -   Broken bookmarks (deleted or moved conversations) are detected automatically and visually flagged.
4.  **Settings**: Click the **Settings (gear icon)** at the bottom of the right sidebar to open the **Settings Drawer**:
    -   Configure theme preferences (System, Light, or Dark).
    -   Adjust the content zoom level (50%–120%).
    -   Enable or disable tab persistence.
    -   View **Release Notes** for version history.
5.  **Buy Me a Coffee**: Support link available in the right sidebar toolbar.

## Technical Architecture

This extension uses a modern, modular **Component-Based Architecture** with **JS-Driven UI Rendering**. The codebase is organized into layers: core logic, reusable components, feature modules, and platform-specific scripts.

### Architectural Layers

1.  **Core (`js/core/`)**:
    -   **`app.js`**: Main entry point and controller. Initializes the application, composes components, and coordinates inter-component events (including 3-way mutual exclusion between Settings, Bookmarks, and Release Notes modals).
    -   **`store.js`**: Centralized State Manager. Single source of truth for tabs and active state, with persistence, validation, and debounced writes to `chrome.storage`.
    -   **`config.js`**: Constants for storage keys, DOM IDs, CSS classes, timeouts, origins, and defaults.
    -   **`icons.js`**: SVG icon definitions used across the UI.
    -   **`utils.js`**: Shared utility functions (e.g., `crypto.randomUUID()`-based ID generation).

2.  **Components (`js/components/`)**:
    -   **`ui-manager.js` (ViewRenderer)**: Primary UI orchestrator. Composes TabBar, IframeHandler, BookmarksUI, and ReleaseNotesUI. Manages modal lifecycle and event delegation.
    -   **`tabs-ui.js` (TabBar)**: Tab strip rendering, switching, animations (slide-in/out), keyboard navigation (roving tabindex), and focus management.
    -   **`web-views.js` (IframeHandler)**: Creates and manages `iframe` elements with lazy-loading and inactivity-based unloading.
    -   **`bookmarks-ui.js` (BookmarksUI)**: Bookmarks modal DOM, edit/delete sub-dialogs, broken-link indicators.
    -   **`release-notes-ui.js` (ReleaseNotesUI)**: Release Notes modal with async JSON data loading, session-lifetime caching, and XSS-safe HTML rendering.

3.  **Features (`js/features/`)**:
    -   **`bookmarks.js`**: Bookmark storage, CRUD operations, and data validation.
    -   **`link-validator.js`**: Detects broken Gemini deep links by checking redirect-to-`/app` behavior.
    -   **`settings.js`**: User preferences (theme, zoom, persistence) and Settings panel UI. Dispatches events for Release Notes access.
    -   **`theme.js`**: Theme application, system-preference synchronization, and flash-of-wrong-theme prevention.
    -   **`zoom.js`**: Content scaling with clamped range (50–120%) and corrupt-value protection.

4.  **Platform (`js/platform/`)**:
    -   **`service-worker.js`**: Background service worker. Uses `declarativeNetRequest` to strip `content-security-policy` and `x-frame-options` headers, allowing Gemini to be embedded in the side panel iframe.
    -   **`content-script.js`**: Injected into Gemini frames to bridge URL/title updates between the SPA and the extension via `postMessage`.

### Key Design Decisions

-   **JS-Driven Rendering**: HTML is minimal (`sidepanel.html` is a skeleton). All UI components (tabs, modals, lists) are rendered dynamically via JavaScript template literals for a flexible, component-oriented structure.
-   **Event-Driven Communication**: Components extend `EventTarget` and communicate via `CustomEvent` dispatching. State changes propagate through a pub/sub pattern.
-   **CSS Architecture**: Styles are split into four scoped files (`base.css` → `components.css` → `modals.css` → `settings.css`) loaded in dependency order. CSS custom properties enable theming.
-   **Performance**: Lazy-loaded background tabs, debounced state persistence, session-lifetime data caching, and `requestAnimationFrame`-gated theme transitions.
-   **Security**: XSS protection via `escapeHtml()` on all user-facing data rendering. `crypto.randomUUID()` for collision-safe IDs. Minimal header stripping in the service worker.

## Project Structure

```text
├── css/
│   ├── base.css             # Theme variables, resets, layout containers
│   ├── components.css       # Tabs, buttons, content area, animations
│   ├── modals.css           # Modal infrastructure, bookmarks, dialogs, release-notes content
│   └── settings.css         # Settings panel form controls, slider, about section
├── data/
│   └── release-notes.json   # Version history (loaded at runtime via fetch)
├── html/
│   └── sidepanel.html       # Main entry point (skeleton)
├── images/                  # Extension icons (16/32/48/128px)
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
│   │   ├── store.js
│   │   └── utils.js
│   ├── features/            # Feature Modules
│   │   ├── bookmarks.js
│   │   ├── link-validator.js
│   │   ├── settings.js
│   │   ├── theme.js
│   │   └── zoom.js
│   └── platform/            # Browser/Extension Platform Scripts
│       ├── content-script.js
│       └── service-worker.js
├── manifest.json            # Extension configuration (Manifest V3)
└── README.md                # This file
```

## Version

Current version: **0.4.3** — see `data/release-notes.json` for full changelog.