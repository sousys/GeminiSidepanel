# Gemini Side Panel Extended

**Gemini Side Panel Extended** is a Chrome Extension that integrates Google Gemini directly into your browser's side panel. It allows for a persistent, multi-tabbed experience, enabling you to maintain multiple conversation contexts simultaneously without leaving your current webpage.

## Features

-   **Side Panel Integration**: Access Google Gemini instantly alongside your browsing.
-   **Multi-Tab Support**: Create and manage multiple Gemini tabs within the side panel itself.
-   **Bookmarks & Saved Chats**: Save specific chats as bookmarks for quick access. Organize your favorite conversations and open them in new tabs or focus existing ones.
-   **State Persistence (Optional)**: Your open tabs and current URLs are saved automatically by default. You can disable this in settings to always start with a fresh session.
-   **Smart Resource Management**: Background tabs are lazy-loaded and inactive tabs are unloaded to save system resources.
-   **Theme Support**: Automatically syncs with your system or browser theme preferences (Dark/Light/System).
-   **Refined User Interface**: Polished tab bar with uniform icon sizing and spacing for a cleaner look.
-   **Customizable Zoom**: Adjust the content size of the side panel from 50% to 120% via the Settings drawer.
-   **Keyboard Shortcut**: Fast access via `Alt+G` (default).
-   **Seamless Navigation**: Open any specific Gemini chat in a full browser tab with a single click.

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
    -   Click the **x** on a tab to close it.
    -   Switch between tabs to maintain different conversation contexts (e.g., "Coding", "Writing", "General").
3.  **Bookmarks**:
    -   Click the **bookmark icon** (star) in the top tab bar to save the current chat.
    -   Access your saved chats via the **Bookmarks list** button in the sidebar.
    -   Click on a bookmark to open it. Use the **edit (pencil)** icon to rename bookmarks or the **delete (trash can)** icon to remove them.
4.  **Settings**: Click the **Settings (gear icon)** in the bottom-left toolbar of the side panel to open the **Settings Drawer**:
    -   Configure theme preferences (System, Light, or Dark).
    -   Adjust the content zoom level (50% - 120%) to better fit your screen.
    -   **Behavior**: Enable or disable tab persistence. Disabling it ensures a fresh start every time you open the panel.

## Technical Architecture

This extension uses a modern, modular **Component-Based Architecture** with **JS-Driven UI Rendering**. The codebase is organized into distinct layers for core logic, reusable components, feature modules, and platform-specific scripts.

### Architectural Layers

1.  **Core (`js/core/`)**:
    -   **`app.js`**: The main entry point and controller. It initializes the application, composes components, and handles high-level event coordination.
    -   **`store.js`**: The centralized State Manager (Model). It manages the single source of truth for tabs and active state, handling persistence and notifying subscribers of changes.
    -   **`config.js`**: Centralized configuration for constants, DOM IDs, CSS classes, and timeouts.
    -   **`utils.js`**: Shared utility functions.

2.  **Components (`js/components/`)**:
    -   **`ui-manager.js` (ViewRenderer)**: The primary UI orchestrator. It manages the lifecycle of the UI, including modals and event delegation.
    -   **`tabs-ui.js` (TabBar)**: Manages the tab strip interface, including rendering, switching, and animation logic.
    -   **`web-views.js` (IframeHandler)**: Handles the creation and lifecycle of `iframe` elements. It implements performance optimizations like lazy-loading and inactivity unloading.

3.  **Features (`js/features/`)**:
    -   **`bookmarks.js`**: Manages bookmark storage, logic, and its specific UI rendering (Modals).
    -   **`settings.js`**: Handles user preferences (theme, zoom, persistence) and the Settings UI.
    -   **`theme.js`**: Manages theme application and synchronization with system/browser preferences.
    -   **`zoom.js`**: Handles content scaling logic.

4.  **Platform (`js/platform/`)**:
    -   **`service-worker.js`**: The background service worker. Handles extension lifecycle and uses `declarativeNetRequest` to strip `X-Frame-Options` headers, allowing Gemini to run in the side panel.
    -   **`content-script.js`**: Injected into the Gemini frame to bridge communication (URL/Title updates) between the SPA and the extension using `postMessage`.

### Key Design Decisions

-   **JS-Driven Rendering**: HTML files are minimal (only `sidepanel.html` exists as a skeleton). All other UI components (tabs, modals, lists) are rendered dynamically via JavaScript template literals. This allows for a more flexible and component-oriented structure.
-   **Event-Driven Communication**: Components communicate via `CustomEvent` dispatching (e.g., `tab-switch`, `bookmark-toggle`) and a subscription pattern in the State Manager.
-   **Performance**: Background tabs are lazy-loaded to minimize memory usage, and the state is persisted to `chrome.storage` with debouncing.

## Project Structure

```text
├── css/
│   └── style.css            # Global styles and theme definitions
├── html/
│   └── sidepanel.html       # Main entry point (skeleton)
├── images/                  # Icons and assets
├── js/
│   ├── components/          # UI Components
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
│   │   ├── settings.js
│   │   ├── theme.js
│   │   └── zoom.js
│   └── platform/            # Browser/Extension Platform Scripts
│       ├── content-script.js
│       └── service-worker.js
├── manifest.json            # Extension configuration (Manifest V3)
└── README.md                # This file
```

## License

[MIT](LICENSE)