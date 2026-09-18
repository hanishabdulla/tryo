/**
 * Infinite ticker of dish names.
 *
 * The track holds the list twice and translates by -50%, so the second copy is
 * exactly where the first started when the animation loops — no visible seam and
 * no JS. `aria-hidden` on the duplicate keeps screen readers from reading it out
 * a second time.
 */

const WORDS = [
  "Dirty Fries",
  "Korean Bites",
  "Smash Burgers",
  "Loaded Wraps",
  "Chicken Tikka",
  "Mocktails",
  "Falafel",
  "Karak Tea",
  "Jumbo Hot Dogs",
  "Mexican Rice Bowl",
];

export function Marquee() {
  return (
    // `overflow-hidden` is load-bearing: the track is `w-max` and several
    // thousand pixels wide, so without it the whole document scrolls sideways.
    <div className="relative overflow-hidden border-y border-white/10 bg-brand py-4">
      {/* Feathered edges so words fade out rather than clip at the viewport. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-brand to-transparent sm:w-28"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-brand to-transparent sm:w-28"
      />

      <div className="flex w-max animate-marquee items-center will-change-transform">
        {[0, 1].map((copy) => (
          <div key={copy} aria-hidden={copy === 1} className="flex items-center">
            {WORDS.map((word) => (
              <span key={`${copy}-${word}`} className="flex items-center">
                <span className="whitespace-nowrap px-6 font-display text-lg font-bold uppercase tracking-[0.05em] text-white sm:text-2xl">
                  {word}
                </span>
                <span className="text-xl text-gold-soft">✦</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
