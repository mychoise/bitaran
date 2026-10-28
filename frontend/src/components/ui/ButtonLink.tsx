import Link from "next/link";
import type { ReactNode } from "react";
import { isExternal } from "@/config";

type Variant = "ink" | "card";

const variants: Record<Variant, string> = {
  ink: "btn btn-ink",
  card: "btn btn-card",
};

type Props = {
  href: string;
  children: ReactNode;
  variant?: Variant;
  className?: string;
};

/** A letterpress button that navigates. Internal paths use next/link. */
export function ButtonLink({ href, children, variant = "ink", className = "" }: Props) {
  const cls = `${variants[variant]} ${className}`.trim();
  if (isExternal(href)) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}
