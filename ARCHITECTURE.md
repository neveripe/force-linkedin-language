# Architecture & Development History

This document provides a complete technical reference for the **Force LinkedIn Language** userscript. It is designed to be fully self-contained — a human or AI agent should be able to understand the entire project from this document and the script source alone, without any additional context.

## Table of Contents

- [Project Overview](#project-overview)
- [The Problem](#the-problem)
- [Repository Structure](#repository-structure)
- [Script Architecture](#script-architecture)
- [Development History](#development-history)
- [Design Decisions & Rationale](#design-decisions--rationale)
- [LinkedIn Platform Internals](#linkedin-platform-internals)
- [Testing Approaches](#testing-approaches)

---

## Project Overview

**Force LinkedIn Language** is a Tampermonkey/Greasemonkey userscript (`force-linkedin-language.user.js`) that prevents LinkedIn from switching the user's display language. It runs in the browser via a userscript manager and enforces the user's preferred language across all LinkedIn pages.

- **Language:** JavaScript (vanilla, no build step, no dependencies)
- **Runtime:** Browser userscript manager (Tampermonkey, Greasemonkey, Violentmonkey)
- **Target site:** `*.linkedin.com`
- **License:** Zero-Clause BSD (0BSD)
- **Current version:** 3.1

---

## The Problem

LinkedIn uses regional subdomains for SEO (e.g., `de.linkedin.com`, `fr.linkedin.com`). When search engines index LinkedIn profiles, they often link to these localized versions. When a user clicks such a link:

1. LinkedIn detects the regional subdomain
2. LinkedIn overwrites the user's `lang` cookie with the subdomain's language
3. The user's entire LinkedIn session switches to that language
4. Navigating back to `www.linkedin.com` does not reset the language

This is particularly frustrating for users in multilingual environments or those who use a language different from their geographic region.

### The deeper problem (discovered during development)

LinkedIn determines page language from **two independent sources**:

1. **Client-side:** The `lang` cookie — a preference hint sent with each request
2. **Server-side:** The `interfaceLocale` account setting — stored in LinkedIn's database

For client-rendered pages (feed, profiles), the cookie/URL parameter is respected. For server-rendered pages (notifications, settings), the server ignores the cookie and uses the database value. Simply overriding the cookie is insufficient for full language control.

---

## Repository Structure

```
force-linkedin-language/
├── src/
│   └── force-linkedin-language.user.js    # The userscript (single file, no build)
├── ARCHITECTURE.md                         # This file
├── LIMITATIONS.md                          # Known limitations & platform details
├── README.md                               # User-facing documentation
└── LICENSE                                 # Zero-Clause BSD
```

---

## Script Architecture

The script is a single self-executing IIFE (Immediately Invoked Function Expression) that runs at `document-start`. It has five logical sections, executed in order:

### Execution Flow

```
┌─────────────────────────────────────────────────┐
│  1. DATA & CONFIGURATION                        │
│     - Locale map (34 languages)                 │
│     - BCP 47 → LinkedIn legacy code mapping     │
│     - Load user preferences from GM storage     │
│     - Cookie helper function                    │
├─────────────────────────────────────────────────┤
│  2. SETTINGS PAGE AUTOMATION                    │
│     IF pendingPhase AND on settings page:       │
│       Phase 'redirect' → navigate back, return  │
│       Phase 'apply' → find dropdown, change it, │
│                        set phase to 'redirect'  │
│     RETURN (skip remaining sections)            │
├─────────────────────────────────────────────────┤
│  3. UI: LANGUAGE SELECTOR MODAL                 │
│     - showLocaleSelector() function definition  │
│     - Registered via GM_registerMenuCommand     │
│     - Locale autodetection from navigator.lang  │
│     - Save handler triggers settings automation │
├─────────────────────────────────────────────────┤
│  4. CORE: URL INTERCEPTION & COOKIE FORCING     │
│     - Regional subdomain → www redirect         │
│     - ?locale= parameter rewriting              │
│     - Cookie enforcement                        │
│     - MutationObserver for SPA navigation       │
├─────────────────────────────────────────────────┤
│  5. FALLBACK: MISMATCH DETECTION BANNER         │
│     - After page load, check <html lang="">     │
│     - If mismatch with target, show banner      │
│     - Dismissable per-locale via GM storage     │
└─────────────────────────────────────────────────┘
```

### Section Details

#### 1. Data & Configuration (lines 16-71)

**Locale map** (`linkedinLocales`): A dictionary of 34 LinkedIn-supported locales, mapping locale code → English name. Used for the dropdown UI and validation.


**BCP 47 mapping** (`bcp47ToLinkedin`): Maps modern browser language codes to LinkedIn's legacy Java locale codes. LinkedIn uses pre-1989 ISO 639 codes for Hebrew (`iw` instead of `he`) and Indonesian (`in` instead of `id`). Modern browsers return the current standard codes. This mapping bridges the gap for autodetection.

**Cookie helper** (`setLanguageCookie`): Writes the `lang` cookie in LinkedIn's expected format:
```
lang="v=2&lang=en-us"
```
The double quotes are intentional — LinkedIn uses RFC 6265 DQUOTE wrapping for cookie values containing special characters (`&`, `=`). The guard condition (`!document.cookie.includes(...)`) prevents redundant writes.

**Locale format conversion**: LinkedIn uses two formats:
- URL/settings: `en_US` (underscore, mixed case)
- Cookie: `en-us` (hyphen, lowercase)

Conversion: `locale.replace('_', '-').toLowerCase()`

#### 2. Settings Page Automation (lines 73-145)

This implements the **full language override** by automating LinkedIn's native settings page. It uses a two-phase state machine stored in `GM_setValue('pendingLocaleChange', phase)`.

**Why two phases?** When the script changes the `<select>` dropdown and dispatches a `change` event, LinkedIn's Ember.js framework auto-saves the setting and **reloads the entire page**. This kills any pending `setTimeout` callbacks. The state machine survives the reload by persisting the current phase in GM storage.

**Phase flow:**

```
User clicks "Save & Reload" in modal
  → GM_setValue('pendingLocaleChange', 'apply')
  → GM_setValue('returnUrl', currentPage)
  → Navigate to /mypreferences/d/settings/language

[Page loads — script runs again]
  → pendingPhase === 'apply', isSettingsPage === true
  → Poll for <select> dropdown (up to 10 seconds)
  → Set dropdown.value, dispatch input + change events
  → GM_setValue('pendingLocaleChange', 'redirect')
  → Ember auto-saves → page reloads

[Page loads AGAIN — script runs a third time]
  → pendingPhase === 'redirect', isSettingsPage === true
  → GM_setValue('pendingLocaleChange', false)
  → window.location.replace(returnUrl) → back to original page
```

**Fallback:** If the dropdown is not found after 50 attempts (10 seconds), the script gives up, clears the pending flag, and redirects back.

**Backup timeout:** If Ember does NOT reload the page (unlikely but possible), a 3-second timeout triggers the manual redirect.

**DOM selectors used:**
```javascript
document.querySelector('select[data-test-setting-dropdown]')
document.querySelector('.dropdown-container_interfaceLocale select')
```
The first uses LinkedIn's test attribute (relatively stable). The second is a structural fallback.

#### 3. UI: Language Selector Modal (lines 147-257)

A modal overlay injected into the page when the user clicks "⚙️ Configure Language UI" in the Tampermonkey menu.

**Autodetection logic:**
1. Read `navigator.language` (BCP 47 format, e.g., `"uk-UA"`, `"fr"`, `"he-IL"`)
2. Convert hyphen to underscore: `"uk-UA"` → `"uk_UA"`
3. Split into language + region parts
4. Apply BCP 47 → LinkedIn legacy mapping (for Hebrew/Indonesian)
5. Try exact match: `linkedinLocales["uk_UA"]` → found? use it
6. If no region or no exact match, fuzzy match: first key starting with `"uk_"` → `"uk_UA"`

**Dropdown ordering** (using `Set` for deduplication):
1. `en_US` — always first ("Default")
2. Autodetected locale — if found ("Autodetected")
3. All remaining locales in object-key order

**Save handler:**
- Stores locale preferences in GM storage
- Sets the `lang` cookie immediately
- Triggers the settings page automation flow

#### 4. Core: URL Interception & Cookie Forcing (lines 259-292)

**Subdomain redirect:** Regex `/^[a-z]{2}\.linkedin\.com$/` detects regional subdomains and redirects to `www.linkedin.com`.

> **Known limitation:** Also matches functional subdomains like `lm.linkedin.com`. Practical risk is negligible — these redirect server-side before the script runs.

**Locale parameter:** If `?locale=` is present and doesn't match the user's preference, it's rewritten.

**SPA observer:** A `MutationObserver` on `{subtree: true, childList: true}` watches for DOM changes and re-applies the cookie if the URL changed. This handles LinkedIn's SPA navigation (client-side route changes that don't trigger full page loads).

> **Design note:** A more precise approach would be monkey-patching `history.pushState`/`replaceState` + `popstate` listener. The MutationObserver is less precise (fires on all DOM changes) but simpler and functional. The callback is a cheap string comparison.

#### 5. Fallback: Mismatch Detection Banner (lines 294-347)

After the page fully loads (2-second delay after `window.onload`), the script checks if `<html lang="...">` matches the target locale prefix. If there's a mismatch (e.g., `html lang="en"` but target is `uk_UA`):

- Shows a fixed-position red banner at the bottom of the page
- Links to the language settings page for manual correction
- Dismissable — stores `mismatchDismissedFor: locale` in GM storage
- Resets if the user changes to a different target locale

---

## Development History

### v1.0 → v2.3 (Initial commit, pre-audit)

Original implementation by the author. Features:
- Cookie forcing with `lang` cookie
- URL `?locale=` rewriting
- Regional subdomain redirect
- Modal UI for language selection
- Browser language autodetection
- SPA navigation monitoring via MutationObserver

23 locales supported. Used `document.body.removeChild()` for modal cleanup.

### v2.3 → v2.4 (Audit & fixes)

An in-depth technical audit was performed, resulting in:

**Validated (not bugs):**
- **B-01 (Cookie format):** The quoted cookie format `lang="v=2&lang=en-us"` was suspected to be incorrect. Live debugging on LinkedIn proved it matches LinkedIn's own server-set format (RFC 6265 DQUOTE wrapping). Confirmed correct — no change needed.

**Fixed:**
- **R-03 (DOM cleanup):** Replaced `document.body.removeChild(overlay)` with `overlay.remove()`. The old pattern could throw if the overlay was reparented.
- **Locale expansion:** Added 11 missing locales (Bangla, Greek, Persian, Hindi, Hungarian, Hebrew, Marathi, Punjabi, Telugu, Tagalog, Vietnamese).

**Identified for future work:**
- **B-03 (Subdomain regex):** The regex `/^[a-z]{2}\.linkedin\.com$/` can match non-regional subdomains. Deemed low practical risk — kept as-is with documentation.
- **B-04 (SPA detection):** MutationObserver is sub-optimal for URL change detection. History API monkey-patching would be more precise. Kept as-is for simplicity.

### v2.4 → v3.0 ("Nein Means Nein, LinkedIn")

**Root cause analysis:** Through live debugging (user captured console output on the notifications page with different locale configurations), we discovered that LinkedIn's notifications page is server-rendered and ignores the `lang` cookie entirely. It reads the `interfaceLocale` setting from the user's account database.

**Three approaches were evaluated:**

| Option | Approach | Chosen? |
|--------|----------|:---:|
| A: DOM Automation | Navigate to settings page, change the `<select>` dropdown programmatically | ✅ Yes |
| B: Voyager API | Extract CSRF token, call LinkedIn's internal API directly | ❌ Too fragile, ToS risk |
| C: Prompt User | Detect mismatch, show banner linking to settings | ✅ As fallback |

**Key implementation challenge:** The settings page uses Ember.js. When the dropdown value changes, Ember auto-saves and reloads the page. The initial implementation used a single `setTimeout` to redirect back after the save, but the page reload killed the timer. Fixed by implementing a two-phase state machine (`'apply'` → `'redirect'`) persisted in GM storage.

**Other additions:**
- Mismatch detection banner (Option C as fallback)
- `LIMITATIONS.md` documentation
- Updated `README.md` to reflect full override capability

### v3.0 → v3.1 ("LinkedIn Still Partying Like It's 1989")

**Bug discovered:** Locale autodetection was broken for Hebrew and Indonesian users. LinkedIn uses legacy Java locale codes (`iw_IL` for Hebrew, `in_ID` for Indonesian) based on the pre-1989 ISO 639 standard. All modern browsers return the current standard codes (`he`, `id`) via `navigator.language`. The autodetection tried to find `he_IL` in the locale map, failed, and silently showed no "Autodetected" label.

**Fix:** Added a `bcp47ToLinkedin` mapping table: `{ 'he': 'iw', 'id': 'in' }`. Applied before locale lookup. Works bidirectionally — if a legacy browser returns `iw`, the mapping lookup returns `undefined` and falls through to the original code which matches directly.

---

## Design Decisions & Rationale

### Why a single IIFE, no build step?

Tampermonkey userscripts are single-file by convention. Users install them by clicking a raw GitHub link. A build step (webpack, rollup) would:
- Add development complexity
- Make the installed script unreadable (bundled/minified)
- Prevent direct GitHub-hosted installation via `@updateURL`

The trade-off: no module system, no exports, harder to unit test. The script is ~350 lines — acceptable for a single file.

### Why DOM automation over direct API call?

The settings page automation (Option A) was chosen over direct Voyager API calls (Option B) because:

1. **No reverse-engineering required.** We don't need to know the API endpoint, request format, or headers. Ember handles the API call internally.
2. **No CSRF token extraction.** Direct API calls require extracting the CSRF token from `JSESSIONID`. While technically feasible, it's a pattern flagged by security audits.
3. **ToS compliance.** Automating a form is less invasive than calling undocumented internal APIs.
4. **Self-healing.** If LinkedIn changes their API format, our DOM automation might still work as long as the `<select>` element exists.

The trade-off: a brief visible flash of the settings page during language change (~2-3 seconds), and dependency on specific DOM selectors.

### Why RFC 6265 quoted cookies?

LinkedIn wraps cookie values containing special characters in double quotes:
```
lang="v=2&lang=en-us"
bcookie="v=2&abcdef-1234"
JSESSIONID="ajax:1234567890"
```

This was empirically verified by examining all LinkedIn cookies via `document.cookie` on the live site. The script matches this format exactly. Using unquoted values could cause LinkedIn's server to misparse the cookie.


### Why `navigator.language` (singular) not `navigator.languages` (plural)?

The script only needs the user's primary language for its autodetection *suggestion*. It doesn't auto-apply the detected language — it highlights it as "Autodetected" in the dropdown. Using `navigator.languages` would add complexity (iterating a list, finding the best match) for minimal benefit in this use case.

---

## LinkedIn Platform Internals

Knowledge gathered from live debugging and DOM inspection:

### Cookie format
```
lang="v=2&lang=en-us"
```
- Quoted per RFC 6265 DQUOTE
- `v=2` is a version prefix (meaning unknown, always 2)
- `lang=en-us` is the locale in hyphen-lowercase format

### Settings page DOM
- URL: `/mypreferences/d/settings/language`
- Framework: Ember.js
- Dropdown: `<select>` element with `data-test-setting-dropdown` attribute
- Container: `div.dropdown-container_interfaceLocale`
- Option values: LinkedIn locale codes (`en_US`, `uk_UA`, `iw_IL`, etc.)
- Behavior: Auto-saves on `change` event, then reloads the page

### LinkedIn locale codes (legacy Java)
LinkedIn uses Java's pre-1989 ISO 639 codes:
- Hebrew: `iw_IL` (modern: `he_IL`)
- Indonesian: `in_ID` (modern: `id_ID`)

All other locale codes match the modern standard.

### Server-side vs. client-side rendering
- **Client-rendered (SPA):** Feed, profiles, messaging — respect `lang` cookie and `?locale=` URL parameter
- **Server-rendered (SSR):** Notifications, settings, emails — use the `interfaceLocale` account database setting exclusively

---

## Testing Approaches

The script currently has **zero automated tests**. This section documents the feasible approaches for adding them.

### Challenge: Testability of a Tampermonkey Userscript

The script's architecture presents testing challenges:

1. **Single IIFE** — no exported functions, no module boundary
2. **Global side effects** — writes cookies, changes `window.location`, manipulates DOM
3. **Tampermonkey APIs** — `GM_getValue`, `GM_setValue`, `GM_registerMenuCommand` don't exist outside the extension
4. **Target site dependency** — the settings automation only works on LinkedIn's live DOM

### Approach 1: Extract & Unit Test Pure Logic

**Concept:** Refactor the IIFE internals to separate pure logic from side effects. Extract testable functions while keeping the script as a single file.

**What becomes testable:**

| Function | Input | Output | Side effects |
|----------|-------|--------|:---:|
| `formatCookieValue(lang)` | `"en-us"` | `'lang="v=2&lang=en-us"...'` | None |
| `detectLocale(navigatorLang)` | `"he-IL"` | `"iw_IL"` | None |
| `buildDropdownOrder(detected, current)` | `"uk_UA"`, `"en_US"` | `["en_US", "uk_UA", ...]` | None |
| `shouldRedirectSubdomain(hostname)` | `"de.linkedin.com"` | `true` | None |
| `rewriteLocaleParam(url, target)` | URL, `"uk_UA"` | Modified URL | None |
| `getStateMachineAction(phase, isSettings)` | `"apply"`, `true` | `"find-dropdown"` | None |

**Test framework:** Jest with jsdom environment.

**Mocking:**
```javascript
// Mock Tampermonkey APIs
global.GM_getValue = jest.fn((key, defaultVal) => store[key] ?? defaultVal);
global.GM_setValue = jest.fn((key, val) => { store[key] = val; });
global.GM_registerMenuCommand = jest.fn();
```

**Pros:**
- Tests are fast, deterministic, no network dependency
- High coverage on the logic that matters
- No build step needed — Jest can load the script directly

**Cons:**
- Requires refactoring the IIFE to expose functions (even if only for test loading)
- Cannot test the actual Tampermonkey runtime behavior
- Cannot test the settings page automation against real LinkedIn DOM

### Approach 2: Integration Tests with Puppeteer/Playwright

**Concept:** Launch a real browser with Tampermonkey installed, load the script, navigate to LinkedIn (or a mock server), and verify behavior.

**What becomes testable:**
- Cookie is set correctly on page load
- Regional subdomain redirect works
- `?locale=` parameter is rewritten
- Modal UI appears and functions
- Settings page automation (requires LinkedIn auth)

**Pros:**
- Tests real browser behavior end-to-end
- No refactoring needed — tests the script as-is

**Cons:**
- Slow (browser launch, page load)
- Requires LinkedIn authentication for settings page tests
- Fragile — LinkedIn DOM changes break tests
- Complex CI setup (browser + extension + auth tokens)

### Approach 3: Hybrid (Recommended)

**Concept:** Combine Approaches 1 and 2.

1. **Unit tests (Approach 1)** for all pure logic — locale detection, cookie format, URL rewriting, dropdown ordering, state machine transitions
2. **Smoke test (Approach 2, simplified)** — a Playwright test that loads a minimal mock HTML page (simulating LinkedIn's DOM), injects the script, and verifies cookie setting and subdomain redirect without needing real LinkedIn auth

**Mock server:**
A tiny static HTML server that serves pages mimicking LinkedIn's structure:
- `/` with `<html lang="en">`
- `/mypreferences/d/settings/language` with a `<select data-test-setting-dropdown>` element
- Regional subdomain behavior via localhost aliases

This gives high-confidence unit tests on logic + basic integration verification, without LinkedIn dependency.

### What NOT to test

- LinkedIn's Ember.js behavior (auto-save, page reload) — this is LinkedIn's code, not ours
- Visual appearance of the modal — not worth the maintenance cost
- MutationObserver firing patterns — too coupled to browser internals
