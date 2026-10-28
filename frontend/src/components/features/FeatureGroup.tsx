import type { StaticImageData } from "next/image";
import Image from "next/image";
import { FeatureBlock, type Feature } from "./FeatureBlock";

export type Group = {
  id: string;
  name: string;
  line: string;
  features: Feature[];
  photo?: { src: StaticImageData; alt: string; slotAlt: string };
};

/** A group of features: an ink-ruled header (with a photograph when the group has one), then each feature. */
export function FeatureGroup({ group: g, index }: { group: Group; index: number }) {
  return (
    <section id={g.id} aria-labelledby={`${g.id}-title`} className="border-t-2 border-ink">
      <div className="container">
        <header className="grid grid-cols-1 items-end gap-x-columns gap-y-10 pt-section-s lg:grid-cols-12">
          <div className={g.photo ? "lg:col-span-6" : "lg:col-span-8"}>
            <h2 id={`${g.id}-title`}>
              {index + 1}. {g.name}
            </h2>
            <p className="lead mt-6 text-ink-2">{g.line}</p>
          </div>
          {g.photo ? (
            <figure
              data-slot={`group-${g.id}`}
              data-alt={g.photo.slotAlt}
              className="relative m-0 aspect-16/9 overflow-hidden lg:min-h-80 rounded-card lg:col-span-6"
            >
              <Image
                src={g.photo.src}
                alt={g.photo.alt}
                fill
                sizes="(min-width: 64rem) 45vw, 100vw"
                placeholder="blur"
                className="object-cover"
              />
            </figure>
          ) : null}
        </header>
        <div className="divide-y divide-rule-2">
          {g.features.map((f) => (
            <FeatureBlock key={f.id} feature={f} />
          ))}
        </div>
      </div>
    </section>
  );
}
