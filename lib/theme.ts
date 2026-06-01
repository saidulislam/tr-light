import { cookies } from "next/headers";

export const THEME_COOKIE = "tr-theme";
export type Theme = "light" | "dark" | "system";

export async function getThemePreference(): Promise<Theme> {
  const store = await cookies();
  const v = store.get(THEME_COOKIE)?.value;
  if (v === "light" || v === "dark" || v === "system") return v;
  return "system";
}

/** Inline script that runs on first paint to apply the saved theme BEFORE
 *  React hydrates — prevents the FOUC flash from light → dark. */
export const themeInitScript = `(function(){try{var c=document.cookie.split('; ').find(function(r){return r.indexOf('${THEME_COOKIE}=')===0});var v=c?c.split('=')[1]:'system';var dark=v==='dark'||(v==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(dark)document.documentElement.classList.add('dark');}catch(e){}})();`;
