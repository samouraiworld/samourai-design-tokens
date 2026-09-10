import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadTokens, indexTokens, resolve } from '../scripts/lib/tokens.mjs';
import preset from '../dist/tailwind.preset.js';

function assertSelectionRing(tree, css, config) {
  const index = indexTokens(tree);
  assert.equal(resolve('semantic.control.selection-ring-width', index), '5px', 'preserve 5px selection ring');
  assert.equal(tree.semantic.control['selection-ring-width'].$value, '{space.control-selection-ring-width}');
  assert.match(css, /--control-selection-ring-width: 5px;/);
  assert.equal(config.theme.extend.ringWidth['control-selection'], '5px', 'named selection ring');
  assert.equal(config.theme.extend.ringWidth.DEFAULT, '3px', 'focus ring width remains unchanged');
  assert.equal(config.theme.extend.colors['control-selection-ring-width'], undefined, 'a dimension is not a color');
}
const tree = loadTokens();
const css = readFileSync(join(ROOT, 'dist/tokens.css'), 'utf8');

test('the selected control ring preserves its existing width through the token API', () => assertSelectionRing(tree, css, preset));

test('the contract rejects changed or missing selection ring values', () => {
  assertSelectionRing(tree, css, preset);
  const changed = structuredClone(tree);
  changed.space['control-selection-ring-width'].$value = '4px';
  assert.throws(() => assertSelectionRing(changed, css, preset), /preserve 5px selection ring/);
  const missing = structuredClone(preset);
  delete missing.theme.extend.ringWidth['control-selection'];
  assert.throws(() => assertSelectionRing(tree, css, missing), /named selection ring/);
});
