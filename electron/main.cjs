const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");

const IS_DEV = process.env.ELECTRON_DEV === "1";
const DEFAULT_DEV_PORT = 43123;

/** @type {import('child_process').ChildProcess | null} */
let nextChild = null;
/** @type {BrowserWindow | null} */
let menuPrintWindow = null;
let nextUrl = "";

/** Load dotenv-style values, while preserving values supplied by the shell. */
function loadEnvFile(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return;
  }

  for (let line of raw.split(/\r?\n/)) {
    line = line.replace(/^\uFEFF/, "").trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function loadRuntimeEnvironment() {
  if (!app.isPackaged) {
    loadEnvFile(path.join(process.cwd(), ".env.local"));
    return;
  }

  // The user-data file survives app upgrades. `tryo.env` beside the executable
  // is also supported for managed Windows/Linux installations.
  loadEnvFile(path.join(app.getPath("userData"), ".env.local"));
  loadEnvFile(path.join(path.dirname(app.getPath("exe")), "tryo.env"));
}

function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function readSettings() {
  try {
    const value = JSON.parse(fs.readFileSync(settingsPath(), "utf8"));
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function writeSettings(settings) {
  const file = settingsPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporaryFile = `${file}.tmp`;
  fs.writeFileSync(temporaryFile, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  fs.renameSync(temporaryFile, file);
}

function receiptPrinterName() {
  const saved = readSettings().receiptPrinter;
  if (typeof saved === "string" && saved.trim()) return saved.trim();
  return (
    process.env.ELECTRON_RECEIPT_PRINTER ||
    process.env.ELECTRON_MENU_PRINTER ||
    ""
  ).trim();
}

function printWebContents(webContents, deviceName) {
  return new Promise((resolve) => {
    webContents.print(
      {
        silent: true,
        printBackground: true,
        deviceName,
        margins: { marginType: "none" },
      },
      (success, failureReason) => {
        resolve({
          ok: success,
          error: success ? undefined : failureReason || "Print failed",
        });
      },
    );
  });
}

async function printTestReceipt(deviceName) {
  const win = new BrowserWindow({
    show: false,
    width: 380,
    height: 600,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: 80mm auto; margin: 0; }
    body { width: 72mm; margin: 0; padding: 6mm 4mm; color: #000; background: #fff;
      font: 12px/1.35 ui-monospace, SFMono-Regular, Consolas, monospace; }
    h1, p { margin: 0; text-align: center; } hr { border: 0; border-top: 1px dashed #000; margin: 10px 0; }
    .row { display: flex; justify-content: space-between; }
  </style></head><body><h1>TRYO POS</h1><p>Receipt printer test</p><hr>
  <div class="row"><span>Printer connected</span><span>OK</span></div>
  <div class="row"><span>80mm layout</span><span>OK</span></div><hr>
  <p>${new Date().toLocaleString("en-GB")}</p><p>Ready for orders</p></body></html>`;

  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return await printWebContents(win.webContents, deviceName);
  } finally {
    if (!win.isDestroyed()) win.close();
  }
}

function getAvailablePort(preferredPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen({ host: "127.0.0.1", port: preferredPort }, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function waitForHttpOk(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const tick = () => {
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error(`Timeout waiting for ${url}`));
        return;
      }
      const request = http.get(url, (response) => {
        response.resume();
        if (
          response.statusCode &&
          response.statusCode >= 200 &&
          response.statusCode < 500
        ) {
          resolve();
        } else {
          setTimeout(tick, 250);
        }
      });
      request.on("error", () => setTimeout(tick, 250));
    };
    tick();
  });
}

async function startNextProduction() {
  const requestedPort = Number(
    process.env.PORT || process.env.ELECTRON_NEXT_PORT || 0,
  );
  const port = await getAvailablePort(
    Number.isInteger(requestedPort) && requestedPort >= 0 ? requestedPort : 0,
  );
  nextUrl = `http://127.0.0.1:${port}`;

  let script;
  let args;
  let cwd;
  const childEnv = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    HOSTNAME: "127.0.0.1",
    PORT: String(port),
  };

  if (app.isPackaged) {
    cwd = path.join(process.resourcesPath, "next-server", "standalone");
    script = path.join(cwd, "server.js");
    args = [script];
  } else {
    cwd = process.cwd();
    script = path.join(cwd, "node_modules", "next", "dist", "bin", "next");
    args = [script, "start", "-H", "127.0.0.1", "-p", String(port)];
  }

  nextChild = spawn(process.execPath, args, {
    cwd,
    stdio: "inherit",
    env: childEnv,
  });
  nextChild.once("error", (error) => console.error("Next.js failed:", error));
  nextChild.once("exit", (code, signal) => {
    nextChild = null;
    if (code && code !== 0) {
      console.error(`Next.js exited with code ${code} (${signal || "no signal"})`);
    }
  });

  await waitForHttpOk(`${nextUrl}/`, 120_000);
}

function isTrustedSender(senderFrame) {
  try {
    return new URL(senderFrame.url).origin === new URL(nextUrl).origin;
  } catch {
    return false;
  }
}

function secureWindow(win) {
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    try {
      if (new URL(url).origin !== new URL(nextUrl).origin) event.preventDefault();
    } catch {
      event.preventDefault();
    }
  });
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#09090b",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  secureWindow(win);
  win.once("ready-to-show", () => win.show());
  void win.loadURL(nextUrl);
  if (IS_DEV) win.webContents.openDevTools({ mode: "detach" });
  return win;
}

function setupPrintIpc() {
  ipcMain.handle("receipt-print-silent", async (event) => {
    if (!isTrustedSender(event.senderFrame)) {
      return { ok: false, error: "Untrusted print request" };
    }
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { ok: false, error: "No window" };
    const printer = receiptPrinterName();
    if (!printer) return { ok: false, error: "Missing printer name" };
    return printWebContents(win.webContents, printer);
  });

  ipcMain.handle("menu:print", async (event) => {
    if (!isTrustedSender(event.senderFrame)) {
      return { ok: false, error: "Untrusted print request" };
    }
    if (menuPrintWindow && !menuPrintWindow.isDestroyed()) {
      return { ok: false, error: "Menu print already in progress" };
    }

    return new Promise((resolve) => {
      const win = new BrowserWindow({
        show: false,
        width: 420,
        height: 1600,
        backgroundColor: "#ffffff",
        webPreferences: {
          preload: path.join(__dirname, "preload.cjs"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      menuPrintWindow = win;
      secureWindow(win);

      let contentReadyFired = false;
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        ipcMain.removeListener("menu-print-content-ready", onContentReady);
        clearTimeout(timeoutId);
        if (!win.isDestroyed()) win.close();
        menuPrintWindow = null;
        resolve(result);
      };
      const onContentReady = (readyEvent) => {
        if (
          contentReadyFired ||
          readyEvent.sender !== win.webContents ||
          !isTrustedSender(readyEvent.senderFrame)
        ) {
          return;
        }
        contentReadyFired = true;
        const deviceName = (process.env.ELECTRON_MENU_PRINTER || "").trim();
        win.webContents.print(
          {
            silent: Boolean(deviceName),
            printBackground: true,
            deviceName: deviceName || undefined,
          },
          (success, failureReason) => {
            finish({
              ok: success,
              error: success ? undefined : failureReason || "Print failed",
            });
          },
        );
      };

      ipcMain.on("menu-print-content-ready", onContentReady);
      const timeoutId = setTimeout(
        () => finish({ ok: false, error: "Timeout waiting for menu content" }),
        45_000,
      );
      win.on("closed", () => {
        if (!settled) finish({ ok: false, error: "Window closed before print" });
      });
      void win
        .loadURL(`${nextUrl}/print/menu`)
        .catch((error) => finish({ ok: false, error: String(error) }));
    });
  });

  ipcMain.handle("print:listPrinters", async (event) => {
    if (!isTrustedSender(event.senderFrame)) return [];
    try {
      return await event.sender.getPrintersAsync();
    } catch {
      return [];
    }
  });

  ipcMain.handle("print:getReceiptPrinter", (event) => {
    if (!isTrustedSender(event.senderFrame)) return "";
    return receiptPrinterName();
  });

  ipcMain.handle("print:setReceiptPrinter", async (event, deviceName) => {
    if (!isTrustedSender(event.senderFrame)) {
      return { ok: false, error: "Untrusted printer request" };
    }
    const printer = typeof deviceName === "string" ? deviceName.trim() : "";
    if (!printer) return { ok: false, error: "Choose a printer" };
    const printers = await event.sender.getPrintersAsync();
    if (!printers.some((candidate) => candidate.name === printer)) {
      return { ok: false, error: "That printer is no longer available" };
    }
    writeSettings({ ...readSettings(), receiptPrinter: printer });
    return { ok: true };
  });

  ipcMain.handle("print:testReceiptPrinter", async (event, deviceName) => {
    if (!isTrustedSender(event.senderFrame)) {
      return { ok: false, error: "Untrusted printer request" };
    }
    const printer = typeof deviceName === "string" ? deviceName.trim() : "";
    if (!printer) return { ok: false, error: "Choose a printer" };
    const printers = await event.sender.getPrintersAsync();
    if (!printers.some((candidate) => candidate.name === printer)) {
      return { ok: false, error: "That printer is no longer available" };
    }
    return printTestReceipt(printer);
  });
}

function stopNextServer() {
  if (nextChild && !nextChild.killed) nextChild.kill("SIGTERM");
  nextChild = null;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });

  app.whenReady().then(async () => {
    loadRuntimeEnvironment();
    setupPrintIpc();
    try {
      if (IS_DEV) {
        const port = Number(process.env.ELECTRON_NEXT_PORT || DEFAULT_DEV_PORT);
        nextUrl = process.env.ELECTRON_NEXT_URL || `http://127.0.0.1:${port}`;
        await waitForHttpOk(`${nextUrl}/`, 120_000);
      } else if (process.env.ELECTRON_NEXT_URL) {
        nextUrl = process.env.ELECTRON_NEXT_URL;
        await waitForHttpOk(`${nextUrl}/`, 120_000);
      } else {
        await startNextProduction();
      }
    } catch (error) {
      console.error(error);
      app.quit();
      return;
    }

    createMainWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", stopNextServer);
