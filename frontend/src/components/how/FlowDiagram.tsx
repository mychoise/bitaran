import { ArrowDownIcon, ArrowRightIcon } from "@/components/ui/icons";

type Node = { label: string; value: string; note: string };

function Box({ n, result = false, pop }: { n: Node; result?: boolean; pop: number }) {
  return (
    <div data-pop={pop} className={`rounded-stock p-5 ${result ? "bg-board text-board-type" : "stock"}`}>
      <p className={`text-sm ${result ? "" : "text-muted"}`}>{n.label}</p>
      <p className="mt-1 font-outlier text-2xl">{n.value}</p>
      <p className={`mt-2 text-xs ${result ? "" : "text-muted"}`}>{n.note}</p>
    </div>
  );
}

function Arrow({ sign, pop }: { sign: string; pop: number }) {
  return (
    <div data-pop={pop} className="flex shrink-0 items-center justify-center gap-1 text-ink" aria-hidden="true">
      <span className="font-outlier text-xl">{sign}</span>
      <ArrowRightIcon className="size-6 max-lg:hidden" />
      <ArrowDownIcon className="size-6 lg:hidden" />
    </div>
  );
}

/**
 * One flow drawn as boxes joined by signs: each input adds to or takes from the result.
 * A diagram of the real calculation, labelled for screen readers by its caption.
 */
export function Flow({ caption, inputs, signs, result }: { caption: string; inputs: Node[]; signs: string[]; result: Node }) {
  return (
    <figure data-reveal className="m-0" aria-label={caption}>
      <figcaption className="text-title font-semibold">{caption}</figcaption>
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-stretch">
        {inputs.map((n, i) => (
          <div key={n.label} className="contents">
            <div className="lg:flex-1">
              <Box n={n} pop={i * 2 + 1} />
            </div>
            <Arrow sign={signs[i]} pop={i * 2 + 2} />
          </div>
        ))}
        <div className="lg:flex-1">
          <Box n={result} result pop={inputs.length * 2 + 1} />
        </div>
      </div>
    </figure>
  );
}
