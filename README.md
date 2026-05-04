# Force LinkedIn Language

A Tampermonkey userscript that prevents LinkedIn from automatically switching your display language. When you click localized links (e.g., from `de.linkedin.com`), LinkedIn silently overrides your language preference. This script forces LinkedIn to stay in your chosen language — across **all** pages, including notifications and settings — by managing both the browser cookie and your account-level language setting.

👉 **[Install the Script](https://raw.githubusercontent.com/neveripe/force-linkedin-language/master/src/force-linkedin-language.user.js)**

## Features

*   **Full Language Override:** Changes both the `lang` cookie and your LinkedIn account language setting, ensuring all pages (including server-rendered ones like notifications) display in your preferred language.
*   **URL Interception:** Automatically rewrites `?locale=` parameters in URLs before the page loads.
*   **Subdomain Redirection:** Redirects regional subdomains (e.g., `de.linkedin.com`, `fr.linkedin.com`) to the main `www.linkedin.com` domain.
*   **Race-Condition Proof:** Runs at `document-start` and proactively manages LinkedIn's `lang` cookie to prevent the UI from flashing in the wrong language.
*   **34 Supported Locales:** Covers all LinkedIn-supported languages with a clean, native-looking dropdown for selection.
*   **Smart Autodetection:** Automatically detects your OS/browser language and suggests the matching LinkedIn locale.
*   **SPA Support:** Monitors navigation within LinkedIn's single-page app to keep the language locked across page transitions.
*   **Fallback Banner:** If the automatic settings change fails, a dismissable banner appears with a direct link to change the setting manually.

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

The script will briefly navigate to LinkedIn's language settings page to update your account setting, then return you to your original page. This is a one-time operation per language change — your preference is saved permanently for future visits.

## How It Works

LinkedIn determines page language from two sources: a browser cookie (`lang`) and a server-side account setting. Simply overriding the cookie is not enough — server-rendered pages like notifications ignore it and use the account setting instead.

This script handles both:

1. **At page load** (`document-start`): intercepts the URL, scrubs foreign `?locale=` parameters, redirects regional subdomains to `www.linkedin.com`, and sets the `lang` cookie.
2. **On language change**: navigates to LinkedIn's language settings page, programmatically changes the dropdown to your chosen locale (triggering LinkedIn's auto-save), then redirects back to your original page.
3. **During browsing**: monitors SPA navigation to re-apply the cookie on route changes.

For detailed technical documentation, see [LIMITATIONS.md](LIMITATIONS.md).

## License

This project is licensed under the Zero-Clause BSD License - see the [LICENSE](LICENSE) file for details.
