import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

// Login screens are for people with an account: keep them out of search results.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Reads the locale cookie on every request, so there is no static shell to speed up: it always
// blocks on the server. See https://nextjs.org/docs/messages/blocking-prerender-runtime.
export const instant = false;

export default async function LoginLayout({ children }: LayoutProps<"/login">) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
