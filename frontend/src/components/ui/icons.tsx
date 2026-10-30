// One small hand-drawn icon set: 24px grid, 1.75 stroke, currentColor.
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const CheckIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Base>
);

export const MenuIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Base>
);

export const CloseIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Base>
);

export const ChatIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4.5 19.5l1.2-3.6A8 8 0 1 1 8.6 18.6z" />
    <path d="M9 10.5c.4 1.7 1.8 3.1 3.5 3.5l1-1 2 .8-.4 1.6c-3.4.3-6.8-3.1-6.5-6.5l1.6-.4.8 2z" />
  </Base>
);

export const CameraIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
    <circle cx="12" cy="13" r="3.25" />
  </Base>
);

export const PinIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.25" />
  </Base>
);

export const PlusIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Base>
);

export const ArrowDownIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Base>
);

export const MailIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" />
    <path d="M4 7l8 6 8-6" />
  </Base>
);

export const PhoneIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2-2z" />
  </Base>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 9l6 6 6-6" />
  </Base>
);

export const ChevronUpIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 15l6-6 6 6" />
  </Base>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M15 6l-6 6 6 6" />
  </Base>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M9 6l6 6-6 6" />
  </Base>
);

export const SortIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M8 10l4-4 4 4M8 14l4 4 4-4" />
  </Base>
);

export const AlertIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 4l9 16H3z" />
    <path d="M12 10v4M12 17v.01" />
  </Base>
);

export const XCircleIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9 9l6 6M15 9l-6 6" />
  </Base>
);

export const InfoIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8v.01" />
  </Base>
);

export const ClockIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Base>
);

export const HomeIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 11l8-6.5 8 6.5M6 9.5V20h12V9.5" />
  </Base>
);

export const StoreIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 9l1.5-4.5h13L20 9M4 9h16M4 9v1.5a2.5 2.5 0 0 0 5 0V9m0 1.5a2.5 2.5 0 0 0 5 0V9m0 1.5a2.5 2.5 0 0 0 5 0V9M5.5 13v7h13v-7" />
  </Base>
);

export const CartIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.5 4.5h2l2 11h10l2-8H7" />
    <circle cx="9" cy="19" r="1.25" />
    <circle cx="16.5" cy="19" r="1.25" />
  </Base>
);

export const BoxIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 7.5l8-4 8 4v9l-8 4-8-4z" />
    <path d="M4 7.5l8 4 8-4M12 11.5v9" />
  </Base>
);

export const MoreIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth="3" />
  </Base>
);

export const UsersIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="9" cy="8.5" r="3" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0M15.5 5.6a3 3 0 0 1 0 5.8M17.5 14a5.5 5.5 0 0 1 3 5" />
  </Base>
);

export const WalletIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 7.5h14.5a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V6a1.5 1.5 0 0 1 1.5-1.5H17" />
    <path d="M16 13.5h.01" strokeWidth="2.5" />
  </Base>
);

export const ChartIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 4v16h16M8 16v-4M12 16V8M16 16v-6" />
  </Base>
);

export const RouteIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="6" cy="18" r="2" />
    <circle cx="18" cy="6" r="2" />
    <path d="M8 18h7.5a3 3 0 0 0 0-6h-7a3 3 0 0 1 0-6H16" />
  </Base>
);

export const ReturnIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M9 7L4.5 11.5 9 16M5 11.5h10a4.5 4.5 0 0 1 0 9h-2" />
  </Base>
);

export const ReceiptIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 3.5h12v17l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5z" />
    <path d="M9 8h6M9 11.5h6M9 15h3" />
  </Base>
);

export const SettingsIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3.5v2.5M12 18v2.5M3.5 12H6M18 12h2.5M6 6l1.8 1.8M16.2 16.2L18 18M6 18l1.8-1.8M16.2 7.8L18 6" />
  </Base>
);

export const SearchIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="6" />
    <path d="M20 20l-4.5-4.5" />
  </Base>
);

export const MinusIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 12h14" />
  </Base>
);

export const DownloadIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />
  </Base>
);

export const UserIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </Base>
);
