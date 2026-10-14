// Theme constants shared by the server layout and the client preferences store.

export type Theme = "dark" | "light";

export const PREFS_KEY = "gridsense-ui";

/**
 * Runs inline in <head> before first paint, so a light-theme reload does not
 * flash dark. Reads the same storage key as lib/uiPrefs.ts.
 */
export const themeBootScript = `(function(){try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(PREFS_KEY)})||"{}");document.documentElement.dataset.theme=p.theme==="light"?"light":"dark";}catch(e){document.documentElement.dataset.theme="dark";}})();`;
