// Theme constants shared by the server layout and the client preferences store.

export type Theme = "dark" | "light";
export type Accent = "amber" | "cyan" | "lime" | "violet" | "rose";

export const ACCENTS: Record<Accent, string> = {
  amber: "#f5a524",
  cyan: "#22d3ee",
  lime: "#a3e635",
  violet: "#a78bfa",
  rose: "#fb7185",
};

export const PREFS_KEY = "gridsense-ui";

/**
 * Runs inline in <head> before first paint, so a light-theme reload does not
 * flash dark. Reads the same storage key as lib/uiPrefs.ts.
 */
export const themeBootScript = `(function(){try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(PREFS_KEY)})||"{}");var a=${JSON.stringify(ACCENTS)};document.documentElement.dataset.theme=p.theme==="light"?"light":"dark";if(a[p.accent])document.documentElement.style.setProperty("--accent",a[p.accent]);}catch(e){document.documentElement.dataset.theme="dark";}})();`;
