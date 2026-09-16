# Tryo POS

Tryo is a takeaway point-of-sale desktop app. The interface is a Next.js App
Router application, Convex provides the menu and order data, and Electron hosts
the local Next.js server and provides native receipt/menu printing.

## Development

Create `.env.local` before running the app:

```dotenv
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# Optional exact system printer names for silent printing:
ELECTRON_RECEIPT_PRINTER=EML POS-80C
ELECTRON_MENU_PRINTER=EML POS-80C
```

The dashboard password is stored in Convex as a salted hash. Set or change it
with (this also signs out every dashboard session):

```bash
npx convex run dashboardAuth:setPassword '{"password":"new-password"}'
```

Start Convex in one terminal, then Electron in another:

```bash
npx convex dev
npm run electron:dev
```

The browser-only development server is still available with `npm run dev`.

## Desktop builds

```bash
# Unpacked app, useful for checking the packaged runtime
npm run electron:pack

# Installer/archive for the current operating system
npm run electron:dist
```

Artifacts are written to `release/`. The packaged app contains Next.js's
standalone production server, static assets, and the Electron shell; it does not
need the source checkout or a separately installed Node.js runtime.

`NEXT_PUBLIC_CONVEX_URL` is embedded by `next build`, so it must be set on the
machine that creates the installer. Runtime-only settings can be placed in
`.env.local` under Electron's user-data directory. On macOS that is normally:

```text
~/Library/Application Support/Tryo POS/.env.local
```

On Windows/Linux, a `tryo.env` file beside the executable is also loaded. Shell
environment variables take precedence over either file.

## Windows receipt-printer setup

1. Install the printer manufacturer's Windows driver and connect the printer by
   USB, network, or Bluetooth.
2. Confirm the printer appears under **Settings > Bluetooth & devices > Printers
   & scanners** and set its paper size to 80 mm receipt paper.
3. Open Tryo POS and select **Receipt printer** in the top bar.
4. Select the exact Windows printer name and choose **Test print**.
5. After the test slip prints correctly, choose **Save printer**.

The selection is stored in Electron's per-user application data, survives app
updates, and is not stored in the repository. Each completed order prints
silently to that device. **Reprint last** can resend the latest receipt after a
paper or spooler problem.

Tagged commits (`v*`) trigger `.github/workflows/release.yml`, which builds the
Windows NSIS installer on GitHub Actions and attaches it to a GitHub release.

## Application structure

- `app/` — POS, protected reporting dashboard, auth API, and print view.
- `components/pos/` — ordering flow, checkout, and receipt UI.
- `convex/` — menu, order, report, and seed backend functions/schema.
- `electron/` — desktop lifecycle, local Next server, secure preload bridge,
  single-instance handling, and native printer integration.
- `lib/` — pricing, discount, reporting date, and Excel export helpers.
