## What and why

<!-- What changes, and what problem it solves. If this is a token value change, say who decided it. -->

## Verification

<!--
Not "I ran the tests" — what did you run, and what would have failed if the
change were wrong? Almost everything in this repository fails SILENTLY when it
is wrong: a missing token emits no CSS and no error, an unreadable pair renders
perfectly, a stale `dist/` installs without complaint. A check that cannot fail
is worse than no check.
-->

- [ ] `npm test` — all four gates green
- [ ] `npm run build` was run and `dist/` is committed *(if `tokens.json` changed)*

## Which pair ratios changed?

<!--
Paste the rows of `npm run check:contrast` whose ratio moved, before → after.
"None" is a valid answer and is the expected one for a docs or tooling change.
A colour change with no ratio movement means the pair table does not cover
what you changed — add the row rather than deleting the question.
-->

| Pair | Before | After | Min | Verdict |
|---|---|---|---|---|
|  |  |  |  |  |

## Silent-failure check

Tick anything this PR touches, and say how you proved it actually works:

- [ ] A **token value** — every pair it appears in still clears its minimum, or the new failure is in `contrast-known-failures.json` with a reason and a named decision.
- [ ] A **token name** — this is a MAJOR (DESIGN_HANDOFF F5). Both consumers were checked, and the old name still resolves for one minor.
- [ ] A **generated variable name** — the design drop's prototypes address these by name; the browser drops an unknown `var()` without erroring. The parity test covers it, and it was run.
- [ ] **`dist/`** — generated, never hand-edited. The drift gate proves it.
- [ ] A **contrast pair or allowlist entry** — removing a row silently un-guards a colour. Said which colour is now unguarded and why that is acceptable.
- [ ] A **check itself** — showed it can still FAIL, not only pass. A fixture, a temporary break, something.
- [ ] Nothing above.

## Secrets

- [ ] No secret, credential or IP address in any tracked file.

## Risk

<!-- What breaks in the hub and in the console if this is wrong, and how would you roll it back? -->
