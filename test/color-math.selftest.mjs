// The colour maths the contrast gate rests on, and the focus ring it measures.
//
// `composite()` is the whole difference between the ratio a translucent colour
// reports and the ratio a user sees. It has no output of its own — nothing in
// dist/ changes when it is wrong — so the only thing that can notice a broken
// one is a test that pins the numbers. Every assertion below states the colour
// and the ratio it must produce, so a regression names what moved rather than
// only that something did.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ROOT,
  loadTokens,
  indexTokens,
  resolve,
  parseColor,
  composite,
  contrastRatio,
  toHex,
} from '../scripts/lib/tokens.mjs';
import { SPEC, THEMES, focusRingLayers, focusRingIndicator, focusRingOuter } from '../scripts/lib/spec.mjs';

const index = indexTokens(loadTokens());
const at2 = (n) => Number(n.toFixed(2));
const color = (path) => parseColor(resolve(path, index));

const WHITE = color('semantic.surface.default');
const PAGE = color('semantic.surface.page');
const COBALT = color('semantic.action.primary');

test('a translucent foreground is flattened onto the background before it is measured', () => {
  // The ring COMPONENTS.md delivered: cobalt.500 at 35 %. Read as opaque cobalt
  // it reports 6.70:1; what it paints on white is #B5C0F2 at 1.78:1, and 1.78
  // is the number SC 1.4.11 judges.
  const halo = composite({ ...COBALT, a: 0.35 }, WHITE);
  assert.equal(toHex(halo), '#B5C0F2');
  assert.equal(at2(contrastRatio(halo, WHITE)), 1.78);
  assert.equal(at2(contrastRatio(COBALT, WHITE)), 6.70);

  const onPage = composite({ ...COBALT, a: 0.35 }, PAGE);
  assert.equal(toHex(onPage), '#AAB8EE');
  assert.equal(at2(contrastRatio(onPage, PAGE)), 1.74);
});

test('an opaque foreground passes through unchanged, and a missing alpha is opaque', () => {
  assert.deepEqual(composite({ ...COBALT, a: 1 }, WHITE), { r: 43, g: 75, b: 219, a: 1 });
  // `{r, g, b}` with no `a` is a colour nobody said was translucent. Treating
  // it as transparent would erase every hex token in the suite.
  assert.deepEqual(composite({ r: 43, g: 75, b: 219 }, WHITE), { r: 43, g: 75, b: 219, a: 1 });
});

test('compositing onto a translucent background is an error, not a guess', () => {
  assert.throws(
    () => composite({ ...COBALT, a: 0.35 }, { ...WHITE, a: 0.5 }),
    /cannot composite onto a translucent background/,
  );
});

test('the ring is measured as it is painted: an opaque indicator inside a translucent halo', () => {
  // The light ring, on the two unthemed surfaces a page with no [data-theme]
  // still paints. Light is the default theme and nothing else; it is named
  // here rather than defaulted to, because a ring read for the wrong theme is
  // the defect the themed ring closes.
  const layers = focusRingLayers(index, 'light');
  assert.equal(layers.length, 2, 'the ring is two-tone');
  assert.deepEqual(layers.map((l) => l.width), ['2px', '5px'], 'innermost first');

  const indicator = focusRingIndicator(index, 'light');
  assert.equal(indicator.color.a, 1, 'the tone against the control is opaque; a translucent one is what SC 1.4.11 rejected');
  assert.equal(at2(contrastRatio(composite(indicator.color, WHITE), WHITE)), 8.07);
  assert.equal(at2(contrastRatio(composite(indicator.color, PAGE), PAGE)), 7.23);

  const outer = focusRingOuter(index, 'light');
  assert.equal(at2(contrastRatio(composite(outer.color, WHITE), WHITE)), 1.86);
  assert.equal(at2(contrastRatio(composite(outer.color, PAGE), PAGE)), 1.82);
  assert.ok(
    contrastRatio(composite(outer.color, WHITE), WHITE) < 3,
    'the halo alone stays below 3:1 — if it ever clears it, the opaque core is carrying nothing and the ring needs a decision, not a silent pass',
  );
});

test('each theme paints its own ring, and the two variants are different rings', () => {
  // A single ring value cannot clear 3:1 on every ground this package ships,
  // which is the whole reason the core follows [data-theme]. Two rings that
  // resolve to one colour, or a variant that resolves to the other's, is that
  // single value back with more names on it.
  const cores = THEMES.map((theme) => focusRingIndicator(index, theme).literal);
  assert.equal(new Set(cores).size >= 2, true, 'the themes do not all paint one core');
  for (const theme of THEMES) {
    assert.notEqual(
      focusRingIndicator(index, theme).literal,
      focusRingIndicator(index, theme, 'on-inverse').literal,
      `${theme}: the on-inverse ring must not be the ring for normal grounds`,
    );
  }
});

