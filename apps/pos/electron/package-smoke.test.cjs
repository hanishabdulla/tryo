const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { packagedAppDirectory } = require("./runtime-paths.cjs");

const appDirectory = packagedAppDirectory(
  path.resolve(__dirname, "..", "release", "win-unpacked", "resources"),
);
const server = path.join(appDirectory, "server.js");

function isDirectory(directory) {
  return fs.existsSync(directory) && fs.statSync(directory).isDirectory();
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.on("error", reject);
    socket.listen(0, "127.0.0.1", () => {
      const address = socket.address();
      socket.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });
}

async function waitForServer(url, child, output) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    assert.equal(child.exitCode, null, `Packaged server exited early:\n${output()}`);
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for packaged server:\n${output()}`);
}

async function main() {
  assert.ok(
    fs.existsSync(server) && fs.statSync(server).isFile(),
    `Missing packaged server: ${server}`,
  );
  assert.ok(
    isDirectory(path.join(appDirectory, ".next", "static")),
    "Missing packaged Next.js static assets",
  );
  assert.ok(
    isDirectory(path.join(appDirectory, "public")),
    "Missing packaged public assets",
  );

  const port = await availablePort();
  let logs = "";
  const child = spawn(process.execPath, [server], {
    cwd: appDirectory,
    env: {
      ...process.env,
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => (logs += chunk));
  child.stderr.on("data", (chunk) => (logs += chunk));

  try {
    const response = await waitForServer(
      `http://127.0.0.1:${port}/`,
      child,
      () => logs,
    );
    const html = await response.text();
    assert.match(html, /Tryo/i, "Packaged server returned the wrong page");
    console.log(`PASS packaged POS server responded on port ${port}`);
  } finally {
    child.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
