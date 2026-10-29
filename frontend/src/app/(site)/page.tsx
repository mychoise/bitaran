import type { Metadata } from "next";
import { AnyDevice } from "@/components/home/AnyDevice";
import { BuiltForNepal } from "@/components/home/BuiltForNepal";
import { DayStory } from "@/components/home/DayStory";
import { Faq } from "@/components/home/Faq";
import { FinalCta } from "@/components/home/FinalCta";
import { GetStarted } from "@/components/home/GetStarted";
import { Hero } from "@/components/home/Hero";
import { KeyFeatures } from "@/components/home/KeyFeatures";
import { Stories } from "@/components/home/Stories";
import { TrustedBy } from "@/components/home/TrustedBy";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustedBy />
      <KeyFeatures />
      <BuiltForNepal />
      <DayStory />
      <AnyDevice />
      <GetStarted />
      <Stories />
      <Faq />
      <FinalCta />
    </>
  );
}
