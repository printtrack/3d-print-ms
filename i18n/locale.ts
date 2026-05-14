export type Locale = "de" | "en";
export const LOCALES: Locale[] = ["de", "en"];
export const DEFAULT_LOCALE: Locale = "de";
export const LOCALE_COOKIE = "locale";

export function isValidLocale(value: string): value is Locale {
  return LOCALES.includes(value as Locale);
}
