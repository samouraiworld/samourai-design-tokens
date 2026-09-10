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
import { SPEC, focusRingLayers, focusRingIndicator, focusRingOuter } from '../scripts/lib/spec.mjs';

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
  const layers = focusRingLayers(index);
  assert.equal(layers.length, 2, 'the ring is two-tone');
  assert.deepEqual(layers.map((l) => l.width), ['2px', '5px'], 'innermost first');

  const indicator = focusRingIndicator(index);
  assert.equal(indicator.color.a, 1, 'the tone against the control is opaque; a translucent one is what SC 1.4.11 rejected');
  assert.equal(at2(contrastRatio(composite(indicator.color, WHITE), WHITE)), 6.70);
  assert.equal(at2(contrastRatio(composite(indicator.color, PAGE), PAGE)), 6.01);

  const outer = focusRingOuter(index);
  assert.equal(at2(contrastRatio(composite(outer.color, WHITE), WHITE)), 1.78);
  assert.equal(at2(contrastRatio(composite(outer.color, PAGE), PAGE)), 1.74);
  assert.ok(
    contrastRatio(composite(outer.color, WHITE), WHITE) < 3,
    'the halo alone stays below 3:1 — if it ever clears it, the opaque core is carrying nothing and the ring needs a decision, not a silent pass',
  );
});

test('a ring whose layers are not ordered innermost first is rejected rather than measured', () => {
  // The two roles above are "innermost" and "outermost". A list ordered the
  // other way makes both of them lie while every ratio still prints.
  const real = SPEC.focusRing.layers;
  try {
    SPEC.focusRing.layers = [...real].reverse();
    assert.throws(() => focusRingLayers(index), /must be listed innermost first/);
    SPEC.focusRing.layers = [];
    assert.throws(() => focusRingLayers(index), /declares no layer/);
    SPEC.focusRing.layers = [{ id: 'core', width: '2', alpha: 1 }];
    assert.throws(() => focusRingLayers(index), /expected a pixel length/);
    SPEC.focusRing.layers = [{ id: 'core', width: '2px', alpha: 0 }];
    assert.throws(() => focusRingLayers(index), /expected a number in \(0, 1\]/);
  } finally {
    SPEC.focusRing.layers = real;
  }
});

test('the focus-ring rows address the ring by role, so a geometry change moves them', () => {
  // The regression this file exists for: rows pointed at `semantic.action.primary`
  // print 6.70:1 for any geometry, including the single 35 % halo that measures
  // 1.78:1. Addressing the ring by role is what ties the row to what ships.
  const { pairs } = JSON.parse(readFileSync(join(ROOT, 'contrast-pairs.json'), 'utf8'));
  const ring = pairs.filter((p) => p.id.startsWith('focus-ring'));
  assert.equal(ring.length, 4, 'both tones, on both surfaces');

  for (const pair of ring) {
    assert.match(pair.fg, /^spec:focus-ring\.(indicator|outer)$/, `${pair.id} must name a ring role`);
  }
  for (const pair of ring.filter((p) => p.fg === 'spec:focus-ring.indicator')) {
    assert.equal(pair.min, 3.0, `${pair.id} is the indicator and is gated at 3:1`);
    assert.equal(pair.expect, undefined, `${pair.id} must be gated, not inverted`);
  }
  for (const pair of ring.filter((p) => p.fg === 'spec:focus-ring.outer')) {
    assert.equal(pair.expect, 'fail', `${pair.id} pins the halo as never the indicator`);
  }
});
