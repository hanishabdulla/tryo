const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

async function sendRawReceipt(printer, data) {
  // PowerShell cannot execute a file inside app.asar. Copy only our bundled script.
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tryo-print-'));
  const script = path.join(directory, 'raw-print.ps1');
  try {
    await fs.copyFile(path.join(__dirname, 'raw-print.ps1'), script);
    return await new Promise(resolve => {
      const executable = path.join(process.env.SystemRoot || 'C:\\Windows',
        'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
      const child = spawn(executable, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script],
        { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      let errors = '';
      let timedOut = false;
      const timeout = setTimeout(() => { timedOut = true; child.kill(); }, 45000);
      child.stderr.on('data', chunk => { errors += chunk.toString(); });
      child.stdout.resume();
      child.stdin.on('error', () => {});
      child.once('error', error => { clearTimeout(timeout); resolve({ ok: false, error: error.message }); });
      child.once('close', code => {
        clearTimeout(timeout);
        resolve({ ok: code === 0, error: code === 0 ? undefined : timedOut
          ? 'Print queue timed out. Check the Windows queue before retrying.'
          : errors.trim() || `Windows print service exited with code ${code}` });
      });
      // Names and content are data over stdin, never executable PowerShell text.
      child.stdin.end(JSON.stringify({ printer, data: data.toString('base64') }));
    });
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}
module.exports = { sendRawReceipt };
