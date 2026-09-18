import type { Metadata } from "next";
import { MenuBoard } from "@/components/menu-board";
import { ServiceStatus } from "@/components/service-status";

export const metadata: Metadata = {
  title: "Menu",
  description:
    "The full Tryo menu — smash burgers, Korean popcorn chicken, loaded fries, wraps, rice bowls and alcohol-free mocktails. Order online for collection from Rushden Lakes.",
};

export default function MenuPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-24 sm:px-6 sm:pt-28 lg:px-10">
      <div className="pb-5 sm:pb-8">
        <ServiceStatus />
        <h1 className="mt-3 font-display sm:mt-5 text-[clamp(2.4rem,7vw,4.5rem)] font-extrabold leading-[0.95] tracking-[-0.035em] text-white text-balance">
          The whole <span className="foil">menu</span>
        </h1>
        <p className="mt-3 max-w-xl text-pretty text-sm leading-relaxed text-char-200 sm:mt-4 sm:text-base">
          Everything is cooked to order. Tap a dish to add extras or make it a meal, or hit + to add it as it comes.
        </p>
      </div>

      <MenuBoard />
    </div>
  );
}
