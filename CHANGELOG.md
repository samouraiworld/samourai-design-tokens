# Changelog

One section per tag, newest first, no dates: the tag and the commit it points at are the record, and `RELEASE.md` says how a tag is cut. `Unreleased` collects what is on `main` (or in an open pull request named here) and not yet tagged.

No tag exists yet. `package.json` reads `0.1.0`, and the first tag will be `v0.1.0`; the README's consumer instructions already pin it, so until it is cut, neither consumer can install from anything but a commit SHA.

## Unreleased

Everything below except the `Added` section is on `main` and untagged, from two merged pull requests: **#9** (`fix/tertiary-text-contrast`), which carried the contrast decisions first opened as #6 (`feat/contrast-decisions`) — #6 was closed unmerged, so #9 is the single commit that landed them — and **#17** (`feat/control-selection-ring-token`). The `Added` section is this pull request, **#14** (`chore/package-private-and-release-procedure`), still open.

### Token values changed — design decisions

These are the first value changes since the design drop. Each one was decided before it landed, and ADR-0002 is where that is on record (see "Governance" below); none of them is a build fix.

Three of the four edit `tokens.json`: the two slate steps and `semantic.border.input`. The fourth does not. The focus ring has no token in v0.1 — its geometry is a constant in `scripts/lib/spec.mjs` (`SPEC.focusRing`), which `scripts/build.mjs` imports and emits as both `--focus-ring` and the Tailwind `ring*` defaults; only the ring's colour comes from `tokens.json`, through `semantic.action.primary`, and that token is not changed. The distinction matters for "Governance" below: ADR-0001's "never edits a value" clause was about `tokens.json`, so it bound the first three directly and did not reach the ring. ADR-0002 closes that gap from both ends — it replaces the clause for token values, and it makes `scripts/lib/spec.mjs` a declared build input whose every composed colour carries a contrast row — so the ring is decided on the same footing as the three token moves without being recorded as a token edit.

- `color.slate.600`: `#66737F` → `#5A6672`. This is `semantic.text.tertiary`, the smallest body colour. It now clears 4.5:1 on every surface it sits on, including `frost.200`, the dark end of the page gradient (was 3.84:1 there).
- `color.slate.700`: `#56626E` → `#4C5763`. This is `semantic.text.secondary`, moved down with tertiary so the two do not converge into one colour.
- `semantic.border.input`: `{color.slate.300}` → `{color.slate.500}`. The boundary of a control the user must find now clears 3:1 on white (3.62:1; slate.300 measured 1.52:1, SC 1.4.11).
- Focus ring: two-tone. An opaque 2 px core in `semantic.action.primary` (6.70:1 on white, 6.01:1 on the page) with the delivered 35 % halo kept at 3 px outside it. `--focus-ring` becomes `0 0 0 2px #2B4BDB, 0 0 0 5px rgba(43, 75, 219, 0.35)`; the Tailwind `ring` defaults become the opaque core (`2px`, `#2B4BDB`). The single-tone halo measured 1.78:1.

Both slate moves are **primitive** moves: a consumer that uses `slate-600` or `slate-700` directly, not only through `text-tertiary` / `text-secondary`, shifts with them.

### Tokens added

