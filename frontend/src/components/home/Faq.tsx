import Link from "next/link";
import { Accordion, type AccordionItem } from "@/components/ui/Accordion";

const questions: AccordionItem[] = [
  {
    q: "Do my salesmen need to install an app?",
    a: "No. They open it in the browser on their phone and log in with their own account.",
  },
  {
    q: "Can a salesman see other salesmen's sales?",
    a: "No. The owner, managers and salesmen each have their own login and see only what their role allows.",
  },
  {
    q: "How are cheques handled?",
    a: "The salesman photographs the cheque when he collects it. It stays pending until a manager checks the photo and confirms it.",
  },
  {
    q: "Can my shops see what they owe?",
    a: "Yes. Each shop can log in to see its own balance and statement, and nothing else.",
  },
  {
    q: "How much does it cost?",
    a: (
      <>
        It depends mainly on how many salesmen and shops you have.{" "}
        <Link href="/pricing" className="text-link whitespace-nowrap">
          What affects the price
        </Link>
        .
      </>
    ),
  },
];

/** Questions as ruled rows, head on the left. The accordion is the only client part. */
export function Faq() {
  return (
    <section aria-labelledby="faq-title" className="py-section">
      <div className="container grid grid-cols-1 gap-12 lg:grid-cols-12">
        <h2 id="faq-title" className="lg:col-span-4">Questions owners ask</h2>
        <div className="lg:col-span-8">
          <Accordion items={questions} />
        </div>
      </div>
    </section>
  );
}
