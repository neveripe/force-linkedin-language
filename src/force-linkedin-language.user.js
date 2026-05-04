// ==UserScript==
// @name         Force LinkedIn Language (with UI)
// @namespace    https://github.com/neveripe/force-linkedin-language
// @version      2.3
// @description  Prevents LinkedIn from switching languages, features UI and robust locale autodetection.
// @author       neveripe
// @match        *://*.linkedin.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/yourusername/force-linkedin-language/main/force-linkedin-language.user.js
// @downloadURL  https://raw.githubusercontent.com/yourusername/force-linkedin-language/main/force-linkedin-language.user.js
// ==/UserScript==

(function() {
    'use strict';

    const linkedinLocales = {
        'ar_AE': 'Arabic',
        'cs_CZ': 'Czech',
        'da_DK': 'Danish',
        'de_DE': 'German',
        'en_US': 'English',
        'es_ES': 'Spanish',
        'fi_FI': 'Finnish',
        'fr_FR': 'French',
        'in_ID': 'Indonesian',
        'it_IT': 'Italian',
        'ja_JP': 'Japanese',
        'ko_KR': 'Korean',
        'ms_MY': 'Malay',
        'nl_NL': 'Dutch',
        'no_NO': 'Norwegian',
        'pl_PL': 'Polish',
        'pt_BR': 'Portuguese',
        'ro_RO': 'Romanian',
        'sv_SE': 'Swedish',
        'th_TH': 'Thai',
        'tr_TR': 'Turkish',
        'uk_UA': 'Ukrainian',
        'zh_CN': 'Chinese (Simplified)',
        'zh_TW': 'Chinese (Traditional)'
    };

    const defaultLocale = 'en_US';
    let userLocale = GM_getValue('targetLocale', defaultLocale);
    let userCookieLang = GM_getValue('targetCookieLang', userLocale.replace('_', '-').toLowerCase());

    const setLanguageCookie = (cookieLangStr) => {
        const expectedCookieString = `v=2&lang=${cookieLangStr}`;
        if (!document.cookie.includes(`lang="${expectedCookieString}"`)) {
            document.cookie = `lang="${expectedCookieString}"; domain=.linkedin.com; path=/; max-age=31536000; secure`;
        }
    };

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
            <p style="margin:0; font-size:14px; color:rgba(0,0,0,0.6);">Choose your preferred locale.</p>
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
        cancelBtn.onclick = () => document.body.removeChild(overlay);

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

            setTimeout(() => {
                const url = new URL(window.location.href);
                url.searchParams.set('locale', newLocale);
                window.location.replace(url.toString());
            }, 150); 
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

})();
