import { safeLocalStorage } from './localStorage';

// Default values for Satun Epidemic Portal
export const DEFAULT_SHEET_ID = '1x4sKAQUPVJUXC5-OYqXHPZiVS8qr_sQskQut6r2OOWE';
export const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwTzIT8AP8UJfwQ_WnSUc3S8J_ZVsRVRclwaGn8wQQW8D-WAN63nRdMVhJJgGLRUDLIEQ/exec';

/**
 * Reads synchronization settings from the browser URL search parameters on load.
 * Saves custom values into storage when parsed.
 */
export const extractConfigFromUrl = (): { sheetId: string; scriptUrl: string } => {
  let sheetId = DEFAULT_SHEET_ID;
  let scriptUrl = DEFAULT_SCRIPT_URL;

  if (typeof window === 'undefined') {
    return { sheetId, scriptUrl };
  }

  try {
    const params = new URLSearchParams(window.location.search);
    
    const paramSheetId = params.get('sheetId') || params.get('google_heatmap_sheet_id') || params.get('spreadsheetId');
    if (paramSheetId) {
      sheetId = paramSheetId.trim();
      safeLocalStorage.setItem('google_heatmap_sheet_id', sheetId);
    } else {
      sheetId = safeLocalStorage.getItem('google_heatmap_sheet_id') || DEFAULT_SHEET_ID;
    }

    const paramScriptUrl = params.get('scriptUrl') || params.get('google_apps_script_url');
    if (paramScriptUrl) {
      scriptUrl = decodeURIComponent(paramScriptUrl).trim();
      safeLocalStorage.setItem('google_apps_script_url', scriptUrl);
    } else {
      scriptUrl = safeLocalStorage.getItem('google_apps_script_url') || DEFAULT_SCRIPT_URL;
    }
  } catch (e) {
    console.warn('[URL Sync] Error extracting configs from URL parameters:', e);
  }

  return { sheetId, scriptUrl };
};

/**
 * Dynamically keeps the address bar's query parameters updated with custom sheet ID and Apps Script Web App URL.
 * Allows instant, lossless copying from administrative consoles to share with field staff / incognito modes.
 */
export const syncConfigToUrl = (sheetId: string | null, scriptUrl: string | null) => {
  if (typeof window === 'undefined') return;

  try {
    const params = new URLSearchParams(window.location.search);
    let changed = false;

    // Setup sheetId in URL if it is custom
    const activeSheetId = sheetId || safeLocalStorage.getItem('google_heatmap_sheet_id') || DEFAULT_SHEET_ID;
    if (activeSheetId && activeSheetId !== DEFAULT_SHEET_ID) {
      if (params.get('sheetId') !== activeSheetId) {
        params.set('sheetId', activeSheetId);
        changed = true;
      }
    } else {
      if (params.has('sheetId')) {
        params.delete('sheetId');
        changed = true;
      }
    }

    // Setup scriptUrl in URL if it is custom
    const activeScriptUrl = scriptUrl || safeLocalStorage.getItem('google_apps_script_url') || DEFAULT_SCRIPT_URL;
    if (activeScriptUrl && activeScriptUrl !== DEFAULT_SCRIPT_URL) {
      const encodedUrl = encodeURIComponent(activeScriptUrl);
      if (params.get('scriptUrl') !== activeScriptUrl) {
        params.set('scriptUrl', activeScriptUrl);
        changed = true;
      }
    } else {
      if (params.has('scriptUrl')) {
        params.delete('scriptUrl');
        changed = true;
      }
    }

    if (changed) {
      const newSearch = params.toString();
      const newPath = window.location.pathname + (newSearch ? '?' + newSearch : '') + window.location.hash;
      window.history.replaceState({ ...window.history.state }, '', newPath);
    }
  } catch (e) {
    console.warn('[URL Sync] Error syncing configurations to URL address bar:', e);
  }
};
