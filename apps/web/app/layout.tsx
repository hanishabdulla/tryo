import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CartDrawer } from "@/components/cart-drawer";
import { HOURS_TABLE, SHOP } from "@/lib/hours";

/** Outfit stands in for the brand face (Astonpoliz) — geometric, single-storey 'a'. */
const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const SITE_URL = "https://www.tryoeats.uk";
const DESCRIPTION =
  "Smash burgers, Korean popcorn chicken, loaded fries and alcohol-free mocktails — cooked to order at Rushden Lakes. Order online for collection, open 11am–6pm every day.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Tryo — Legendary flavour, charred to perfection | Rushden Lakes",
    template: "%s | Tryo Rushden Lakes",
  },
  description: DESCRIPTION,
  applicationName: "Tryo",
  keywords: [
    "Tryo",
    "Rushden Lakes takeaway",
    "smash burger Rushden",
    "loaded fries Northamptonshire",
    "Korean fried chicken Rushden",
    "halal takeaway Rushden Lakes",
  ],
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Tryo",
    title: "Tryo — Legendary flavour, charred to perfection",
    description: DESCRIPTION,
    images: [{ url: "/img/burger-dirty.jpg", width: 900, height: 900, alt: "Tryo's Dirty Burger" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tryo — Legendary flavour, charred to perfection",
    description: DESCRIPTION,
    images: ["/img/burger-dirty.jpg"],
  },
  icons: { icon: "/ico.png", apple: "/ico.png" },
  alternates: { canonical: SITE_URL },
};

export const viewport: Viewport = {
  themeColor: "#070807",
  colorScheme: "dark",
};

/** Rich result for local search — hours, address and phone straight from lib/hours. */
const structuredData = {
  "@context": "https://schema.org",
  "@type": "Restaurant",
  name: "Tryo",
  url: SITE_URL,
  telephone: SHOP.phone,
  servesCuisine: ["Burgers", "Fried Chicken", "Fast Food"],
  priceRange: "££",
  image: `${SITE_URL}/img/burger-dirty.jpg`,
  address: {
    "@type": "PostalAddress",
    streetAddress: "Unit FC3, Rushden Lakes",
    addressLocality: "Rushden",
    addressRegion: "Northamptonshire",
    postalCode: "NN10 6FH",
    addressCountry: "GB",
  },
  openingHoursSpecification: HOURS_TABLE.map((row) => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: `https://schema.org/${row.label}`,
    opens: row.opens,
    closes: row.closes,
  })),
  acceptsReservations: false,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" className={`${outfit.variable} ${inter.variable} antialiased`}>
      <body className="grain">
        <Providers>
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
          <CartDrawer />
        </Providers>
        <script
          type="application/ld+json"
          // Static object literal, so there is no untrusted input to escape here.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </body>
    </html>
  );
}
