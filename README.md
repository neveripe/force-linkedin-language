# Force LinkedIn Language

A Tampermonkey userscript that prevents LinkedIn from automatically switching your display language when you click links from Google Search or regional subdomains. It forces LinkedIn to remain in your preferred language and includes a built-in UI for easy configuration.

👉 **[Install the Script](https://raw.githubusercontent.com/neveripe/force-linkedin-language/master/src/force-linkedin-language.user.js)**

## Features

*   **URL Interception:** Automatically rewrites `?locale=` parameters in URLs before the page loads.
*   **Subdomain Redirection:** Redirects regional subdomains (e.g., `de.linkedin.com`, `fr.linkedin.com`) to the main `www.linkedin.com` domain.
*   **Race-Condition Proof:** Proactively manages LinkedIn's internal `lang` cookie to prevent server-side language resets.
*   **Injected UI Menu:** Provides a clean, native-looking dropdown menu to select your preferred language.
*   **Smart Autodetection:** Automatically detects your operating system/browser language and suggests the correct LinkedIn locale.
*   **SPA Support:** Observes internal navigation to ensure the language remains locked while browsing the feed or profiles.

## Prerequisites

You need a userscript manager installed in your browser.

*   **Desktop:** Install [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Edge, Safari, Opera).
*   **Android:** 
    *   **Firefox for Android:** Native support. Install Tampermonkey directly from the Mozilla Add-ons store.
    *   **Chromium alternatives:** Use browsers like **Kiwi Browser** or **Lemur Browser**, which support Chrome Web Store extensions, and install Tampermonkey.
*   **iOS:** Apple restricts extensions on third-party browsers like Chrome or Firefox. You must use:
    *   **Safari:** Install the free **Userscripts** app from the App Store and enable it in Safari's settings.
    *   **Orion Browser:** A specialized WebKit browser that natively supports installing Chrome/Firefox extensions.

## Installation

1. Make sure you have Tampermonkey installed.
2. Click the installation link below. Tampermonkey will automatically detect the script and open an install page.

👉 **[Install the Script](https://raw.githubusercontent.com/neveripe/force-linkedin-language/master/src/force-linkedin-language.user.js)**

*Alternatively, you can manually copy the contents of `force-linkedin-language.user.js` and paste it into a new Tampermonkey script.*

## Usage & Configuration

By default, the script locks your LinkedIn to English (`en_US`). To change your preferred language:

1. Open LinkedIn (`www.linkedin.com`).
2. Click the **Tampermonkey extension icon** in your browser toolbar.
3. Look under the script name and click **⚙️ Configure Language UI**.
4. A modal will appear on the screen. Select your desired language from the dropdown. 
5. Click **Save & Reload**. 

The script will update your cookies and reload the page in your chosen language. This setting is saved permanently for future visits.

## How It Works

When Google indexes LinkedIn profiles, it often links to localized versions. Clicking these links causes LinkedIn to overwrite your session cookie. 

This script runs at `document-start` (before the page renders). It intercepts the incoming URL, scrubs any foreign locale requests, forcefully rewrites the `.linkedin.com` `lang` cookie to match your saved preference, and seamlessly redirects the page to prevent the UI from flashing in the wrong language.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