test('a ring whose layers are not ordered innermost first is rejected rather than measured', () => {
  // The two roles above are "innermost" and "outermost". A list ordered the
  // other way makes both of them lie while every ratio still prints.
  const real = SPEC.focusRing.layers;
  try {
    SPEC.focusRing.layers = [...real].reverse();
    assert.throws(() => focusRingLayers(index, 'light'), /must be listed innermost first/);
    SPEC.focusRing.layers = [];
    assert.throws(() => focusRingLayers(index, 'light'), /declares no layer/);
    SPEC.focusRing.layers = [{ id: 'core', width: '2', alpha: 1 }];
    assert.throws(() => focusRingLayers(index, 'light'), /expected a pixel length/);
    SPEC.focusRing.layers = [{ id: 'core', width: '2px', alpha: 0 }];
    assert.throws(() => focusRingLayers(index, 'light'), /expected a number in \(0, 1\]/);
  } finally {
    SPEC.focusRing.layers = real;
  }
});

test('a ring asked for by an unknown theme or variant is refused, not silently defaulted', () => {
  // The failure mode this replaces: a caller that omitted the theme used to get
  // the one ring there was. A default here would put the light ring back on
  // every dark ground and print a ratio for it.
  assert.throws(() => focusRingLayers(index, 'sepia'), /"sepia" is not a theme; the themes are light, dark, black/);
  assert.throws(() => focusRingLayers(index, undefined), /undefined is not a theme/);
  assert.throws(
    () => focusRingLayers(index, 'light', 'on-nothing'),
    /"on-nothing" is not a ring variant; the variants are default, on-inverse/,
  );
});

// The grounds the ring is claimed to clear, which is what makes the claim a
// check rather than a sentence. The six shell containers and the ten painted
// backgrounds a control can sit on take the ring for normal grounds; the two
// inverse panels take the on-inverse variant, because the normal core is the
// wrong side of that ground.
const NORMAL_GROUNDS = ['surface', 'sunken', 'page', 'hairline', 'muted', 'muted-2'];
const PAINTED_GROUNDS = ['accent-soft', 'ok-soft', 'warn-soft', 'bad-soft', 't1-bg', 't2-bg', 't3-bg', 't4-bg', 't5-bg', 't6-bg'];
const INVERSE_GROUNDS = ['inverse', 'inverse-2'];

function assertRingCoverage(pairs) {
  // The regression this file exists for: rows pointed at `semantic.action.primary`
  // print one ratio for any geometry, including the single 35 % halo that
  // measures 1.86:1 on white. Addressing the ring by role is what ties the row
  // to what ships, and carrying the theme in the role is what ties it to the
  // ring that theme actually paints.
  const ring = pairs.filter((p) => String(p.fg).startsWith('spec:focus-ring'));

  for (const pair of ring) {
    assert.match(
      pair.fg,
      /^spec:focus-ring(-on-inverse)?\.(light|dark|black)\.(indicator|outer)$/,
      `${pair.id} must name a ring role, and name the theme in it`,
    );
    if (pair.fg.endsWith('.indicator')) {
      assert.equal(pair.min, 3.0, `${pair.id} is the indicator and is gated at 3:1`);
      assert.equal(pair.expect, undefined, `${pair.id} must be gated, not inverted`);
    } else {
      assert.equal(pair.expect, 'fail', `${pair.id} pins the halo as never the indicator`);
    }
  }

  const grounds = (fg) => new Set(ring.filter((p) => p.fg === fg).map((p) => p.bg));
  for (const theme of THEMES) {
    const normal = grounds(`spec:focus-ring.${theme}.indicator`);
    for (const ground of [...NORMAL_GROUNDS, ...PAINTED_GROUNDS]) {
      assert.ok(normal.has(`semantic.theme.${theme}.${ground}`), `${theme}: the ring is claimed to clear ${ground} and no row measures it`);
    }
    const inverse = grounds(`spec:focus-ring-on-inverse.${theme}.indicator`);
    for (const ground of INVERSE_GROUNDS) {
      assert.ok(inverse.has(`semantic.theme.${theme}.${ground}`), `${theme}: the on-inverse ring is claimed to clear ${ground} and no row measures it`);
    }
  }
}

test('every ground the themed ring is claimed to clear carries a normative row', () => {
  const { pairs } = JSON.parse(readFileSync(join(ROOT, 'contrast-pairs.json'), 'utf8'));
  assertRingCoverage(pairs);

  // A ground quietly dropped is the claim quietly narrowed.
  assert.throws(
    () => assertRingCoverage(pairs.filter((p) => p.id !== 'theme.dark/focus-ring/muted-2')),
    /dark: the ring is claimed to clear muted-2 and no row measures it/,
  );
  assert.throws(
    () => assertRingCoverage(pairs.filter((p) => p.id !== 'theme.black/focus-ring-on-inverse/inverse-2')),
    /black: the on-inverse ring is claimed to clear inverse-2 and no row measures it/,
  );
  // A role with no theme in it measures whichever ring the spec hands back.
  const untethered = structuredClone(pairs);
  untethered.find((p) => p.id === 'theme.dark/focus-ring/surface').fg = 'spec:focus-ring.indicator';
  assert.throws(() => assertRingCoverage(untethered), /must name a ring role, and name the theme in it/);
  const loosened = structuredClone(pairs);
  loosened.find((p) => p.id === 'theme.black/focus-ring-on-inverse/inverse').min = 1.5;
  assert.throws(() => assertRingCoverage(loosened), /is the indicator and is gated at 3:1/);
  const promoted = structuredClone(pairs);
  delete promoted.find((p) => p.id === 'focus-ring-halo/surface.default').expect;
  assert.throws(() => assertRingCoverage(promoted), /pins the halo as never the indicator/);
});
