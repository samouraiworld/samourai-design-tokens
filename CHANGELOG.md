# Changelog

One section per tag, newest first, no dates: the tag and the commit it points at are the record, and `RELEASE.md` says how a tag is cut. `Unreleased` collects what is on `main` (or in an open pull request named here) and not yet tagged.

No tag exists yet. `package.json` reads `0.1.0`, and the first tag will be `v0.1.0`; the README's consumer instructions already pin it, so until it is cut, neither consumer can install from anything but a commit SHA.

## Unreleased

Everything below comes from the pull request on `feat/complete-shell-theme-tokens`. What reached `main` before this branch merged it — the selected-control ring token and the ADR-0002 palette move — is recorded in `docs/specs/control-selection-ring.md` and `docs/adr/0002-decided-values-move-and-spec-constants-are-measured.md`, and is not repeated here.

### Added

- Complete shell themes: light, dark and black semantic maps under `semantic.theme.*`, emitted as `--c-*` custom properties that follow `[data-theme]` (the unthemed default is light) and as matching `c-*` Tailwind colours, plus `bg-c-page-gradient` for the themed page gradient. Existing token paths, CSS declarations and static preset keys are preserved; the new API is opt-in. Spec: `docs/specs/shell-themes.md`.
- Shell geometry tokens (`--shell-*`, `w-shell-*`): rail 76px, rail item 56px, sidebar 264px, document column 780px maximum and 360px minimum, dock 340px with a 24px edge offset. A width token is not a breakpoint.
- Theme gradients as DTCG stop lists with a namespaced `app.samourai.css-gradient` angle extension; generation reproduces the reference CSS exactly, and a gradient is never a Tailwind colour.
- `test/theme-contract.selftest.mjs` joins the units gate: exact fixture values, identical role sets, complete scoped CSS, dynamic preset bindings, geometry, determinism, and fail-closed behaviour for an incomplete map, each proven by a mutation.
- This changelog.

### Token values changed — design decisions

- `semantic.theme.dark.action-hover` and `semantic.theme.black.action-hover`: `#4C6BF0` → `{color.cobalt.500}` (`#2B4BDB`). The dark and black button hover fill is the shared cobalt. The reference value put the hover label at 4.18:1 (dark) and 4.29:1 (black) under `on-inverse`, below 4.5:1; the decided fill measures 6.23:1 and 6.40:1. The two rejected theme primitives are removed rather than left as unused variables. Light is unchanged; hover now darkens from `action` instead of lightening.

### Contrast register

- Two light-theme usages are decided rather than re-coloured: the selected room row's icon uses `ink-3` on `accent-soft` (4.70:1; `ink-4` measured 2.99:1 against 3:1), and the connected-room indicator uses `ok-on-dark` on `inverse` (8.10:1; `ok` measured 2.73:1 against 3:1). No token value moved. The two rows measure the decided usages: `theme.light/icon-ink-3/accent-soft` and `theme.light/indicator-ok-on-dark/inverse`.
- Every theme role is covered by a normative pair or an explicitly non-normative measurement (decorative or capability, each with a purpose). No theme row is exempt, inverted or listed in `contrast-known-failures.json`.
