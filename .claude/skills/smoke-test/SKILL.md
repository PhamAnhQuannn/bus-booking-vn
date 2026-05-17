---
name: smoke-test
description: Browser-level verification of the running app via Playwright MCP. Drives a real Chromium against the running dev server, walks user-supplied or CLAUDE.md-defined golden paths, captures screenshots at key states, and asserts error-state UI (resource conflicts, third-party failures, double-submit races). Use after a UI/UX change, before merging a feature, or when the user says "smoke test" / "browser test" / "play through this".
---

# /smoke-test — Browser Verification via Playwright MCP

Invoke as `/smoke-test [angle-list]`. Executes browser test angles against the running dev server using Playwright MCP tools.

The angle list (if provided): $ARGUMENTS

This skill is a **Playwright MCP harness** — the golden paths themselves are project data, not skill data. Provide paths via the invocation argument, or define them under a `## Smoke-test golden paths` section in `CLAUDE.md`. If neither is present, the skill prompts for them before running.

---

## Why you'd care

A unit-test-green PR can still ship a broken golden path because nothing actually clicked through the app. Browser-level smoke catches the gap between "the code works" and "the product works."

## Pre-flight

1. Verify the dev server is running:
   - Default: `http://localhost:3000` (Next.js convention). For other stacks check the project's dev-server port — e.g. `http://localhost:5173` (Vite), `http://localhost:8000` (Django/FastAPI), `http://localhost:4000` (Phoenix/Rails-API). Use `browser_navigate` and confirm a non-error response.
2. If the server is not running, report and stop:
   ```
   BLOCKED — dev server not running
   Start with: <your stack's dev command, e.g. pnpm dev / uv run dev / rails s>
   ```
3. **Resolve the golden-path list** in this order:
   1. If `$ARGUMENTS` names angles → use them.
   2. Else if `CLAUDE.md` has a `## Smoke-test golden paths` section → use them.
   3. Else → ask the user for the 1–3 critical user flows to walk and stop until provided. Do not invent flows.

---

## Execution Protocol

For each test angle, execute in order:

### Playwright MCP Tools Available
- `browser_navigate` — navigate to URL
- `browser_click` — click element by selector or description
- `browser_fill_form` — fill form fields
- `browser_type` — type text into focused input
- `browser_select_option` — select dropdown option
- `browser_press_key` — press keyboard keys
- `browser_snapshot` — capture accessibility tree snapshot (use to understand page state)
- `browser_take_screenshot` — capture screenshot at key states
- `browser_wait_for` — wait for element or condition
- `browser_network_request` — make a direct network request from browser context
- `browser_network_requests` — view recent network requests
- `browser_console_messages` — check for JS errors
- `browser_evaluate` — run JavaScript in page context

### Angle Execution Template

Apply this template to **every** golden path the user/CLAUDE.md supplies:

1. `browser_navigate` to the start URL
2. `browser_snapshot` — understand current page state before acting
3. Execute the supplied click / fill / select / wait sequence in order
4. `browser_snapshot` + `browser_take_screenshot` at the key verification state
5. Assert the expected end-state via `browser_evaluate` (e.g. confirmation ID visible, target row exists, status badge text)
6. `browser_console_messages` — verify no unhandled JS errors
7. Mark PASS or FAIL with specific evidence

---

## Golden Path Template

For each angle the user / CLAUDE.md names, fill in:

```
ANGLE: <angle-name>
  Start URL:        <path under the dev server>
  Pre-condition:    <seed state required, e.g. "logged in as <role>", "fixture X exists">
  Interaction:
    1. <action>     — selector or description
    2. <action>     — selector or description
    ...
  End-state assertion:
    - <visible element / text / data-testid value>
    - <network call observed: METHOD /path → status>
    - <no console errors>
  Screenshots:      <state names to capture>
```

### Illustrative example (one card-payment golden path)

