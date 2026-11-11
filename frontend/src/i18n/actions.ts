"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { isLocale, localeCookieName } from "./locale";

/** Sets the UI language. Anyone can call this: it only ever picks between "en" and "ne". */
export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  const store = await cookies();
  store.set(localeCookieName, locale, { maxAge: 60 * 60 * 24 * 365, path: "/" });
  revalidatePath("/");
}
