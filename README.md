# Gemini Side Panel Extended

**Gemini Side Panel Extended** is a Chrome Extension that integrates Google Gemini directly into your browser's side panel. It allows for a persistent, multi-tabbed experience, enabling you to maintain multiple conversation contexts simultaneously without leaving your current webpage.

## Features

-   **Side Panel Integration**: Access Google Gemini instantly alongside your browsing.
-   **Multi-Tab Support**: Create and manage multiple Gemini tabs within the side panel itself.
-   **State Persistence**: Your open tabs and current URLs are saved automatically. If you close the browser, your workspace is restored next time you open the panel.
-   **Theme Support**: Automatically syncs with your system or browser theme preferences (Dark/Light/System).
-   **Keyboard Shortcut**: fast access via `Alt+G` (default).
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

## Permissions

This extension requires the following permissions to function:

-   `sidePanel`: To render the interface in the browser's side panel.
-   `storage`: To save your open tabs and settings locally.
-   `declarativeNetRequest`: To handle specific network requests required for embedding Gemini.
-   `host_permissions` (`https://gemini.google.com/*`): To embed the Gemini web interface and synchronize navigation state.

## Development

### Project Structure

-   `manifest.json`: Extension configuration (Manifest V3).
-   `html/`: HTML templates for the side panel and options page.
-   `css/`: Stylesheets for the UI.
-   `js/`: Core logic.
    -   `main.js`: Application entry point.
    -   `state-handler.js`: Manages tab state and storage.
    -   `view-renderer.js`: Handles DOM updates and UI rendering.
    -   `service-worker.js`: Background script.
    -   `content-script.js`: Runs within the Gemini iframe to detect navigation and title changes.

### building

No build step is required (vanilla JS/CSS). Changes to the code can be tested by clicking the "Refresh" icon on the extension card in `chrome://extensions/`.

## License

[MIT](LICENSE)
