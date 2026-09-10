# Control selection ring width

Status: Implementation specification; preserves the existing control rendering.

Expose the existing 5px selected-radio ring through a named token. The consumer uses `ring-control-selection` together with its existing state and color classes. This is the selected state indicator, not the keyboard focus indicator; the existing focus ring remains unchanged.

`space.control-selection-ring-width` holds the primitive 5px dimension. `semantic.control.selection-ring-width` references it. Generate `--control-selection-ring-width: 5px` and the Tailwind `ringWidth.control-selection` value `5px`. This dimension must not appear in the preset color map. No colors, contrast pairs, thresholds, exceptions or dependencies change.

Acceptance: `node --test test/control-selection-ring.selftest.mjs` checks the token alias, CSS, exact preset width, absence from colors and preserved 3px default focus ring width. Its mutation controls replace the value with 4px and remove the named ring, proving the check rejects either regression. The existing `npm test` gates remain mandatory.
