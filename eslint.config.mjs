import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// SYS20 import-boundary lint (Issue 038, scaffold wave — severity 'warn'; Wave 8 flips to 'error').
// Domain folders under lib/ — a sibling-domain import from lib/core is a rule-4 violation.
// Excludes core primitives that currently live at lib/ root (db, logger, config) — those are
// NOT domains, so lib/core may re-export them.
const LIB_DOMAINS = [
  "account",
  "admin",
  "analytics",
  "api",
  "audit",
  "auth",
  "booking",
  "buses",
  "catalog",
  "charter",
  "ledger",
  "manifest",
  "notification",
  "notifications",
  "onboarding",
  "op",
  "payment",
  "payments",
  "payouts",
  "pickupPoints",
  "ratelimit",
  "reports",
  "routes",
  "search",
  "security",
  "staff",
  "state",
  "storage",
  "text",
  "ticketing",
  "trips",
  "utils",
  "validation",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // SYS20 rule 2: lib/<domain> MUST NOT import app/ or components/.
  // lib/stores/** is client-only state and is exempt.
  {
    files: ["lib/**/*.{ts,tsx}"],
    ignores: ["lib/stores/**"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["@/app/*", "@/components/*", "**/app/*", "**/components/*"],
              message:
                "lib/<domain> must not import app/ or components/ (SYS20 rule 2)",
            },
          ],
        },
      ],
    },
  },
  // SYS20 rule 4: lib/core imports NO domain (app → lib/<domain> → lib/core; no cycles).
  // Restricts every sibling-domain barrel; core primitives @/lib/db, @/lib/logger,
  // @/lib/config are deliberately NOT restricted (they are core, not domains).
  {
    files: ["lib/core/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["@/app/*", "@/components/*", "**/app/*", "**/components/*"],
              message:
                "lib/<domain> must not import app/ or components/ (SYS20 rule 2)",
            },
            {
              group: LIB_DOMAINS.flatMap((d) => [`@/lib/${d}`, `@/lib/${d}/*`]),
              message: "lib/core must not import a domain (SYS20 rule 4)",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated test artifacts (gitignored, not source):
    "playwright-report/**",
    "test-results/**",
    "coverage/**",
  ]),
]);

export default eslintConfig;
