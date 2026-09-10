import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, cpSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, indexTokens, resolve, parseColor, composite, contrastRatio } from '../scripts/lib/tokens.mjs';
import { SPEC_COLORS } from '../scripts/lib/spec.mjs';
import preset from '../dist/tailwind.preset.js';

const fixture = JSON.parse(readFileSync(join(ROOT, 'test/fixtures/themes.json'), 'utf8'));
const tree = JSON.parse(readFileSync(join(ROOT, 'tokens.json'), 'utf8'));
const css = readFileSync(join(ROOT, 'dist/tokens.css'), 'utf8');
const geometry = { 'rail-width': '76px', 'rail-item-width': '56px', 'sidebar-width': '264px', 'document-max-width': '780px', 'document-min-width': '360px', 'dock-width': '340px', 'dock-offset': '24px' };

function checkContract(source, styles, config) {
  assert.deepEqual(Object.keys(source.semantic.theme ?? {}), ['light', 'dark', 'black'], 'complete theme set');
  const index = indexTokens(source);
  for (const [theme, expected] of Object.entries(fixture)) {
    const roles = source.semantic.theme[theme];
    assert.deepEqual(Object.keys(roles), Object.keys(expected), `${theme}: complete role set`);
    const block = styles.match(new RegExp(`\\[data-theme="${theme}"\\] \\{([^}]+)\\}`))?.[1];
    assert.ok(block, `${theme}: CSS boundary missing`);
    const declared = [...block.matchAll(/--c-([\w-]+): ([^;]+);/g)];
    assert.equal(declared.length, Object.keys(expected).length, `${theme}: CSS declaration count`);
    for (const [role, value] of Object.entries(expected)) {
      if (role === 'page-grad') {
        const stops = [...value.matchAll(/(#[A-F0-9]{6}) (\d+)%/g)].map((m) => ({ color: m[1], position: Number(m[2]) / 100 }));
        assert.equal(index.get(`semantic.theme.${theme}.${role}`).type, 'gradient');
        assert.deepEqual(resolve(`semantic.theme.${theme}.${role}`, index), stops, `${theme}: gradient stops`);
        assert.equal(source.color[`theme-${theme}`][role].$extensions['app.samourai.css-gradient'].angle, '115deg');
      } else {
        assert.equal(resolve(`semantic.theme.${theme}.${role}`, index), value, `${theme}.${role}: reference value`);
      }
      assert.equal(declared.find((m) => m[1] === role)?.[2], value, `${theme}.${role}: scoped CSS`);
      if (role !== 'page-grad') {
        assert.equal(config.theme.extend.colors[`c-${role}`], `var(--c-${role})`, `${role}: dynamic preset`);
      }
    }
  }
  assert.match(styles, /:root, \[data-theme="light"\]/, 'unthemed default is light');
  assert.equal(config.theme.extend.colors['c-page-grad'], undefined, 'gradients are not colors');
  assert.equal(config.theme.extend.backgroundImage['c-page-gradient'], 'var(--c-page-grad)');
  for (const [role, value] of Object.entries(geometry)) {
    assert.equal(resolve(`component.shell.${role}`, index), value, `${role}: geometry`);
    assert.ok(styles.includes(`--shell-${role}: ${value};`), `${role}: CSS geometry`);
    assert.equal(config.theme.extend.spacing[`shell-${role}`], `var(--shell-${role})`, `${role}: preset geometry`);
  }
}

test('three complete themes and shell geometry match the fixed reference', () => checkContract(tree, css, preset));

test('the CSS variable type enumerates the declarations actually generated', () => {
  const types = readFileSync(join(ROOT, 'dist/tokens.d.ts'), 'utf8');
  const names = [...new Set([...css.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]))].sort();
  const typed = [...types.matchAll(/\| '(--[a-z0-9-]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(typed, names, 'no phantom or missing CSS variables');
});

/**
 * A `spec:` role or a token path, resolved to a colour: the same two forms the
 * contrast gate accepts. A measurement of a colour the build composes has to
 * read it the way the build composes it, at its real alpha; naming the token
 * behind it would report the opaque source instead of the tone that is painted,
 * and would keep reporting it after the geometry moved. An unknown role is a
 * hard error rather than a fall-through to token resolution, so a misspelling
 * cannot become a row that measures nothing.
 */
function measurementColor(ref, index) {
  if (typeof ref === 'string' && ref.startsWith('spec:')) {
    const role = SPEC_COLORS[ref];
    if (!role) throw new Error(`unknown spec reference "${ref}" — the roles are ${Object.keys(SPEC_COLORS).join(', ')}`);
    return role(index);
  }
  return parseColor(resolve(ref, index));
}

function checkContrastCoverage(register) {
  const index = indexTokens(tree);
  for (const [theme, roles] of Object.entries(fixture)) {
    for (const role of Object.keys(roles).filter((r) => r !== 'page-grad')) {
      const path = `semantic.theme.${theme}.${role}`;
      assert.ok([...register.pairs, ...register.measurements].some((row) => row.fg === path || row.bg === path), `${path}: missing contrast coverage`);
    }
    const actualHover = register.pairs.find((row) => row.id === `theme.${theme}/on-inverse/action-hover`);
    assert.equal(actualHover?.min, 4.5, `${theme}: actual button text criterion`);
  }
  for (const row of register.pairs.filter((r) => r.id.startsWith('theme.'))) {
    assert.ok([3, 4.5].includes(row.min));
    assert.equal(row.exempt, undefined, 'no new exemptions');
    assert.equal(row.expect, undefined, 'no inverted theme acceptance');
  }
  return register.measurements.map((row) => {
    assert.ok(['decorative', 'capability'].includes(row.kind), `${row.id}: explicit measurement kind`);
    assert.ok(row.purpose?.trim(), `${row.id}: measurement purpose required`);
    assert.equal(row.min, undefined, `${row.id}: non-normative measurement has no acceptance minimum`);
    const bg = measurementColor(row.bg, index);
    const fg = composite(measurementColor(row.fg, index), bg);
    return `${row.id}: ${contrastRatio(fg, bg).toFixed(3)}:1 (${row.kind}, not normative acceptance)`;
  });
}

test('contrast covers every new color and explicitly reports non-normative measurements', () => {
  const register = JSON.parse(readFileSync(join(ROOT, 'contrast-pairs.json'), 'utf8'));
  for (const measurement of checkContrastCoverage(register)) console.log(measurement);
  const missing = structuredClone(register);
  missing.measurements = missing.measurements.filter((r) => !r.fg.endsWith('.shadow-1'));
  assert.throws(() => checkContrastCoverage(missing), /shadow-1: missing contrast coverage/);
  const silent = structuredClone(register);
  silent.measurements[0].purpose = '';
  assert.throws(() => checkContrastCoverage(silent), /measurement purpose required/);
  const weakened = structuredClone(register);
  weakened.pairs.find((r) => r.id === 'theme.dark/on-inverse/action-hover').min = 3;
  assert.throws(() => checkContrastCoverage(weakened), /actual button text criterion/);
  const misspelt = structuredClone(register);
  misspelt.measurements.find((r) => r.id === 'theme.dark/focus-ring-indicator/surface').fg = 'spec:focus-ring.core';
  assert.throws(() => checkContrastCoverage(misspelt), /unknown spec reference "spec:focus-ring\.core"/);
});

test('the acceptance contract detects missing, changed and frozen output', () => {
  checkContract(tree, css, preset);
  const missingTheme = structuredClone(tree);
  delete missingTheme.semantic.theme.black;
  assert.throws(() => checkContract(missingTheme, css, preset), /complete theme set/);
  const missingRole = structuredClone(tree);
  delete missingRole.semantic.theme.dark.ink;
  assert.throws(() => checkContract(missingRole, css, preset), /complete role set/);
  const changed = structuredClone(tree);
  changed.color['theme-light']['ink-3'].$value = '#000000';
  assert.throws(() => checkContract(changed, css, preset), /light.ink-3: reference value/);
  assert.throws(() => checkContract(tree, css.replace(/  --c-ink: [^;]+;\n/, ''), preset), /CSS declaration count/);
  const frozen = structuredClone(preset);
  frozen.theme.extend.colors['c-ink'] = '#2F3A45';
  assert.throws(() => checkContract(tree, css, frozen), /ink: dynamic preset/);
  const narrow = structuredClone(tree);
  narrow.space['shell-rail-width'].$value = '56px';
  assert.throws(() => checkContract(narrow, css, preset), /rail-width: geometry/);
});

test('the standalone build is deterministic, input-sensitive and rejects incomplete maps', () => {
  const dir = mkdtempSync(join(tmpdir(), 'shell-theme-build-'));
  try {
    cpSync(join(ROOT, 'scripts'), join(dir, 'scripts'), { recursive: true });
    cpSync(join(ROOT, 'tokens.json'), join(dir, 'tokens.json'));
    const build = () => spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: dir, encoding: 'utf8', env: {} });
    const output = () => ['tokens.css', 'tailwind.preset.js', 'tokens.d.ts'].map((f) => readFileSync(join(dir, 'dist', f), 'utf8'));
    assert.equal(build().status, 0);
    const first = output();
    assert.equal(build().status, 0);
    assert.deepEqual(output(), first, 'identical input must yield byte-identical output');
    const changed = structuredClone(tree);
    changed.color['theme-dark'].ink.$value = '#FFFFFF';
    writeFileSync(join(dir, 'tokens.json'), JSON.stringify(changed));
    assert.equal(build().status, 0);
    assert.notEqual(output()[0], first[0], 'source changes must reach CSS');
    const noAngle = structuredClone(tree);
    delete noAngle.color['theme-dark']['page-grad'].$extensions;
    writeFileSync(join(dir, 'tokens.json'), JSON.stringify(noAngle));
    const invalidGradient = build();
    assert.notEqual(invalidGradient.status, 0);
    assert.match(invalidGradient.stderr, /gradient angle metadata/);
    delete changed.semantic.theme.black.ink;
    writeFileSync(join(dir, 'tokens.json'), JSON.stringify(changed));
    const broken = build();
    assert.notEqual(broken.status, 0);
    assert.match(broken.stderr, /black.*incomplete theme role set/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