```
ANGLE: card-payment-happy-path
  Start URL:        /<checkout entry>
  Pre-condition:    Cart contains ≥1 item (seed or pre-action)
  Interaction:
    1. browser_fill_form({ name: "Test User", email: "test@example.com" })
    2. browser_click("Continue to payment")
    3. browser_fill_form({ card: "4242 4242 4242 4242", exp: "12/34", cvc: "123" })   # Stripe test card
    4. browser_click("Pay now")
    5. browser_wait_for("order confirmation OR redirect")
  End-state assertion:
    - browser_evaluate("document.querySelector('[data-testid=order-id]')?.textContent") returns an ID
    - No console errors
  Screenshots:      checkout, payment-page, order-confirmation
```

The card-number `4242 4242 4242 4242` is the Stripe test-mode success card; substitute your processor's equivalent if you don't use Stripe.

---

## Error-State Categories

Error tests fall into three categories. Run at least one per category that applies to the project's golden path. The illustrative examples rotate verticals — substitute whichever instantiation matches the project.

### Category 1 — Resource-conflict (409)

A second actor mutates state between read and write; the UI must surface a specific message and recover gracefully.

```
1. Pre-condition: two clients (two tabs or one tab + one direct API call) target the same resource
2. Client A commits the mutation — should succeed
3. Client B commits the mutation — should receive 409
4. browser_wait_for("conflict message visible")
5. browser_snapshot() — confirm the message names the offending resource (not generic "error")
6. PASS if: the message is specific AND the UI refreshes to show the new state (alternate slots, updated cart, updated row)

Illustrative instantiations:
  - Marketplace: two buyers attempt to claim the same listing
  - SaaS: two members invite the same email to a workspace
  - Restaurant: two diners book the same table-slot
  - Fintech: two transfers from the same account exceed balance
```

### Category 2 — Third-party failure

An upstream dependency returns an error; the UI must surface a retriable message without losing user input.

```
1. Trigger a deterministic failure from the third party (e.g. processor decline card, mock 503, throttled API key)
2. Submit the action
3. browser_wait_for("error message visible")
4. browser_snapshot() — confirm the message is specific (not "something went wrong")
5. browser_evaluate(...) — confirm user input is preserved (form values, cart contents, draft state)
6. PASS if: user can retry without re-entering data

Illustrative instantiations:
  - Payment processor: Stripe decline card 4000 0000 0000 0002
  - Email provider: forced SES failure
  - Geocoder: timeout from Google Maps API
  - LLM call: forced 503 from the model provider
```

### Category 3 — Double-submit / race

The user submits the same action twice rapidly; the second submission must be idempotent or rejected with a clear message.

```
1. Pre-condition: form ready to submit
2. browser_click(submit) twice in quick succession (or use browser_evaluate to fire two requests)
3. browser_network_requests — confirm only one server-side mutation took effect
4. browser_snapshot() — confirm UI shows a single result, not duplicates
5. PASS if: server received either 1 effective mutation OR 1 + 1 idempotency-rejected; no duplicate row in DB

Illustrative instantiations:
  - Checkout: rapid double "Pay now"
  - Booking: rapid double "Confirm reservation"
  - Posting: rapid double "Publish"
  - Transfer: rapid double "Send"
```

---

## Output Format

```
SMOKE TEST RESULTS
──────────────────
Dev server: <url> ✓
Angles tested: N

[PASS] <angle-name>: <start> → <end>
  Screenshots: <list>
  End-state assertion: ✓ (<evidence>)
  No JS errors ✓

[FAIL] <angle-name>: <what failed>
  Expected: <expected end-state>
  Actual:   <observed end-state>
  Screenshot: smoke-test-<angle>-fail.png
  File to fix: <path:line> — <hypothesis>

SUMMARY: <N> PASS, <M> FAIL
VERDICT: PASS — safe to merge | FAIL — fix <files> before merge
```

---

## After Running

1. For any FAIL: report exact file:line and expected behavior; route to `/lead` or `/verify` for the fix.
2. For PASS: proceed to `/verify` to finalize acceptance criteria, then `/commit-split` if many files changed.
3. If golden paths were collected interactively, recommend the user add them to `CLAUDE.md` under `## Smoke-test golden paths` so future runs don't re-prompt.
