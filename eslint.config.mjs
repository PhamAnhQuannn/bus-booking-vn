import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";
import importX from "eslint-plugin-import-x";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";

// SYS20 import-boundary lint (Issue 038 scaffolded at 'warn'; Issue 092 / Wave 8 flips to 'error').
// Domain folders under lib/ — a sibling-domain import from lib/core is a rule-4 violation.
// Reconciled to the real post-091 tree (Issue 092): dropped renamed/moved names
// (buses, manifest, notifications, payments, payouts, pickupPoints, routes, validation),
// added post-091 domains (flags, jobs, observability, places).
// Exempt core primitives (NOT domains, lib/core may re-export): db (lib/core/db), logger
// (lib/logger.ts), config (lib/config/env — re-exported by lib/core/config).
const LIB_DOMAINS = [
  "account",
  "admin",
  "analytics",
  "api",
  "audit",
  "auth",
  "booking",
  "catalog",
  "charter",
  "flags",
  "format",
  "geo",
  "home",
  "jobs",
  "ledger",
  "notification",
  "observability",
  "onboarding",
  "op",
  "payment",
  "places",
  "ratelimit",
  "reports",
  "search",
  "security",
  "seo",
  "staff",
  "state",
  "storage",
  "text",
  "ticketing",
  "trips",
  "utils",
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
        "error",
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
        "error",
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
  // SYS20 rule 3 (barrel) — issue 092b: ENFORCED at 'error' (boundaries/entry-point).
  //
  // no-cycle: issue #333 found the "cycles at zero" claim was VACUOUS — import-x's
  // ExportMap skips dependency files whose extension is not in `import-x/extensions`
  // (default [.js,.mjs,.cjs]), so in this all-TypeScript tree it never walked a
  // single .ts edge and could not see any cycle. With the extensions + resolver-next
  // settings below the rule now works. It revealed 11 pre-existing cross-domain barrel
  // cycles (booking↔payment↔ledger), which #343 burned down to ZERO; the scoped 'warn'
  // override those three domains carried has been deleted and the rule blocks
  // unconditionally.
  // TODO(092b follow-up): boundaries/entry-point is deprecated in v6 — migrate to
  // boundaries/dependencies (object selectors) at a convenient point. It functions
  // correctly here; the migration is cosmetic (removes the deprecation notice).
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    // app/dev/** is local-only stub scaffolding (stub-pay, stub-storage); it may
    // reach into stub internals (e.g. lib/storage/stubStore) and is exempt.
    ignores: ["**/__tests__/**", "**/*.test.{ts,tsx}", "app/dev/**"],
    plugins: { boundaries, "import-x": importX },
    settings: {
      // First match wins: lib-core before the generic lib-domain capture.
      "boundaries/elements": [
        { type: "lib-core", pattern: "lib/core", mode: "folder" },
        { type: "lib-domain", pattern: "lib/*", mode: "folder", capture: ["domain"] },
        { type: "app", pattern: "app", mode: "folder" },
        { type: "components", pattern: "components", mode: "folder" },
      ],
      "boundaries/ignore": ["**/__tests__/**", "**/*.test.{ts,tsx}", "app/dev/**"],
      // import-x@4 needs the resolver-next API: the legacy `import-x/resolver`
      // object form does not load the TS resolver here, so `@/*` path aliases
      // never resolve (issue #333: a deliberate lib/payment cycle produced zero
      // output).
      "import-x/resolver-next": [
        createTypeScriptImportResolver({ project: "./tsconfig.json" }),
      ],
      // no-cycle walks the dependency graph via ExportMap, which SKIPS any
      // dependency file whose extension is not in this set — and import-x's
      // default is only [.js,.mjs,.cjs]. Without .ts/.tsx here, every TS import
      // is silently dropped from the graph, so no-cycle can never see a cycle in
      // this (all-TypeScript) codebase (issue #333 root cause).
      "import-x/extensions": [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"],
    },
    rules: {
      // Cross-domain imports may only enter a lib-<domain> through its index barrel.
      // Intra-domain deep imports (same captured domain) are allowed.
      "boundaries/entry-point": [
        "error",
        {
          default: "disallow",
          rules: [
            // Cross-domain imports normally enter a lib-<domain> ONLY through its
            // index barrel. EXCEPTION: the leaves below are client-safe (pure
            // constants / browser-only DOM / pure functions — no server-only, pg,
            // prisma, or next/server siblings) and MUST be deep-imported by
            // 'use client' components. Importing them via the barrel pulls the
            // whole domain's server graph into the browser bundle → HTTP 500 +
            // dev wedge (traveler-smoke 2026-06-04 P1; AGENTS.md Issue 092b
            // barrel-leak class). Keep this allowlist minimal and client-safe-only.
            {
              target: ["lib-domain"],
              allow: [
                "index.{ts,tsx}",
                "csrfClient.{ts,tsx}", // lib/auth — browser cookie reader
                "clientSession.{ts,tsx}", // lib/auth — client session state + refresh
                "safeReturnTo.{ts,tsx}", // lib/auth — pure redirect sanitizer
                "consent.{ts,tsx}", // lib/booking — checkout consent constants
              "pickupSelection.{ts,tsx}", // lib/booking — pure pickup validator (client + server)
                "emailSuggest.{ts,tsx}", // lib/booking — pure email typo suggester (client)
                "statusLabels.{ts,tsx}", // lib/op — pure status/label display maps
                "formatRelativeVi.{ts,tsx}", // lib/op — pure relative-time formatter
                "cities.{ts,tsx}", // trip-planner/lib/planner — pure city registry (client selector + server)
              ],
            },
            { target: ["lib-core"], allow: "**" },
            { target: ["app", "components"], allow: "**" },
          ],
        },
      ],
      // 'error' — a NEW cycle must FAIL the build, not merely be reported.
      // `pnpm lint` is bare `eslint` with no --max-warnings (package.json), and both
      // CI and the pre-commit hook run it, so a globally-'warn' rule detects without
      // enforcing — the same zero-enforcement end state #333 was filed to fix.
      //
      // #343: the scoped 'warn' override for booking/payment/ledger is DELETED. Those
      // 11 cycles are gone (bookingRef + the transition map moved to lib/core; refundOut
      // moved to lib/payment), so the count is 0 and the rule now genuinely blocks
      // everywhere. Do not re-add a domain-scoped downgrade to land a cycle — that
      // recreates the hole, and it was scoped by DOMAIN rather than by the known
      // offenders, so it silently covered new cycles too.
      "import-x/no-cycle": ["error", { maxDepth: Infinity, ignoreExternal: true }],
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
    // Claude Code harness tooling — CommonJS Node scripts for the agent runtime, not
    // app source. `.claude/` is gitignored (.gitignore:53) yet ESLint does not read
    // .gitignore, so these were being linted against the app's ESM/TypeScript rules and
    // failing `no-require-imports` — a category error that blocks the pre-commit hook
    // for changes that never touch them. Skill/agent markdown under .claude/ is
    // unaffected (ESLint does not lint .md).
    ".claude/hooks/**",
    ".claude/scripts/**",
    "coverage/**",
    // Claude Code harness tooling — CommonJS Node scripts for the agent runtime, not
    // app source. `.claude/` is gitignored (.gitignore:53) yet ESLint does not read
    // .gitignore, so these were being linted against the app's ESM/TypeScript rules and
    // failing `no-require-imports` — a category error that blocks the pre-commit hook
    // for changes that never touch them. Skill/agent markdown under .claude/ is
    // unaffected (ESLint does not lint .md).
    ".claude/hooks/**",
    ".claude/scripts/**",
  ]),
]);

export default eslintConfig;
