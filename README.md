# Tryo

Monorepo for Tryo, Rushden Lakes: the till, the customer site, and the Convex
backend they share.

```
apps/pos/     Tryo POS — Next.js in an Electron shell, receipt + menu printing
apps/web/     tryoeats.uk — public menu and online ordering
convex/       the backend both apps talk to (schema, menu, orders, till)
```

`convex/` deliberately sits at the root rather than inside an app. **One Convex
deployment can only have one schema owner** — `convex/` is pushed as a unit, so
a second copy in a second repo would clobber the first on every deploy. Keeping
one copy also means the `orderLine` shape, the meal-upgrade rule and the pence
arithmetic are typechecked against both apps at once. If they drift, the receipt
the till prints stops matching what the customer was charged.

## Setup

npm workspaces; install once from the root.

```bash
npm install
```

Both apps read `NEXT_PUBLIC_CONVEX_URL` from their own `.env.local`, and the
Convex CLI reads `CONVEX_DEPLOYMENT` from the root `.env.local`. All three must
point at the same deployment.

```bash
npm run convex:dev     # backend, watches convex/ — run this first
npm run pos            # till in a browser        → :3000
npm run pos:electron   # till in the Electron shell
npm run web            # customer site            → :3100
```

`npm run build` and `npm run lint` run across every workspace. To target one:
`npm run build -w @tryo/pos`.

## Where things live

| Task | Path |
| --- | --- |
| Menu content (categories, items, prices) | Till → Dashboard → Menu, stored in Convex |
| Menu seed / reset | `convex/seed.ts` — `npx convex run seed:replaceMenu` |
| Till orders, discounts, cash-up | `convex/orders.ts`, `convex/till.ts` |
| Online orders | `convex/online.ts` |
| Opening hours, address, phone | `apps/web/lib/hours.ts` |
| Brand colours and type | `apps/web/app/globals.css` |

Opening hours are **11am – 6pm, seven days**, and the site is **collection
only**.

## Releases

Pushing a `v*` tag builds and publishes the Windows POS installer
(`.github/workflows/release.yml`). The workflow installs from the root and
targets `@tryo/pos`; artifacts land in `apps/pos/release/`.

See `apps/pos/README.md` and `apps/web/README.md` for each app.
