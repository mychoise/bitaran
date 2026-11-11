import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import maizeSacks from "../../../public/photos/maize-sacks.jpg";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";
import { CheckIcon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/Logo";
import { config } from "@/config";

/** Small top bar for the login and app screens: the product name and a way back to the website. */
export async function AuthTopBar({ children }: { children?: ReactNode }) {
  const t = await getTranslations("Auth.topBar");
  return (
    <header className="border-b-2 border-ink bg-paper-2">
      <div className="container flex h-18 items-center justify-between gap-6">
        <Link href="/" aria-label={t("homeAria", { product: config.productName })} className="wordmark no-underline">
          <Logo />
        </Link>
        <div className="flex items-center gap-4">
          {children}
          <LocaleSwitcher />
          <Link href="/" className="text-link">
            {t("backToWebsite")}
          </Link>
        </div>
      </div>
    </header>
  );
}

/**
 * Login layout: the form on the left; on large screens a plain panel on the right with the
 * product name, three real benefits and one photograph. Small screens get only the form.
 */
export async function AuthShell({ children }: { children: ReactNode }) {
  const t = await getTranslations("Auth.shell");
  const benefits = [t("benefit1"), t("benefit2"), t("benefit3")];
  return (
    <div className="flex min-h-svh flex-col">
      <AuthTopBar />
      <main id="main" className="desk flex flex-1 items-center py-16">
        <div className="container grid grid-cols-1 items-center gap-x-columns gap-y-12 lg:grid-cols-12">
          <div className="hero-text min-w-0 lg:col-span-5">{children}</div>
          <aside aria-label={t("aboutAria", { product: config.productName })} className="on-board max-lg:hidden lg:col-span-6 lg:col-start-7">
            <div className="hero-desk">
              <div className="desk-settle overflow-hidden rounded-card bg-board text-board-type">
                <figure data-slot="login-photo" data-alt="Your own store or the morning load" className="relative m-0 aspect-16/9">
                  <Image src={maizeSacks} alt="Sacks of grain stacked high in a store" fill sizes="45vw" placeholder="blur" className="object-cover" />
                </figure>
                <div className="p-10">
                  <p className="font-display text-section leading-none font-semibold tracking-display">{config.productName}</p>
                  <ul className="m-0 mt-8 flex list-none flex-col gap-4 p-0 text-lg">
                    {benefits.map((b) => (
                      <li key={b} className="flex items-start gap-3">
                        <CheckIcon className="mt-1 size-5 shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-10 text-sm">
                    Photo by{" "}
                    <a href="https://commons.wikimedia.org/wiki/File:Stacked_up_maize_sacks.jpg" className="underline">
                      Cut angles
                    </a>
                    , CC BY-SA 4.0, Wikimedia Commons
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
