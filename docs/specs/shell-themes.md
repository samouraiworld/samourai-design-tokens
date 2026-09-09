# Shell theme contract

Status: Implementation specification; reference values fixed, and the four observed low-contrast uses resolved by three approved decisions recorded below. Every declared normative pair clears its minimum without a waiver.

Provide complete light, dark and black semantic maps for the collaborative shell. Preserve the existing token paths, CSS declarations and static preset keys. The new API is opt-in: `--c-*` custom properties and matching `c-*` Tailwind colors follow `[data-theme]`; the unthemed default is light. Nested theme boundaries must redeclare every role. Theme selection, persistence and system preference belong to the consumer.

The frozen fixture contains the 49 theme roles transcribed from the product reference, with the two decided hover values recorded under "Decided observed combinations"; those two roles are the only places where the fixture and the hashed reference differ. The source content SHA-256 is `4470c8bab0d89444a423e6fd9597d27ce71ebe39f507882660abaf0a47539694`. Only token values are reproduced. Semantic tokens reference primitive tokens; color literals never enter the semantic tier. Gradients use [DTCG stop lists](https://www.designtokens.org/tr/second-editors-draft/format/#gradient), retaining the package’s hex-color dialect, with a namespaced `app.samourai.css-gradient` extension for the CSS angle. Generation preserves the exact reference CSS. Gradients belong to background images, never Tailwind colors. Repository-wide format migration remains a separate task. Translucent shadow colors remain colors, not full box shadows.

Required shell geometry: rail 76px, rail item 56px, contextual sidebar 264px, document column maximum 780px and minimum 360px, conversation dock 340px with 24px edge offset. Use named spacing tokens, with semantic and component aliases. Do not treat phone artboard dimensions as responsive breakpoints. Existing font families and typography remain unchanged; the reference's 26px title versus the earlier title rule remains a separate design decision.

Before adding source tokens, register contrast cases for new colors. Running text requires 4.5:1; meaningful non-text indicators require 3:1. Record exact low-contrast reference values without editing existing exceptions, inventing new waivers, lowering thresholds or weakening checks. Decorative borders, shadows and unsupported color combinations receive separate non-normative measurements with explicit purposes in `contrast-pairs.json` under `measurements`. They are reported by the theme contract self-test; they do not become requirements or waivers. Normative rows measure observed text at 4.5:1 and informative icons at 3:1. Low normative ratios remain blocking failures.

Acceptance: `node --test test/theme-contract.selftest.mjs` must prove exact fixture values, identical role sets, complete scoped CSS, dynamic Tailwind bindings, geometry, determinism, dependency-free generation and fail-closed behavior for incomplete maps. Mutation controls remove a theme/role, change a reference value, delete a CSS declaration, freeze a preset color and change geometry. The existing `npm test` gates remain mandatory. A green contract test does not override a red contrast gate and does not establish rendered accessibility.

## Consumer API

Import the generated CSS once. Place `data-theme="light"`, `data-theme="dark"` or `data-theme="black"` on a theme boundary. Use `bg-c-surface`, `text-c-ink`, `text-c-accent-ink` and `bg-c-page-gradient`; `bg-c-page` is the flat page color. The gradient key is deliberately distinct from the color key. Geometry is available as `w-shell-rail-width`, `w-shell-sidebar-width`, `max-w-shell-document-max-width`, `w-shell-dock-width` and direct `--shell-*` custom properties. The consumer must separately specify responsive behavior; a width token is not a breakpoint.

Two usages are decided, not free: the selected room row draws its icon in `c-ink-3` (unselected rows keep `c-ink-4`), and the connected-room indicator on the inverse panel uses `c-ok-on-dark`, not `c-ok`. The register measures those usages; a consumer that renders the reference roles instead re-creates a failure the gate no longer sees.

Existing static keys such as `text-ink` do not acquire a new theme automatically. Migrating a component to `c-*` requires auditing all its surfaces, text, statuses and focus indication together. The existing focus tokens retain their earlier contrast decisions; this package does not certify a consumer by changing its theme attribute.

## Decided observed combinations

The hashed reference carried four observed uses below their normative threshold. The design owner resolved them with three decisions that reuse colours already in the palette; no waiver was added, no row was exempted and no threshold moved. `tokens.json` and the fixture carry the decided values; the reference hash above is unchanged.

| Observed use | Decision | Foreground / background | Before | After | Required |
|---|---|---|---|---|---|
| Dark button hover label | `action-hover` maps to the shared `cobalt.500` | `#F3F7FB` / `#4C6BF0` → `#F3F7FB` / `#2B4BDB` | 4.178579:1 | 6.228601:1 | 4.5:1 |
| Black button hover label | the same shared mapping | `#F7FAFC` / `#4C6BF0` → `#F7FAFC` / `#2B4BDB` | 4.291349:1 | 6.396695:1 | 4.5:1 |
| Light selected-room icon | the selected row's icon uses `ink-3` | `#7C8894` / `#E4E9FB` → `#5C6874` / `#E4E9FB` | 2.987678:1 | 4.704526:1 | 3:1 |
| Light connected-room dot | the indicator on the inverse panel uses `ok-on-dark` | `#2E8B57` / `#2F3A45` → `#A8E5C4` / `#2F3A45` | 2.730008:1 | 8.095806:1 | 3:1 |

Decision 1 is a value change. `semantic.theme.dark.action-hover` and `semantic.theme.black.action-hover` reference `color.cobalt.500`, and the rejected `color.theme-dark.action-hover` and `color.theme-black.action-hover` primitives are removed so the value leaves the source rather than surviving as an unused variable. The idle fill stays `action` (`#3B57DE`); hover now darkens instead of lightening. The light theme is unchanged.

Decisions 2 and 3 are usage changes, not value changes: `ink-4`, `ok`, `ink-3` and `ok-on-dark` keep their reference values. The register rows for the two observed uses measure the decided roles, `theme.light/icon-ink-3/accent-soft` and `theme.light/indicator-ok-on-dark/inverse`, and the rows for the retired uses (`ink-4` on `accent-soft` and `ok` on `inverse`, light theme) went with the uses; their measured ratios are the "Before" column above. Unselected room rows keep `ink-4` on `surface`, `sunken` and `muted`, which stay measured at 3:1. The dark and black connected-room rows keep `ok` on `inverse`, which clears 3:1 in both; a consumer that uses `c-ok-on-dark` for the indicator in every theme is covered by the existing 4.5:1 `ok-on-dark` text rows.

Source anchors in the hashed reference: buttons at lines 342, 1758 and 2636; room icon at 203 with selected background assigned at 3003; connected-room dot at 294. The ratios use unrounded WCAG luminance comparisons; a displayed rounded value does not turn a failure into a pass.

The unsupported running-text and sole-boundary capability measurements are reported separately. They are not new release requirements, not exemptions and not reasons to redesign decorative elements.
