# Tryo Eats — customer site

The public site at [tryoeats.uk](https://www.tryoeats.uk/): menu, online
ordering, opening hours. Next.js App Router + Tailwind v4, sharing the POS's
Convex deployment. See the root `README.md` for why `convex/` lives at the
monorepo root.

**Collection only, 11am – 6pm every day.** There is no delivery option anywhere
in the flow, and the hours are defined once in `lib/hours.ts` — the status
indicator, the Visit table and the schema.org rich result all read from it.

## Development

```bash
npm install                        # from the monorepo root
cp .env.local.example .env.local   # same deployment as the POS
npm run web                        # from the root → http://localhost:3100
```

`NEXT_PUBLIC_CONVEX_URL` must match the POS's `.env.local`. Without it the site
still builds and renders the bundled menu in `lib/menu.ts`, but ordering is
disabled and the basket tells customers to phone instead.

## How the menu gets here

`components/providers.tsx` subscribes to `menu:listCategories`,
`menu:listAllItems` and `menu:getMenuConfig`. Edit the menu in **Dashboard →
Menu** on the till and the site updates live — no deploy.

Until Convex answers, the site serves `FALLBACK_MENU` from `lib/menu.ts`, a
mirror of `convex/seed.ts`. That keeps the first paint a real menu rather than a
skeleton, and keeps the site usable if the deployment is unreachable.

Photography and the vegan/veggie/spicy badges are web-only and never come from
the till. They are matched by **keyword** (`IMAGE_RULES` / `TAG_RULES`), not by
exact item name, so renaming "Classic Combo" to "Classic Popcorn Chicken Combo"
in the dashboard doesn't silently drop the item to a generic photo.

### Extras are add-ons, not a section

The till keeps cheese, jalapenos, an extra patty and so on in a category called
**Extras**. That is bookkeeping, not something a customer shops for, so the site
never renders it as a browsable section. Its items surface as checkboxes inside
the item sheet instead, on food only — never on drinks. `convex/online.ts`
mirrors the same rule when it reprices an order, so an addon is accepted only if
it is either declared on the item itself or is a live Extras row.

If you add a genuinely browsable category in the dashboard, it appears
automatically; only the literal name "Extras" is special (`EXTRAS_CATEGORY`).

## Online orders

Orders go to `online:placeOnlineOrder` (`convex/online.ts`), **not** the till's
`orders:submitOrder`. The till's mutation requires a cash/card tender, writes
the order as already `completed`, and consumes the till session's invoice
counter — none of which is true of a web order, which is unpaid, untouched, and
may arrive before the till is opened for the day.

Web orders therefore:

- carry `source: "web"` and land as `status: "pending"`;
- take numbers from their own daily counter, offset by `WEB_ORDER_NUMBER_BASE`
  (500), so they never collide with the till's `1..n` run;
- record `paymentMethod: "unpaid"`, keeping them out of the till's expected-cash
  reconciliation until they're actually tendered;
- always set `orderType: "collection"` with `deliveryFee: 0`.

**Prices sent by the browser are not trusted.** Every line is repriced
server-side against `menuItems` — base price, meal upcharge and each addon — and
the request is rejected if the client's figure disagrees.

The till can subscribe to `online:listLiveOnlineOrders` for the queue and call
`online:setOnlineOrderStatus` to move an order along.

### Not yet deployed

`convex/online.ts` and the new optional columns on `orders` have **not** been
pushed to the live deployment. Run `npx convex dev` (or `deploy`) from the repo
root when you're ready; until then the site renders and takes basket input, but
placing an order returns an error. The schema changes are additive and optional,
so existing till orders and `submitOrder` are unaffected.

Still to build: a POS screen for the incoming web queue, and auto-printing a
ticket when an order arrives.

## Conventions

- Money is integer pence everywhere, as in the POS.
- Line pricing is `basePrice + mealUpcharge + Σ(option prices)`, mirroring
  `components/pos/PosApp.tsx`.
- Times resolve against `Europe/London` (`lib/hours.ts`), not the visitor's
  clock, so the trading status is the shop's truth and not the browser's.
- Form inputs are 16px on mobile. Anything smaller makes iOS Safari zoom the
  page when the field takes focus.
- Brand colours are green `#00955E` and gold `#ECB100`. On the dark UI,
  `--color-lime` (`#19C980`) is the accessible
  on-dark variant of the brand green; the sheet value alone doesn't clear 4.5:1
  against charcoal.
