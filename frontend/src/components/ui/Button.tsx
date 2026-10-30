import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "quiet";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = { primary: "btn-ink", secondary: "btn-card", quiet: "btn-quiet" };
const SIZE: Record<ButtonSize, string> = { sm: "btn-sm", md: "", lg: "btn-lg" };

/** The website's own buttons (.btn-ink / .btn-card), in three sizes, with a loading state. */
export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra = "") {
  return ["btn", VARIANT[variant], SIZE[size], extra].filter(Boolean).join(" ");
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows the loading label and blocks a second click. */
  loading?: boolean;
  loadingLabel?: string;
  icon?: ReactNode;
};

export function Button({ variant = "primary", size = "md", loading = false, loadingLabel, icon, className = "", disabled, children, type = "button", ...rest }: Props) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {icon}
      {loading ? (loadingLabel ?? "Working…") : children}
    </button>
  );
}
