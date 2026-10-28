import Link from "next/link";
import { config, whatsappHref } from "@/config";
import { ChatIcon } from "@/components/ui/icons";

/**
 * Floating WhatsApp button. With no number configured yet it goes to the contact page,
 * where the WhatsApp details will live, rather than to a broken wa.me link.
 */
export function WhatsAppButton() {
  const href = whatsappHref(`Hello, I would like to know more about ${config.productName}.`);
  const content = (
    <>
      <ChatIcon className="size-5" />
      <span>WhatsApp us</span>
    </>
  );
  return (
    <div className="fixed right-6 bottom-6 z-20">
      {href ? (
        <a href={href} className="btn btn-ink" rel="noopener" target="_blank">
          {content}
          <span className="sr-only"> (opens WhatsApp)</span>
        </a>
      ) : (
        <Link href="/contact#whatsapp" className="btn btn-ink">
          {content}
        </Link>
      )}
    </div>
  );
}
