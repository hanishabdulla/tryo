import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["electron/**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // Pre-existing "seed form state from a Convex query" effects in
    // app/dashboard/menu/page.tsx and components/pos/TillManager.tsx. The rule
    // arrived with eslint-plugin-react-hooks v7, which the monorepo now
    // resolves for every workspace. Warn rather than error so a release build
    // is not blocked by findings that predate the restructure; both should be
    // converted to the render-phase adjustment pattern deliberately, with the
    // till exercised afterwards.
    files: ["app/dashboard/menu/page.tsx", "components/pos/TillManager.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "release/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
