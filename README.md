# samourai-design-tokens

`@samourai/design-tokens` — the design tokens of samourai.app, published as one package and consumed by both front-ends: `samourai-hub` (the marketing site) and `samourai-console` (the authenticated application).

Established by **ADR-0004** in the console repository: the tokens are a shared package, not a file copied into two repositories. Copies drift silently, and nothing errors when they disagree.

```
tokens.json                    W3C DTCG source of truth, delivered by the design workstream
dist/tokens.css                generated CSS custom properties
dist/tailwind.preset.js        generated Tailwind preset (ESM)
dist/tokens.d.ts               generated types
contrast-pairs.json            the accessibility contract, as data
contrast-known-failures.json   the explicit allowlist, one written reason per entry
token-grammar-exceptions.json  naming-grammar deviations, one written reason per entry
scripts/build.mjs              tokens.json → dist/
scripts/check-grammar.mjs      DTCG validity and the naming grammar
scripts/check-contrast.mjs     WCAG 2.1 ratios over contrast-pairs.json
test/token-test.mjs            the reusable token-resolution guard for consumers
```

Everything runs on plain Node 22 with **no dependencies and no install step**. That is not minimalism for its own sake: consumers install this package from a git tag, and npm does not run an install or a build for a git dependency. A `dist/` that needed `npm install` to exist would install as an empty package, with no error at all — which is exactly the class of failure this repository is built to make loud.

## Commands

```sh
npm run build           # regenerate dist/ from tokens.json
npm test                # the four gates, all of them, even after one fails
npm run check:grammar   # DTCG validity + naming grammar + tier counts
npm run check:contrast  # the contrast table and the gate
npm run check:drift     # dist/ equals a fresh build
```

## The three sync tests

ADR-0004 names three tests, each guarding one failure that is otherwise completely silent.

| Test | Runs here | Fails when |
|---|---|---|
| **Token resolution** | exported from here, **runs in each consumer** | A Tailwind class names one of our colour families and the token does not exist. Tailwind emits no CSS and no error; for `border-*` the element falls back to preflight's `border: 0 solid #e5e7eb`. |
| **Contrast** | here, on every PR | A declared pair falls below its WCAG minimum and is not in the allowlist with a reason. Translucent colours are composited before measuring; an unresolvable pair is a hard failure, never a skipped row. |
| **Version drift** | each consumer's CI | The consumer's pinned version is more than one minor behind the tag published here. Without it a repository sits on an old palette indefinitely and nothing complains. |

A fourth gate is local to this repository: **drift**, which asserts `dist/` is byte-identical to a fresh build. `dist/` is committed so consumers can install from git, and a committed build output is a copy — the same failure mode ADR-0004 rejects — unless something proves it is still generated.

## How CI is wired

Four jobs, in `.github/workflows/ci.yml`. Three do work: **Grammar, contrast, drift, units** runs `npm test`, **Secret scan** runs gitleaks over the whole history, **Workflow lint** runs actionlint over these workflows. The fourth, **`ci-ok`**, does no work of its own — it needs the other three and fails unless every one of them concluded `success` or a deliberate `skipped`. The gitleaks and actionlint archives are verified by SHA-256 before extraction, against the `GITLEAKS_SHA256` / `ACTIONLINT_SHA256` env values recorded next to each pinned version in the workflow.

`ci-ok` is the single check branch protection points at. Requiring the three working jobs by name instead would keep the gate list in repository settings, where it drifts out of step with the workflow: a renamed job leaves the old context required forever, blocking every PR on a check nothing will ever report, while the job that replaced it is required by nothing. Adding, renaming or splitting a gate is therefore a change to `ci.yml` alone.

It runs `.github/scripts/aggregate-result.selftest.sh` before it decides anything. A required check nobody has ever seen fail is a decoration, and this one is the last thing standing between a red gate and a green merge button.

## How the hub and the console consume it

Until GitHub Packages is set up for the organisation, both repositories take a **git dependency pinned to a tag**. A branch or a bare repository URL is not pinned: it re-resolves on every fresh install, and the palette changes underneath the consumer between two CI runs of the same commit.

```jsonc
// package.json in samourai-hub and samourai-console
{
  "dependencies": {
    "@samourai/design-tokens": "github:samouraiworld/samourai-design-tokens#v0.1.0"
  }
}
```

Tailwind:

```js
// tailwind.config.ts
import samourai from '@samourai/design-tokens/tailwind-preset';

export default {
  presets: [samourai],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Declare nothing else. Re-declaring a colour here is how the two
  // front-ends start to disagree.
};
```

Anything outside Tailwind — the Visio theme, a raw stylesheet, an email template — reads the CSS instead:

```js
import '@samourai/design-tokens/tokens.css';
```

And each consumer runs the resolution guard as one of its own unit tests:

```js
import preset from '@samourai/design-tokens/tailwind-preset';
import { assertClassesResolve, sourceFiles } from '@samourai/design-tokens/token-test';

it('every colour class resolves to a real token', () => {
  assertClassesResolve({ files: sourceFiles('src'), preset, minFiles: 5 });
});
```

The guard throws when a class names one of our families and resolves to nothing. It also throws when it scanned no files or matched no classes, because a guard that silently judges nothing is worse than no guard.

### The version-drift rule for consumers

A consumer pinned more than **one minor** behind the newest tag here fails its own CI. One minor of slack is the review window for a token change; two is a repository nobody is updating. The rule lives in each consumer because that is where the stale pin is, and it is a CI check rather than a convention because a convention about a version number is a convention nobody enforces.

Versioning follows ADR-0004 and DESIGN_HANDOFF F5: renaming or removing a token is a **major**; a deprecation keeps the old name resolving for one minor.

## The source of truth is the design workstream's values

`tokens.json` is carried **verbatim** from the design drop, byte for byte. This repository generates from it and measures it; it does not edit it. A change to a token value is a design decision and arrives as a PR here, with the contrast gate green or an allowlist entry carrying a reason. It is never a build fix.

`dist/` is generated. Editing it by hand is undone by the next build and caught by the drift gate.

## What v0.1 is not

- **Light only.** The dark mode ADR-0004 and DESIGN_HANDOFF A4 call for was not part of this delivery. Every semantic token has one value. The hub is dark today and cannot adopt the semantic tier until the dark set lands; it can adopt the primitive tier and the preset now.
- **No component tier.** The `component` group is reserved by the grammar checker and is empty. The first component token (`button.primary.fill.hover`) arrives with the console's `src/ui/` primitives.
- **No z-index ladder, no breakpoints.** DESIGN_HANDOFF A12 and A13 are owed. The preset therefore overrides neither, and Tailwind's defaults apply.
- **Nine contrast pairs fail and two are exempt**, all recorded in `contrast-known-failures.json` with the decision each one is waiting on. The gate is green because the failures are written down, not because they are fixed. The tertiary ink and the focus ring are the two that matter: a 1.78:1 focus indicator is the only thing a keyboard user has to locate themselves with.

## Adding a token

1. Edit `tokens.json`.
2. Add a row to `contrast-pairs.json` for every surface the token can sit on or behind. A colour with no row is unguarded, and DESIGN_SYSTEM.md forbids one.
3. `npm run build` and commit `dist/`.
4. `npm test`. If a pair fails, the fix is the value — not an allowlist entry, unless the design workstream decided otherwise and the reason says so.
