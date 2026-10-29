import type { Metadata } from "next";

// Login screens are for people with an account: keep them out of search results.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: LayoutProps<"/login">) {
  return children;
}
