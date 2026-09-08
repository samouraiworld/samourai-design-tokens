# Shell theme contract

Status: Implementation specification; reference values fixed, contrast acceptance unresolved until all declared pairs pass or receive a separately approved decision.

Provide complete light, dark and black semantic maps for the collaborative shell. Preserve the existing token paths, CSS declarations and static preset keys. The new API is opt-in: `--c-*` custom properties and matching `c-*` Tailwind colors follow `[data-theme]`; the unthemed default is light. Nested theme boundaries must redeclare every role. Theme selection, persistence and system preference belong to the consumer.

The frozen fixture contains the 49 theme roles transcribed from the product reference. The source content SHA-256 is `4470c8bab0d89444a423e6fd9597d27ce71ebe39f507882660abaf0a47539694`. Only token values are reproduced. Semantic tokens reference primitive tokens; color literals never enter the semantic tier. Gradients use [DTCG stop lists](https://www.designtokens.org/tr/second-editors-draft/format/#gradient), retaining the package’s hex-color dialect, with a namespaced `app.samourai.css-gradient` extension for the CSS angle. Generation preserves the exact reference CSS. Gradients belong to background images, never Tailwind colors. Repository-wide format migration remains a separate task. Translucent shadow colors remain colors, not full box shadows.

Required shell geometry: rail 76px, rail item 56px, contextual sidebar 264px, document column maximum 780px and minimum 360px, conversation dock 340px with 24px edge offset. Use named spacing tokens, with semantic and component aliases. Do not treat phone artboard dimensions as responsive breakpoints. Existing font families and typography remain unchanged; the reference's 26px title versus the earlier title rule remains a separate design decision.

Before adding source tokens, register contrast cases for new colors. Running text requires 4.5:1; meaningful non-text indicators require 3:1. Record exact low-contrast reference values without editing existing exceptions, inventing new waivers, lowering thresholds or weakening checks. Decorative borders, shadows and unsupported color combinations receive separate non-normative measurements with explicit purposes in `contrast-pairs.json` under `measurements`. They are reported by the theme contract self-test; they do not become requirements or waivers. Normative rows measure observed text at 4.5:1 and informative icons at 3:1. Low normative ratios remain blocking failures.

Acceptance: `node --test test/theme-contract.selftest.mjs` must prove exact fixture values, identical role sets, complete scoped CSS, dynamic Tailwind bindings, geometry, determinism, dependency-free generation and fail-closed behavior for incomplete maps. Mutation controls remove a theme/role, change a reference value, delete a CSS declaration, freeze a preset color and change geometry. The existing `npm test` gates remain mandatory. A green contract test does not override a red contrast gate and does not establish rendered accessibility.

## Consumer API

Import the generated CSS once. Place `data-theme="light"`, `data-theme="dark"` or `data-theme="black"` on a theme boundary. Use `bg-c-surface`, `text-c-ink`, `text-c-accent-ink` and `bg-c-page-gradient`; `bg-c-page` is the flat page color. The gradient key is deliberately distinct from the color key. Geometry is available as `w-shell-rail-width`, `w-shell-sidebar-width`, `max-w-shell-document-max-width`, `w-shell-dock-width` and direct `--shell-*` custom properties. The consumer must separately specify responsive behavior; a width token is not a breakpoint.

Existing static keys such as `text-ink` do not acquire a new theme automatically. Migrating a component to `c-*` requires auditing all its surfaces, text, statuses and focus indication together. The existing focus tokens retain their earlier contrast decisions; this package does not certify a consumer by changing its theme attribute.

## Unresolved observed combinations

The exact reference values remain in `tokens.json`. These four observed uses fail their applicable normative threshold. Their rows must remain red until a reviewed design or component-use decision resolves them.

| Observed use | Foreground / background | Measured ratio | Required |
|---|---|---|---|
| Dark button hover label | `#F3F7FB` / `#4C6BF0` | 4.178579:1 | 4.5:1 |
| Black button hover label | `#F7FAFC` / `#4C6BF0` | 4.291349:1 | 4.5:1 |
| Light selected-room icon | `#7C8894` / `#E4E9FB` | 2.987678:1 | 3:1 |
| Light connected-room dot | `#2E8B57` / `#2F3A45` | 2.730008:1 | 3:1 |

Source anchors in the hashed reference: buttons at lines 342, 1758 and 2636; room icon at 203 with selected background assigned at 3003; connected-room dot at 294. The ratios use unrounded WCAG luminance comparisons; a displayed rounded value does not turn a failure into a pass.

Possible decisions, **not implemented or approved**: a shared hover fill `#4B64EC` gives the dark label 4.501974:1 and also clears the black label; changing light icon ink to `#7C8794` gives 3.016813:1; changing the light connected dot to `#309357` gives 3.000394:1. These are nearby RGB candidates with very little threshold margin, not a recommendation to target the minimum. Reusing existing `ink-3` for the selected-room icon gives 4.704526:1, and `ok-on-dark` for the connected dot gives 8.095806:1. A design owner must choose the intended visual result and adequate margin before any value or component usage changes.

The unsupported running-text and sole-boundary capability measurements are reported separately. They are not new release requirements, not exemptions and not reasons to redesign decorative elements.
