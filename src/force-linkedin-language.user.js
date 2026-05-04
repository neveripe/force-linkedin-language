// ==UserScript==
// @name         Force LinkedIn Language (with UI)
// @namespace    https://github.com/neveripe/force-linkedin-language
// @version      3.0
// @description  Prevents LinkedIn from switching languages, features UI and robust locale autodetection.
// @author       neveripe
// @match        *://*.linkedin.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/neveripe/force-linkedin-language/master/src/force-linkedin-language.user.js
// @downloadURL  https://raw.githubusercontent.com/neveripe/force-linkedin-language/master/src/force-linkedin-language.user.js
// ==/UserScript==

(function() {
    'use strict';

    const linkedinLocales = {
        'ar_AE': 'Arabic',
        'bn_IN': 'Bangla',
        'cs_CZ': 'Czech',
        'da_DK': 'Danish',
        'de_DE': 'German',
        'el_GR': 'Greek',
        'en_US': 'English',
        'es_ES': 'Spanish',
        'fa_IR': 'Persian',
        'fi_FI': 'Finnish',
        'fr_FR': 'French',
        'hi_IN': 'Hindi',
        'hu_HU': 'Hungarian',
        'in_ID': 'Indonesian',
        'it_IT': 'Italian',
        'iw_IL': 'Hebrew',
        'ja_JP': 'Japanese',
        'ko_KR': 'Korean',
        'mr_IN': 'Marathi',
        'ms_MY': 'Malay',
        'nl_NL': 'Dutch',
        'no_NO': 'Norwegian',
        'pa_IN': 'Punjabi',
        'pl_PL': 'Polish',
        'pt_BR': 'Portuguese',
        'ro_RO': 'Romanian',
        'sv_SE': 'Swedish',
        'te_IN': 'Telugu',
        'th_TH': 'Thai',
        'tl_PH': 'Tagalog',
        'tr_TR': 'Turkish',
        'uk_UA': 'Ukrainian',
        'vi_VN': 'Vietnamese',
        'zh_CN': 'Chinese (Simplified)',
        'zh_TW': 'Chinese (Traditional)'
    };

    const SETTINGS_PATH = '/mypreferences/d/settings/language';
    const defaultLocale = 'en_US';
    let userLocale = GM_getValue('targetLocale', defaultLocale);
    let userCookieLang = GM_getValue('targetCookieLang', userLocale.replace('_', '-').toLowerCase());

    const setLanguageCookie = (cookieLangStr) => {
        const expectedCookieString = `v=2&lang=${cookieLangStr}`;
        if (!document.cookie.includes(`lang="${expectedCookieString}"`)) {
            document.cookie = `lang="${expectedCookieString}"; domain=.linkedin.com; path=/; max-age=31536000; secure`;
        }
    };

    // ---------------------------------------------------------
    // SETTINGS PAGE AUTOMATION (Option A)
    // Programmatically changes the account-level language setting
    // by automating the native settings page dropdown.
    // ---------------------------------------------------------

    const isSettingsPage = window.location.pathname === SETTINGS_PATH;
    const pendingPhase = GM_getValue('pendingLocaleChange', false);

    if (pendingPhase && isSettingsPage) {
        const targetLocale = GM_getValue('targetLocale', defaultLocale);
        const returnUrl = GM_getValue('returnUrl', 'https://www.linkedin.com/feed/');

        // Phase 'redirect': Ember reloaded the page after auto-save.
        // The dropdown change was already applied — just go back.
        if (pendingPhase === 'redirect') {
            GM_setValue('pendingLocaleChange', false);
            window.location.replace(returnUrl);
            return;
        }

        // Phase 'apply': Find the dropdown and change it.
        const applySettingWhenReady = (attempts) => {
            const maxAttempts = 50; // 50 × 200ms = 10 seconds max wait
            const dropdown = document.querySelector(
                'select[data-test-setting-dropdown]'
            ) || document.querySelector('.dropdown-container_interfaceLocale select');

            if (!dropdown) {
                if (attempts < maxAttempts) {
                    setTimeout(() => applySettingWhenReady(attempts + 1), 200);
                } else {
                    // Fallback: give up and redirect back
                    GM_setValue('pendingLocaleChange', false);
                    console.warn('[Force LinkedIn Language] Settings dropdown not found after timeout. Redirecting back.');
                    window.location.replace(returnUrl);
                }
                return;
            }

            // Already set correctly — just go back
            if (dropdown.value === targetLocale) {
                GM_setValue('pendingLocaleChange', false);
                window.location.replace(returnUrl);
                return;
            }

            // Advance to 'redirect' phase BEFORE dispatching the event.
            // If Ember reloads the page, the next run will see 'redirect' and go back.
            GM_setValue('pendingLocaleChange', 'redirect');

            // Set the value and trigger Ember's change detection
            dropdown.value = targetLocale;
            dropdown.dispatchEvent(new Event('input', { bubbles: true }));
            dropdown.dispatchEvent(new Event('change', { bubbles: true }));

            // Backup timeout: if Ember does NOT reload the page, redirect manually.
            setTimeout(() => {
                GM_setValue('pendingLocaleChange', false);
                window.location.replace(returnUrl);
            }, 3000);
        };

        // Start polling once the DOM is minimally available
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => applySettingWhenReady(0));
        } else {
            applySettingWhenReady(0);
        }

        // Don't run the rest of the script during settings automation
        return;
    }

    // ---------------------------------------------------------
    // UI: Language Selector Modal
    // ---------------------------------------------------------

    function showLocaleSelector() {
        if (document.getElementById('tm-locale-modal-overlay')) return;

        let detectedLang = null;
        if (navigator.language) {
            const parts = navigator.language.replace('-', '_').split('_');
            const lang = parts[0].toLowerCase();
            const region = parts[1] ? parts[1].toUpperCase() : null;

            if (region && linkedinLocales[`${lang}_${region}`]) {
                detectedLang = `${lang}_${region}`;
            } else {
                detectedLang = Object.keys(linkedinLocales).find(l => l.startsWith(`${lang}_`));
            }
        }

        const prioritizedLocales = new Set();
        prioritizedLocales.add('en_US');
        if (detectedLang) prioritizedLocales.add(detectedLang);
        Object.keys(linkedinLocales).forEach(loc => prioritizedLocales.add(loc));

        const overlay = document.createElement('div');
        overlay.id = 'tm-locale-modal-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.6)', zIndex: '2147483647', 
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            fontFamily: '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        });

        const modal = document.createElement('div');
        Object.assign(modal.style, {
            backgroundColor: '#fff', padding: '24px', borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)', width: '320px',
            display: 'flex', flexDirection: 'column', gap: '16px'
        });

        modal.innerHTML = `
            <h2 style="margin:0; font-size:18px; color:rgba(0,0,0,0.9);">Select LinkedIn Language</h2>
            <p style="margin:0; font-size:14px; color:rgba(0,0,0,0.6);">Choose your preferred locale. This will update both the cookie and your account setting.</p>
        `;

        const select = document.createElement('select');
        Object.assign(select.style, {
            padding: '10px', fontSize: '14px', borderRadius: '6px', 
            border: '1px solid #ccc', outline: 'none', cursor: 'pointer'
        });

        prioritizedLocales.forEach(loc => {
            const option = document.createElement('option');
            option.value = loc;
            
            const descriptiveName = linkedinLocales[loc] || loc;
            let label = `${descriptiveName} (${loc})`;
            
            if (loc === 'en_US') label += ' - Default';
            else if (loc === detectedLang) label += ' - Autodetected';
            
            option.textContent = label;
            if (loc === userLocale) option.selected = true;
            select.appendChild(option);
        });

        modal.appendChild(select);

        const btnContainer = document.createElement('div');
        Object.assign(btnContainer.style, { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        Object.assign(cancelBtn.style, {
            padding: '8px 16px', border: 'none', background: 'transparent', 
            color: 'rgba(0,0,0,0.6)', cursor: 'pointer', fontWeight: '600', fontSize: '14px'
        });
        cancelBtn.onclick = () => overlay.remove();

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save & Reload';
        Object.assign(saveBtn.style, {
            padding: '8px 16px', border: 'none', background: '#0a66c2', 
            color: '#fff', borderRadius: '16px', cursor: 'pointer', fontWeight: '600', fontSize: '14px'
        });
        
        saveBtn.onclick = () => {
            const newLocale = select.value;
            const newCookieLang = newLocale.replace('_', '-').toLowerCase();

            GM_setValue('targetLocale', newLocale);
            GM_setValue('targetCookieLang', newCookieLang);
            setLanguageCookie(newCookieLang);

            // Store state for the settings page automation
            GM_setValue('pendingLocaleChange', 'apply');
            GM_setValue('returnUrl', window.location.href.split('?')[0]);

            // Navigate to the settings page to change the server-side setting
            window.location.href = 'https://www.linkedin.com' + SETTINGS_PATH;
        };

        btnContainer.appendChild(cancelBtn);
        btnContainer.appendChild(saveBtn);
        modal.appendChild(btnContainer);
        overlay.appendChild(modal);
        (document.body || document.documentElement).appendChild(overlay);
    }

    GM_registerMenuCommand(`⚙️ Configure Language UI`, showLocaleSelector);

    // ---------------------------------------------------------
    // CORE LOGIC: URL Interception & Cookie Forcing
    // ---------------------------------------------------------
    
    const url = new URL(window.location.href);
    let requiresRedirect = false;

    const regionalSubdomainRegex = /^[a-z]{2}\.linkedin\.com$/;
    if (regionalSubdomainRegex.test(url.hostname)) {
        url.hostname = 'www.linkedin.com';
        requiresRedirect = true;
    }

    if (url.searchParams.has('locale') && url.searchParams.get('locale') !== userLocale) {
        url.searchParams.set('locale', userLocale);
        requiresRedirect = true;
    }

    if (requiresRedirect) {
        setLanguageCookie(userCookieLang);
        window.location.replace(url.toString());
        return; 
    }

    setLanguageCookie(userCookieLang);
    
    let lastUrl = location.href; 
    new MutationObserver(() => {
        const currentUrl = location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            setLanguageCookie(userCookieLang);
        }
    }).observe(document, {subtree: true, childList: true});

    // ---------------------------------------------------------
    // FALLBACK: Locale Mismatch Detection
    // If the server-rendered language doesn't match our target
    // after settings automation, show a one-time warning banner.
    // ---------------------------------------------------------

    const checkLocaleSync = () => {
        const htmlLang = document.documentElement.lang;
        const targetLangPrefix = userLocale.split('_')[0].toLowerCase();

        // Only warn if there's a mismatch AND we haven't dismissed this warning
        if (htmlLang && htmlLang !== targetLangPrefix) {
            const dismissedFor = GM_getValue('mismatchDismissedFor', '');
            if (dismissedFor === userLocale) return;

            const banner = document.createElement('div');
            Object.assign(banner.style, {
                position: 'fixed', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
                background: '#b24020', color: '#fff', padding: '12px 20px', borderRadius: '8px',
                zIndex: '2147483647', fontSize: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                fontFamily: '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                display: 'flex', alignItems: 'center', gap: '12px', maxWidth: '500px'
            });

            const targetName = linkedinLocales[userLocale] || userLocale;
            banner.innerHTML = `
                <span>⚠️ LinkedIn account language doesn't match your script setting (<b>${targetName}</b>).
                <a href="https://www.linkedin.com${SETTINGS_PATH}" style="color:#fff;text-decoration:underline">Change it in Settings</a>.</span>
            `;

            const dismissBtn = document.createElement('button');
            dismissBtn.textContent = '✕';
            Object.assign(dismissBtn.style, {
                background: 'transparent', border: 'none', color: '#fff',
                fontSize: '18px', cursor: 'pointer', padding: '0 0 0 8px', lineHeight: '1'
            });
            dismissBtn.onclick = () => {
                GM_setValue('mismatchDismissedFor', userLocale);
                banner.remove();
            };

            banner.appendChild(dismissBtn);
            document.body.appendChild(banner);
        }
    };

    // Check after the page has fully loaded and rendered
    if (document.readyState === 'complete') {
        setTimeout(checkLocaleSync, 2000);
    } else {
        window.addEventListener('load', () => setTimeout(checkLocaleSync, 2000));
    }

})();
