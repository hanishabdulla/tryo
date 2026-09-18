import Image from "next/image";
import Link from "next/link";
import { SHOP } from "@/lib/hours";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-char-950">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-10">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-sm">
            <Image src="/brand/tryo-wordmark-light.png" alt="Tryo" width={1034} height={512} className="h-11 w-auto" />
            <p className="mt-5 text-sm leading-relaxed text-char-400 text-pretty">
              Legendary flavour, charred to perfection. Cooked to order at Rushden Lakes — burgers, loaded fries,
              Korean popcorn chicken and alcohol-free mocktails.
            </p>
            <div className="mt-6 flex gap-3">
              <Social href={SHOP.instagram} label="Tryo on Instagram">
                <path d="M12 2.2c3.2 0 3.6 0 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.25.07 1.63.07 4.81s0 3.56-.07 4.81c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.25.06-1.63.07-4.85.07s-3.6 0-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.8 3.8 0 0 1-1.38-.9 3.8 3.8 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.2 15.56 2.2 15.18 2.2 12s0-3.56.07-4.81c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.44 2.2 8.82 2.2 12 2.2Zm0 3.14a6.66 6.66 0 1 0 0 13.32 6.66 6.66 0 0 0 0-13.32Zm0 10.99a4.33 4.33 0 1 1 0-8.66 4.33 4.33 0 0 1 0 8.66Zm8.48-11.25a1.56 1.56 0 1 1-3.11 0 1.56 1.56 0 0 1 3.11 0Z" />
              </Social>
              <Social href={SHOP.facebook} label="Tryo on Facebook">
                <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.49-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.9h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
              </Social>
            </div>
          </div>

          <div className="grid flex-1 gap-8 sm:grid-cols-3 lg:max-w-xl">
            <FooterColumn title="Order">
              <FooterLink href="/menu">Full menu</FooterLink>
              <FooterLink href="/#signatures">Signatures</FooterLink>
              <FooterLink href={SHOP.phoneHref}>Order by phone</FooterLink>
            </FooterColumn>

            <FooterColumn title="Visit">
              <FooterLink href="/#visit">Opening hours</FooterLink>
              <FooterLink href={SHOP.mapsUrl}>Directions</FooterLink>
            </FooterColumn>

            <FooterColumn title="Contact">
              <li className="text-sm leading-relaxed text-char-400">
                {SHOP.addressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </li>
              <FooterLink href={SHOP.phoneHref}>{SHOP.phone}</FooterLink>
            </FooterColumn>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/8 pt-6 text-xs text-char-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Tryo. All rights reserved.</p>
          <p>Allergen information available in store — please ask before ordering.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white">{title}</h3>
      <ul className="mt-4 space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const external = href.startsWith("http") || href.startsWith("tel:");
  return (
    <li>
      {external ? (
        <a
          href={href}
          {...(href.startsWith("http") ? { target: "_blank", rel: "noreferrer noopener" } : {})}
          className="text-sm text-char-400 transition-colors hover:text-lime"
        >
          {children}
        </a>
      ) : (
        <Link href={href} className="text-sm text-char-400 transition-colors hover:text-lime">
          {children}
        </Link>
      )}
    </li>
  );
}

function Social({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={label}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 text-char-200 transition-colors hover:border-lime hover:text-lime"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
        {children}
      </svg>
    </a>
  );
}
