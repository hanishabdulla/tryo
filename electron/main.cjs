const {
  app,
  BrowserWindow,
  ipcMain,
} = require("electron");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

/**
 * Load `.env.local` into `process.env` (only keys not already set).
 * Use for e.g. ELECTRON_RECEIPT_PRINTER=EML POS-80C (80mm USB thermal).
 */
function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
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
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

loadEnvLocal();

const PORT = Number(process.env.PORT || process.env.ELECTRON_NEXT_PORT || 43123);
const IS_DEV = process.env.ELECTRON_DEV === "1";
const NEXT_URL =
  process.env.ELECTRON_NEXT_URL || `http://127.0.0.1:${PORT}`;

/** @type {import('child_process').ChildProcess | null} */
let nextChild = null;
/** @type {BrowserWindow | null} */
let menuPrintWindow = null;

function nextCliPath() {
  return path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
}

function waitForHttpOk(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const http = require("http");
    const start = Date.now();
    const tick = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timeout waiting for ${url}`));
        return;
      }
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
          resolve(undefined);
        } else {
          setTimeout(tick, 250);
        }
      });
      req.on("error", () => setTimeout(tick, 250));
    };
    tick();
  });
}

function startNextProduction() {
  return new Promise((resolve, reject) => {
    const cli = nextCliPath();
    nextChild = spawn(process.execPath, [cli, "start", "-p", String(PORT)], {
      cwd: process.cwd(),
      stdio: "inherit",
      env: { ...process.env, PORT: String(PORT) },
    });
    nextChild.on("error", reject);
    nextChild.on("exit", (code) => {
      if (code && code !== 0) {
        console.error("Next.js process exited with code", code);
      }
    });
    waitForHttpOk(`${NEXT_URL}/`, 120_000).then(resolve).catch(reject);
  });
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#09090b",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.loadURL(NEXT_URL);
  if (IS_DEV) {
    win.webContents.openDevTools({ mode: "detach" });
  }
  return win;
}

function setupPrintIpc() {
  ipcMain.handle("receipt-print-silent", async (event, deviceName) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      return { ok: false, error: "No window" };
    }
    const dn = typeof deviceName === "string" ? deviceName.trim() : "";
    if (!dn) {
      return { ok: false, error: "Missing printer name" };
    }
    return new Promise((resolve) => {
      win.webContents.print(
        {
          silent: true,
          printBackground: true,
          deviceName: dn,
        },
        (success, failureReason) => {
          resolve({
            ok: success,
            error: success ? undefined : failureReason || "Print failed",
          });
        },
      );
    });
  });

  ipcMain.handle("menu:print", async () => {
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
          sandbox: false,
        },
      });
      menuPrintWindow = win;

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

      const onContentReady = (event) => {
        if (contentReadyFired || event.sender !== win.webContents) return;
        contentReadyFired = true;
        const deviceName = (process.env.ELECTRON_MENU_PRINTER || "").trim();
        const silent = Boolean(deviceName);
        win.webContents.print(
          {
            silent,
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

      const timeoutId = setTimeout(() => {
        finish({ ok: false, error: "Timeout waiting for menu content" });
      }, 45_000);

      win.on("closed", () => {
        if (!settled) {
          finish({ ok: false, error: "Window closed before print" });
        }
      });

      win
        .loadURL(`${NEXT_URL}/print/menu`)
        .catch((err) => finish({ ok: false, error: String(err) }));
    });
  });

  ipcMain.handle("print:listPrinters", async (event) => {
    try {
      return await event.sender.getPrintersAsync();
    } catch {
      return [];
    }
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w) {
      if (w.isMinimized()) w.restore();
      w.focus();
    }
  });
}

app.whenReady().then(async () => {
  loadEnvLocal();
  setupPrintIpc();
  try {
    if (!IS_DEV) {
      await startNextProduction();
    } else {
      await waitForHttpOk(`${NEXT_URL}/`, 120_000);
    }
  } catch (e) {
    console.error(e);
    app.quit();
    return;
  }
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    if (nextChild && !nextChild.killed) {
      nextChild.kill("SIGTERM");
    }
    app.quit();
  }
});

app.on("before-quit", () => {
  if (nextChild && !nextChild.killed) {
    nextChild.kill("SIGTERM");
  }
});
