import { PageHeader } from "@/components/ui/Display";
import { EmptyState } from "@/components/ui/States";

/** A section in the nav whose screens are built in a later step. Honest about it. */
export function ComingNext({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState title="Built in a later step" line={`The ${title.toLowerCase()} screens come in a later build step. The navigation is here so you can see the whole app.`} />
    </>
  );
}
