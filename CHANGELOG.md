# Changelog

One section per tag, newest first, no dates: the tag and the commit it points at are the record, and `RELEASE.md` says how a tag is cut. `Unreleased` collects what is on `main` (or in an open pull request named here) and not yet tagged.

No tag exists yet. `package.json` reads `0.1.0`, and the first tag will be `v0.1.0`; the README's consumer instructions already pin it, so until it is cut, neither consumer can install from anything but a commit SHA.

## Unreleased

Everything below comes from pull requests #6 (`feat/contrast-decisions`) and #9 (`fix/tertiary-text-contrast`); #9 contains #6, so merging #9 lands both.

### Token values changed — design decisions

These are the first edits to `tokens.json` since the design drop. Each one needs the decider named on record (see "Governance" below); none of them is a build fix.

- `color.slate.600`: `#66737F` → `#5A6672`. This is `semantic.text.tertiary`, the smallest body colour. It now clears 4.5:1 on every surface it sits on, including `frost.200`, the dark end of the page gradient (was 3.84:1 there).
- `color.slate.700`: `#56626E` → `#4C5763`. This is `semantic.text.secondary`, moved down with tertiary so the two do not converge into one colour.
- `semantic.border.input`: `{color.slate.300}` → `{color.slate.500}`. The boundary of a control the user must find now clears 3:1 on white (3.62:1; slate.300 measured 1.52:1, SC 1.4.11).
- Focus ring: two-tone. An opaque 2 px core in `semantic.action.primary` (6.70:1 on white, 6.01:1 on the page) with the delivered 35 % halo kept at 3 px outside it. `--focus-ring` becomes `0 0 0 2px #2B4BDB, 0 0 0 5px rgba(43, 75, 219, 0.35)`; the Tailwind `ring` defaults become the opaque core (`2px`, `#2B4BDB`). The single-tone halo measured 1.78:1.

Both slate moves are **primitive** moves: a consumer that uses `slate-600` or `slate-700` directly, not only through `text-tertiary` / `text-secondary`, shifts with them.

### Contrast register

- `contrast-known-failures.json` goes from nine allowed and two exempt rows, all "awaiting the design decision", to four exempt rulings, each with the trigger that reopens it: the two placeholder rows (a placeholder is never real text; every field carries a visible label), `action.onPrimary/slate.300` (the white-on-slate.300 disabled label is retired; the decided rule is `text.tertiary` on the slate.300 fill, a component rule that has no token until the component tier exists), and `border.default/surface.default` (decorative; the card's extent is carried by `shadow.card`).
- Three forbidden rows added to `contrast-pairs.json`, each failing the gate if the pair ever starts passing: `slate.500`, `green.500` and `amber.500` as running text on white.
- The two focus-ring rows measure the opaque core, so they drop `fgAlpha`.

### Governance

- ADR-0001, decision 1, says `tokens.json` "is carried verbatim" and that this repository "never edits a value"; its options table rejects editing `tokens.json` to fix failing contrast pairs. The changes above amend that clause: a value change is a design decision that arrives here as a pull request with the decider named. **The ADR is not edited in this pull request.** The amendment, and the ADR's move from `Proposed` to `Accepted`, need the owner's line saying who decided the three value moves; README, "The source of truth is the design workstream's values", follows the ADR once it is amended.

### Added

- `package.json` is `private: true` and no longer carries `publishConfig`: a package consumed by git ref must not be publishable, and `private: true` does not affect git-dependency installs.
- `RELEASE.md`: the tagging procedure.
- This changelog.