- `space.control-selection-ring-width` (`5px`) and `semantic.control.selection-ring-width`, which references it (#17). This names the 5 px ring the selected radio already renders; the rendering itself does not change. The build emits `--control-selection-ring-width`, `--sp-control-selection-ring-width` and the Tailwind `ringWidth["control-selection"]: "5px"` — consumer-visible names the first tag carries. It is the **selected-control** ring, not the keyboard focus indicator: the focus ring's geometry stays in `scripts/lib/spec.mjs` and `ringWidth.DEFAULT` stays `2px` (`docs/specs/control-selection-ring.md`). No colour, contrast pair, threshold or exception moves with it.

### Contrast register

- `contrast-known-failures.json` goes from nine allowed and two exempt rows, all "awaiting the design decision", to four exempt rulings, each with the trigger that reopens it: the two placeholder rows (a placeholder is never real text; every field carries a visible label), `action.onPrimary/slate.300` (the white-on-slate.300 disabled label is retired; the decided rule is `text.tertiary` on the slate.300 fill, a component rule that has no token until the component tier exists), and `border.default/surface.default` (decorative; the card's extent is carried by `shadow.card`).
- Three forbidden rows added to `contrast-pairs.json`, each failing the gate if the pair ever starts passing: `slate.500`, `green.500` and `amber.500` as running text on white.
- The focus ring is measured by **four** rows, each addressing a tone by role rather than naming a token that resembles it. `focus-ring/surface.default` and `focus-ring/surface.page` read `spec:focus-ring.indicator`, the opaque core, at 6.70:1 and 6.01:1 against a 3:1 minimum. `focus-ring-halo/surface.default` and `focus-ring-halo/surface.page` read `spec:focus-ring.outer`, the 35 % halo alone, at 1.78:1 and 1.74:1; both are `expect: "fail"`, so the halo cannot be quietly promoted back to carrying the ring on its own. No row overrides the alpha, and none can: `contrast-pairs.json`'s `$comment` records that "the alpha travels with the colour and no row can opt out", so what the gate measures is what `scripts/lib/spec.mjs` composes.

### Governance

- **The amendment has landed.** ADR-0001, decision 1, said `tokens.json` "is carried verbatim" and that this repository "never edits a value"; its options table rejected editing `tokens.json` to fix failing contrast pairs. [ADR-0002](docs/adr/0002-decided-values-move-and-spec-constants-are-measured.md) merged with #9 and replaces ADR-0001's points 1 and 2: a decided value may move in `tokens.json` when the decision is recorded in the token's `$description` with the ratio it now measures and the contrast gate is green, and the build is a pure function of `tokens.json` **and** `scripts/lib/spec.mjs`, with every colour that file composes measured by a row in `contrast-pairs.json`. ADR-0001 now carries an `Amended by:` line naming ADR-0002; its points 3, 4 and 5 stand unchanged. **No ADR is edited in this pull request.**
- **The signature is on record, and nothing further is asked of the owner here.** ADR-0002 records that the tertiary-text rows, the input border and the focus ring were carried as debt awaiting a decision, and that "The decision was taken and signed by the owner". README, "The source of truth is the design workstream's values", says the same of the primitives: they moved "in one signed pass" (ADR-0002).
- What was decided, and therefore what the first tag carries:

  1. `color.slate.600` / `text.tertiary`: `#66737F` -> `#5A6672`
  2. `color.slate.700` / `text.secondary`: `#56626E` -> `#4C5763`
  3. `semantic.border.input`: `{color.slate.300}` -> `{color.slate.500}`
  4. Focus ring geometry: `0 0 0 3px rgba(43,75,219,.35)` -> `0 0 0 2px #2B4BDB, 0 0 0 5px rgba(43,75,219,.35)`, and with it the preset's `ringWidth.DEFAULT` `3px` -> `2px` and `ringColor.DEFAULT` `rgba(43,75,219,0.35)` -> `#2B4BDB`

  It is one list: recorded here, decided in ADR-0002, and landed by #9. There are not two.
- Still open, and not this pull request's to close. Both records read `Status: Proposed`, in the files and in `docs/adr/README.md`; moving them to `Accepted` is a change to the ADRs and belongs in a pull request that edits them. `AGENTS.md` still repeats ADR-0001's single-input sentence — "The build must stay a pure function of `tokens.json`" — and needs the same amendment; ADR-0002 leaves it untouched on purpose, because a pull request that edits `AGENTS.md` needs a second human reviewer under that file's own rule.

### Added

- `package.json` is `private: true` and no longer carries `publishConfig`: a package consumed by git ref must not be publishable, and `private: true` does not affect git-dependency installs.
- `RELEASE.md`: the tagging procedure.
- This changelog.
