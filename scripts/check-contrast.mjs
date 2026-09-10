#!/usr/bin/env node
// Contrast gate — WCAG 2.1 relative luminance, the same maths as
// samourai-visio/scripts/check-contrast.py, run over contrast-pairs.json.
//
// The four ways a contrast suite lies, and what stops each here:
//
//   A translucent colour is measured as if it were opaque.  Every foreground
//     is composited onto its background before it is measured, at whatever
//     alpha the colour itself carries. There is no per-row field to omit and
//     no branch to skip: the focus ring's halo reports 6.70:1 read as opaque
//     cobalt and the 1.78:1 it actually paints once composited, and that
//     difference is the whole distance between an indicator that satisfies
//     SC 1.4.11 and one that only says it does.
//   A colour the build composes is not measured at all.  A `spec:` reference
//     reads the ring out of scripts/lib/spec.mjs by role — the tone against
//     the control, the tone against the background — so these rows measure the
//     ring that ships. A geometry change moves the rows with it; it cannot
//     leave them describing a ring that is no longer there. ADR-0002.
//   A renamed token silently empties the suite.  An unresolvable pair is a
//     hard FAIL, never a skipped row.
//   A failure is "temporarily" tolerated and nobody remembers.  A failing pair
//     must be listed in contrast-known-failures.json with a written reason, and
//     an entry whose pair now passes fails the gate so the file cannot rot.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadTokens, indexTokens, resolve, parseColor, composite, contrastRatio, toHex } from './lib/tokens.mjs';
import { SPEC_COLORS } from './lib/spec.mjs';

const tree = loadTokens();
const index = indexTokens(tree);

const { pairs } = JSON.parse(readFileSync(join(ROOT, 'contrast-pairs.json'), 'utf8'));

const allowFile = join(ROOT, 'contrast-known-failures.json');
const allowlist = existsSync(allowFile) ? JSON.parse(readFileSync(allowFile, 'utf8')) : { failures: [] };
const allowed = new Map(allowlist.failures.map((f) => [f.id, { ...f, used: false }]));

/** A `spec:` role, a token path, or a literal colour, resolved to `{r, g, b, a}`. */
function colorOf(ref) {
  if (typeof ref === 'string' && ref.startsWith('spec:')) {
    const role = SPEC_COLORS[ref];
    // Not a fall-through to token resolution: a misspelt role that quietly
    // became a dangling token path would read as the wrong kind of mistake.
    if (!role) throw new Error(`unknown spec reference "${ref}" — the roles are ${Object.keys(SPEC_COLORS).join(', ')}`);
    return role(index);
  }
  if (typeof ref === 'string' && (ref.startsWith('#') || ref.startsWith('rgb'))) return parseColor(ref);
  return parseColor(resolve(ref, index));
}

const rows = [];
let hardFailures = 0;

