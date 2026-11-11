import Image from "next/image";
import { config } from "@/config";
import logo from "../../../public/logo.png";

/** The mark plus the name, sized to sit inline wherever `.wordmark` is used. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <>
      <Image src={logo} alt="" className={`inline h-[1em] w-auto align-[-0.1em] ${className}`} priority />
      <span className="ml-2">{config.productName}</span>
    </>
  );
}
