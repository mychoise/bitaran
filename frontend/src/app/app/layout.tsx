import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

// The signed-in area: never indexed, never in the sitemap.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Every page here depends on the session cookie, so there is no static shell to speed up: it
// always blocks on the server. See https://nextjs.org/docs/messages/blocking-prerender-runtime.
export const instant = false;

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
