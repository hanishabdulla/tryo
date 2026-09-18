import Image from "next/image";
import Link from "next/link";
import { Hero } from "@/components/hero";
import { Marquee } from "@/components/marquee";
import { Signatures } from "@/components/signatures";
import { Visit } from "@/components/visit";
import { Reveal } from "@/components/reveal";

const CRAFT = [
  {
    step: "01",
    title: "Nothing sits under a lamp",
    copy: "Every patty hits the flat-top when your order lands. It's why we quote twenty minutes and not two.",
  },
  {
    step: "02",
    title: "Crust over everything",
    copy: "Smashed thin and hard so the edges caramelise. Chicken is buttermilk-brined and double-dredged for shatter.",
  },
  {
    step: "03",
    title: "Built to travel",
    copy: "Fries boxed away from the sauce, wraps folded tight. It should taste the same on your sofa as at the counter.",
  },
];

export default function HomePage() {
  return (
    <>
      <Hero />
      <Marquee />
      <Signatures />

      {/* How we cook */}
      <section className="relative overflow-hidden py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <Reveal className="relative">
              <div className="relative aspect-[4/5] overflow-hidden rounded-5xl border border-white/10 sm:aspect-[4/3] lg:aspect-[4/5]">
                <Image
                  src="/img/burger-fries.jpg"
                  alt="A double smash burger with cheese and fries"
                  fill
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  className="object-cover"
                />
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-char-950/70 via-transparent to-transparent" />
              </div>

              {/* Floating price tag, anchored to the image corner. */}
              <div className="absolute -bottom-5 -right-2 rounded-3xl border border-gold/30 bg-char-950/90 p-5 backdrop-blur ember-glow sm:right-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-char-400">Make it a meal</p>
                <p className="mt-1 font-display text-2xl font-extrabold text-gold">+£2.99</p>
                <p className="mt-0.5 text-xs text-char-200">Fries + Drink</p>
              </div>
            </Reveal>

            <div>
              <Reveal>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">The method</p>
                <h2 className="mt-3 font-display text-[clamp(2rem,5.5vw,3.5rem)] font-extrabold leading-[0.98] tracking-[-0.03em] text-white text-balance">
                  Cooked to order. Every single time.
                </h2>
              </Reveal>

              <div className="mt-10 space-y-8">
                {CRAFT.map((entry, index) => (
                  <Reveal key={entry.step} delay={index * 120} className="flex gap-5">
                    <span className="font-display text-sm font-bold tabular-nums text-gold">{entry.step}</span>
                    <div className="flex-1 border-l border-white/10 pl-5">
                      <h3 className="font-display text-lg font-bold text-white sm:text-xl">{entry.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-char-200 text-pretty">{entry.copy}</p>
                    </div>
                  </Reveal>
                ))}
              </div>

              <Reveal delay={360}>
                <Link
                  href="/menu"
                  className="mt-10 inline-flex h-14 items-center gap-2.5 rounded-full bg-lime px-8 font-display text-base font-bold text-char-950 transition-transform duration-200 hover:scale-[1.03] active:scale-95"
                >
                  Start your order
                </Link>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      <Visit />
    </>
  );
}
