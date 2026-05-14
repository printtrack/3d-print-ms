"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getCustomerSessionFromCookies } from "@/lib/customer-auth";
import { isValidLocale, LOCALE_COOKIE, type Locale } from "./locale";

const ONE_YEAR = 365 * 24 * 60 * 60;

export async function setLocale(locale: string): Promise<void> {
  if (!isValidLocale(locale)) return;

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    maxAge: ONE_YEAR,
    sameSite: "lax",
    path: "/",
  });

  const validLocale: Locale = locale;

  // Persist to DB for logged-in users
  const session = await auth();
  if (session?.user?.id) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { locale: validLocale },
    });
    return;
  }

  const customer = await getCustomerSessionFromCookies();
  if (customer?.id) {
    await prisma.customer.update({
      where: { id: customer.id },
      data: { locale: validLocale },
    });
  }
}
