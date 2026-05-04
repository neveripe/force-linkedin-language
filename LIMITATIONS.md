# Limitations

This document describes known limitations of the Force LinkedIn Language userscript. It is written for both human readers and AI agents who may work on this codebase with no other context.

## How LinkedIn Determines Page Language

LinkedIn uses **two independent mechanisms** to determine the display language:

1. **Client-side hint:** The `lang` cookie (format: `lang="v=2&lang=en-us"`). This preference cookie is sent with every request and influences CDN/edge rendering.
2. **Server-side account setting:** The `interfaceLocale` preference stored in LinkedIn's database, configured at `https://www.linkedin.com/mypreferences/d/settings/language`.

As of v3.0, the script controls **both** mechanisms:
- **Cookie:** Set directly via `document.cookie` at `document-start`.
- **Account setting:** Changed by programmatically automating the native settings page dropdown (DOM automation of the `<select>` element at `/mypreferences/d/settings/language`).

### How the Settings Automation Works

When the user selects a new language via the Tampermonkey modal, the script:

1. Saves the target locale and a `pendingLocaleChange` flag to `GM_setValue` storage.
2. Navigates the browser to `/mypreferences/d/settings/language`.
3. On that page, polls for the `<select>` dropdown to appear in the DOM.
4. Sets the dropdown value and dispatches `input` + `change` events.
5. LinkedIn's Ember.js framework detects the change and **auto-saves** via an internal API call.
6. Ember reloads the page to apply the new language.
7. On the reloaded page, the script detects `pendingLocaleChange === 'redirect'` and navigates back to the user's original page.

This is implemented as a two-phase state machine (`'apply'` → `'redirect'`) to survive the page reload triggered by Ember's auto-save.

## Known Limitations

### 1. Settings Page DOM Dependency

The settings automation depends on specific DOM selectors:

```javascript
document.querySelector('select[data-test-setting-dropdown]')
document.querySelector('.dropdown-container_interfaceLocale select')
```

If LinkedIn redesigns their settings page (replaces the `<select>` with a custom component, changes test attributes, etc.), the automation will fail. The fallback behavior is:

- After 10 seconds of polling (50 attempts × 200ms), the script gives up and redirects back.
- A **mismatch detection banner** appears on subsequent pages if the server-rendered `<html lang="...">` doesn't match the target locale. This banner links the user to the settings page for manual change.

### 2. Brief Settings Page Flash

During a language change, the user sees the settings page briefly (~2-3 seconds) before being redirected back. This is a one-time visual artifact per language change, not a recurring issue.

### 3. Email & Mobile App Language

Email notifications and the LinkedIn mobile app read the server-side account setting. Since v3.0 changes the account setting, these should eventually reflect the new language. However:

- **Email:** LinkedIn may cache the language preference for pending/queued notifications. Already-queued emails will use the old language.
- **Mobile app:** The app may cache the locale setting locally. A force-close and reopen of the app may be required.

### 4. Regional Subdomain Regex

The script uses `^[a-z]{2}\.linkedin\.com$` to detect regional subdomains (e.g., `de.linkedin.com`) and redirect to `www.linkedin.com`. This regex also matches non-regional functional subdomains like `lm.linkedin.com` (link management) and `ad.linkedin.com` (advertising).

**Practical risk is low:** Users rarely encounter functional subdomains as their browser's `location.hostname` because these redirect server-side before the userscript runs. If a false positive occurs, the result (redirect to `www.linkedin.com`) is harmless.

### 5. SPA Navigation Detection

The script uses a `MutationObserver` on the entire document (`{subtree: true, childList: true}`) to detect URL changes during SPA navigation. This is conceptually imprecise — it detects DOM changes and checks if the URL also changed, rather than detecting URL changes directly.

A more precise approach would be to monkey-patch `history.pushState`/`replaceState` + listen for `popstate`, or use the modern Navigation API (`navigation.addEventListener('navigate', ...)`). The current approach works correctly but fires the callback on every DOM mutation (the callback is cheap — just a string comparison).

## Cookie Format

LinkedIn wraps cookie values containing special characters (`&`, `:`, `=`) in RFC 6265 double quotes. The `lang` cookie format is:

```
lang="v=2&lang=en-us"
```

The double quotes are **part of the value** as stored and returned by `document.cookie`. This is consistent with other LinkedIn cookies:

- `bcookie="v=2&<uuid>"`
- `JSESSIONID="ajax:<id>"`
- `lidc="b=<value>:s=<value>:..."`

**Do not remove the double quotes.** They are intentional and match LinkedIn's own server-set format.

## Locale Code Format

LinkedIn uses two locale code formats in different contexts:

| Context | Format | Example |
|---|---|---|
| URL `?locale=` parameter | Underscore, mixed case | `en_US`, `uk_UA` |
| Cookie `lang` value | Hyphen, lowercase | `en-us`, `uk-ua` |
| Account settings dropdown | Underscore, mixed case | `en_US`, `uk_UA` |

The script converts between these using `locale.replace('_', '-').toLowerCase()`.
