# Gemini Side Panel Extended

**Gemini Side Panel Extended** is a Chrome Extension that integrates Google Gemini directly into your browser's side panel. It allows for a persistent, multi-tabbed experience, enabling you to maintain multiple conversation contexts simultaneously without leaving your current webpage.

## Features

-   **Side Panel Integration**: Access Google Gemini instantly alongside your browsing.
-   **Multi-Tab Support**: Create and manage multiple Gemini tabs within the side panel itself.
-   **State Persistence**: Your open tabs and current URLs are saved automatically using `chrome.storage`. If you close the browser, your workspace is restored next time you open the panel.
-   **Smart Resource Management**: Background tabs are lazy-loaded and inactive tabs are unloaded to save system resources.
-   **Theme Support**: Automatically syncs with your system or browser theme preferences (Dark/Light/System).
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
3.  **Options**: Right-click the extension icon and select **Options** to configure theme preferences (System, Light, or Dark).

## Technical Architecture

This extension uses a **Model-View-Controller (MVC)** like architecture to manage the side panel state and UI.

### Core Components

1.  **Service Worker (`service-worker.js`)**:
    -   Handles the extension's lifecycle and side panel behavior.
    -   **Critical**: Uses the `declarativeNetRequest` API to strip `X-Frame-Options` and `Content-Security-Policy` headers from `gemini.google.com` responses. This allows the Gemini web application to be embedded within an `iframe` in the side panel.

2.  **State Management (`js/state-handler.js`)**:
    -   Acts as the **Model**.
    -   Manages the single source of truth for the application state (list of open tabs, active tab ID).
    -   Persists state to `chrome.storage.local`.
    -   Implements a subscription pattern to notify other components of state changes.

3.  **Main Controller (`js/main.js`)**:
    -   Acts as the **Controller**.
    -   Initializes the application.
    -   Listens for UI events (tab clicks, new tab creation) and delegates them to the `StateManager`.
    -   Receives messages from the `content-script.js` to update tab titles and URLs.

4.  **View Rendering (`js/view-renderer.js`, `js/tab-bar.js`, `js/iframe-handler.js`)**:
    -   Acts as the **View**.
    -   `ViewRenderer` orchestrates the UI updates.
    -   `TabBar` manages the tab strip UI.
    -   `IframeHandler` handles the `iframe` elements. It implements **performance optimizations** by:
        -   Lazy-loading iframes only when they are activated.
        -   Unloading iframes that haven't been accessed recently to free up memory.

5.  **Content Script (`js/content-script.js`)**:
    -   Injected into the `gemini.google.com` iframe.
    -   Patches the browser's History API (`pushState`, `replaceState`) to detect client-side navigation within the Gemini SPA.
    -   Communicates URL and Title changes back to the parent extension via `window.parent.postMessage`.

## Permissions

This extension requires the following permissions:

-   `sidePanel`: To render the interface in the browser's side panel.
-   `storage`: To save your open tabs and settings locally.
-   `declarativeNetRequest`: To modify response headers for iframe compatibility.
-   `host_permissions` (`https://gemini.google.com/*`): To embed the Gemini web interface and synchronize navigation state.

## Project Structure

```text
├── css/                # Stylesheets
├── html/               # HTML templates (sidepanel, options)
├── images/             # Icons and assets
├── js/
│   ├── constants.js    # Global constants
│   ├── iframe-handler.js  # Iframe lifecycle & optimization
│   ├── content-script.js  # Injected script for Gemini integration
│   ├── icons.js        # SVG icon definitions
│   ├── main.js         # Entry point & controller
│   ├── options.js      # Options page logic
│   ├── service-worker.js # Background process & network handling
│   ├── state-handler.js  # State management & storage
│   ├── tab-bar.js      # Tab strip UI logic
│   ├── theme-handler.js # Theme synchronization
│   ├── utils.js        # Helper functions
│   └── view-renderer.js   # UI orchestration
├── manifest.json       # Extension configuration (Manifest V3)
└── README.md           # This file
```

## License

[MIT](LICENSE)