for (const pair of pairs) {
  const row = { ...pair, ratio: null, verdict: null, note: '' };

  try {
    const bg = colorOf(pair.bg);
    // A translucent background would be measured as the colour behind it and
    // nothing would say so — the same silence this gate exists to break.
    if ((bg.a ?? 1) < 1) {
      throw new Error(`background "${pair.bg}" is translucent; a row measures against what is actually painted there`);
    }
    // Unconditional. A row cannot opt out of compositing, because the one that
    // did is how a 1.78:1 focus ring passed at 6.70:1.
    const fg = composite(colorOf(pair.fg), bg);
    row.fgHex = toHex(fg);
    row.bgHex = toHex(bg);
    row.ratio = contrastRatio(fg, bg);
  } catch (error) {
    // Not a SKIP. A row that cannot be measured is a row that is not guarding
    // anything, and a suite of unmeasurable rows exits 0 on every palette.
    row.verdict = 'FAIL';
    row.note = error.message;
    hardFailures++;
    rows.push(row);
    continue;
  }

  const clears = row.ratio >= pair.min;

  if (pair.expect === 'fail') {
    if (clears) {
      row.verdict = 'FAIL';
      row.note = 'forbidden pair now clears its minimum — the palette moved under the rule; update DESIGN_SYSTEM.md §2 or this row';
      hardFailures++;
    } else {
      row.verdict = 'FORBIDDEN';
      row.note = 'stays below the minimum, as the rule requires';
    }
    rows.push(row);
    continue;
  }

  const excuse = allowed.get(pair.id);

  if (clears) {
    row.verdict = pair.exempt ? 'EXEMPT' : 'PASS';
    if (excuse) {
      excuse.used = true;
      row.verdict = 'FAIL';
      row.note = 'listed in contrast-known-failures.json but the pair passes now — delete the entry';
      hardFailures++;
    }
    rows.push(row);
    continue;
  }

  // Below the minimum. Exempt or not, it needs a written reason on file.
  if (!excuse) {
    row.verdict = 'FAIL';
    row.note = pair.exempt
      ? 'exempt rows still need an entry in contrast-known-failures.json saying why'
      : 'below the minimum and not in contrast-known-failures.json';
    hardFailures++;
    rows.push(row);
    continue;
  }

  excuse.used = true;
  if (!excuse.reason || !excuse.reason.trim()) {
    row.verdict = 'FAIL';
    row.note = 'contrast-known-failures.json entry has no reason';
    hardFailures++;
  } else {
    row.verdict = pair.exempt ? 'EXEMPT' : 'ALLOWED';
    row.note = excuse.reason;
  }
  rows.push(row);
}

// An allowlist entry naming a pair that no longer exists is a stale exemption
// waiting to cover a different failure.
const orphans = [...allowed.values()].filter((f) => !f.used);

// --- Report -----------------------------------------------------------------
const w = (s, n) => String(s).padEnd(n);
const COL = { id: 36, fg: 9, bg: 9, ratio: 7, min: 5, verdict: 10 };

console.log('Contrast gate — WCAG 2.1, contrast-pairs.json over tokens.json');
console.log('='.repeat(112));
console.log(
  `${w('pair', COL.id)}${w('fg', COL.fg)}${w('bg', COL.bg)}${w('ratio', COL.ratio)}${w('min', COL.min)}${w('verdict', COL.verdict)}label`,
);
console.log('-'.repeat(112));

for (const row of rows) {
  const ratio = row.ratio === null ? '—' : row.ratio.toFixed(2);
  console.log(
    `${w(row.id, COL.id)}${w(row.fgHex ?? '—', COL.fg)}${w(row.bgHex ?? '—', COL.bg)}` +
      `${w(ratio, COL.ratio)}${w(row.min.toFixed(1), COL.min)}${w(row.verdict, COL.verdict)}${row.label}`,
  );
  if (row.note && row.verdict !== 'FORBIDDEN') console.log(`${' '.repeat(COL.id)}↳ ${row.note}`);
}

const tally = rows.reduce((acc, r) => ({ ...acc, [r.verdict]: (acc[r.verdict] ?? 0) + 1 }), {});
console.log('='.repeat(112));
console.log(
  `${rows.length} pairs — ` +
    ['PASS', 'ALLOWED', 'EXEMPT', 'FORBIDDEN', 'FAIL']
      .map((v) => `${tally[v] ?? 0} ${v.toLowerCase()}`)
      .join(', '),
);

if (orphans.length) {
  console.error('\nStale entries in contrast-known-failures.json (no pair carries that id):');
  for (const o of orphans) console.error(`  FAIL  ${o.id}`);
}

if (hardFailures || orphans.length) {
  console.error(
    `\n${hardFailures + orphans.length} contrast problem(s). Fix the token, or add the pair to ` +
      'contrast-known-failures.json with a reason. Nothing here passes by being quiet.',
  );
  process.exit(1);
}

console.log('\nOK — every pair either clears its minimum or carries a written reason.');
