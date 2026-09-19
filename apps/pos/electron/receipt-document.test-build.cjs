// Load lib/receipt-document.ts into the Electron test process.
//
// The till builds its tickets in TypeScript and the print pipeline is CommonJS,
// so the test compiles the real module rather than keeping a second copy of it
// that could quietly drift from what the shop actually prints.
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const typescript = require("typescript");

const source = path.join(__dirname, "..", "lib", "receipt-document.ts");
const compiled = typescript.transpileModule(fs.readFileSync(source, "utf8"), {
  compilerOptions: {
    module: typescript.ModuleKind.CommonJS,
    target: typescript.ScriptTarget.ES2022,
  },
  fileName: source,
}).outputText;

const loaded = new Module(source, module);
loaded.filename = source;
loaded.paths = Module._nodeModulePaths(path.dirname(source));
loaded._compile(compiled, source);

module.exports = loaded.exports;
