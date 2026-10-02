import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Google Apps Script runtime code: plain-script globals called by the
    // Apps Script platform itself (doGet/doPost/etc.), not a Next.js/module
    // codebase — the no-unused-vars rule has no way to know that.
    "apps-script/**",
  ]),
]);

export default eslintConfig;
