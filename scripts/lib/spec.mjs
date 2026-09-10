// The values the design system fixes that tokens.json v0.1 does not carry as
// tokens, and the derivations that turn them into colours.
//
// They live here rather than inside scripts/build.mjs because two things read
// them: the build, which emits them, and the contrast gate, which measures
// them. A geometry the build owns privately is a geometry the gate cannot
// check — and a focus ring the gate cannot check is how a 1.78:1 halo ships
// under a label describing a ring that is not there. ADR-0002 records that,
// and the rule it sets: every colour composed from a constant here is measured
// by a row in contrast-pairs.json, through the `spec:` references below.
//
// Each constant is still anchored to tokens.json — the colours are token
// paths, never hexes — so a palette change flows through and a token rename
// fails the build and the gate rather than the browser.

import { resolve, parseColor } from './tokens.mjs';

export const SPEC = {
  // DESIGN_SYSTEM.md §2: "frost gradient 115deg #DCE6F0 → #EEF3F8 (45%) → #FFFFFF".
  pageGradient: {
    angle: '115deg',
    stops: [['color.frost.200', '0%'], ['color.frost.100', '45%'], ['color.white', '100%']],
  },

  // COMPONENTS.md delivered the ring as "0 0 0 3px rgba(43,75,219,.35) on
  // every interactive element". That halo alone composites to #B5C0F2 on white
  // and measures 1.78:1, which does not satisfy SC 1.4.11 for the one indicator
  // a keyboard user has to locate themselves with. The ring is two-tone: an
  // opaque core in the action colour, with the delivered halo kept at its 3 px
  // width, pushed outside the core.
  //
  // `layers` is the ring as painted, INNERMOST FIRST — the order box-shadow
  // takes, where the first layer paints on top of the ones after it. The first
  // layer is therefore the tone that sits against the control, which is the
  // tone SC 2.4.13 measures against the unfocused surface; the last is the tone
  // that touches the background. contrast-pairs.json addresses both by role, so
  // changing this list changes what the gate measures.
  focusRing: {
    source: 'semantic.action.primary',
    layers: [
      { id: 'core', width: '2px', alpha: 1 },
      { id: 'halo', width: '5px', alpha: 0.35 },
    ],
  },
};

/** `'5px'` → `5`. A width that is not a plain pixel length is a spec error. */
function px(width, id) {
  if (typeof width !== 'string' || !/^\d+(\.\d+)?px$/.test(width)) {
    throw new Error(`focus ring layer "${id}" has width ${JSON.stringify(width)}; expected a pixel length such as "3px"`);
  }
  return Number.parseFloat(width);
}

/**
 * The focus ring as painted: one entry per tone, innermost first, each carrying
 * the colour it paints with — alpha included, so the gate composites what the
 * user sees rather than the opaque token behind it.
 *
 * The ordering is validated rather than assumed: the roles below are "innermost"
 * and "outermost", and a list that is not ordered by width makes both of them
 * lie. An unchecked assumption in a check is the check's weakest part.
 */
export function focusRingLayers(index) {
  const { source, layers } = SPEC.focusRing;
  if (!Array.isArray(layers) || layers.length === 0) {
    throw new Error('the focus ring declares no layer, so there is no indicator to measure');
  }

  const literal = resolve(source, index);
  const base = parseColor(literal);

  let previous = 0;
  return layers.map((layer) => {
    const width = px(layer.width, layer.id);
    if (width <= previous) {
      throw new Error(
        `focus ring layers must be listed innermost first and grow outwards; "${layer.id}" is ${layer.width} after ${previous}px`,
      );
    }
    previous = width;
    if (!(layer.alpha > 0) || layer.alpha > 1) {
      throw new Error(`focus ring layer "${layer.id}" has alpha ${layer.alpha}; expected a number in (0, 1]`);
    }
    return { ...layer, source, literal, color: { ...base, a: layer.alpha } };
  });
}

/** The tone painted against the control — what a keyboard user has to locate. */
export function focusRingIndicator(index) {
  return focusRingLayers(index)[0];
}

/** The outermost tone, the one painted straight onto the background. */
export function focusRingOuter(index) {
  return focusRingLayers(index).at(-1);
}

/**
 * The colours contrast-pairs.json can name with a `spec:` reference. They are
 * roles, not layer names: a row asks for "the ring's indicator" and gets
 * whatever the spec above currently makes the indicator, at its real alpha.
 * Naming a layer instead would let a geometry change quietly leave the row
 * measuring a tone the ring no longer has.
 */
export const SPEC_COLORS = {
  'spec:focus-ring.indicator': (index) => focusRingIndicator(index).color,
  'spec:focus-ring.outer': (index) => focusRingOuter(index).color,
};
