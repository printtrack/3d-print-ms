import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isValidLocale, type Locale } from "./locale";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("locale")?.value ?? DEFAULT_LOCALE;
  return isValidLocale(raw) ? raw : DEFAULT_LOCALE;
}
