#!/usr/bin/env node
// Contrast gate — WCAG 2.1 relative luminance, the same maths as
// samourai-visio/scripts/check-contrast.py, run over contrast-pairs.json.
//
// The three ways a contrast suite lies, and what stops each here:
//
//   A translucent colour is measured as if it were opaque.  `fgAlpha`
//     composites the foreground onto the background first. That is how the
//     focus ring delivered at 35 % alpha was recorded at the 1.78:1 users saw
//     rather than the 6.70:1 an opaque cobalt reports; the ring is two-tone
//     now, and the field is here for the next translucent colour.
//   A renamed token silently empties the suite.  An unresolvable pair is a
//     hard FAIL, never a skipped row.
//   A failure is "temporarily" tolerated and nobody remembers.  A failing pair
//     must be listed in contrast-known-failures.json with a written reason, and
//     an entry whose pair now passes fails the gate so the file cannot rot.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadTokens, indexTokens, resolve, parseColor, composite, contrastRatio, toHex } from './lib/tokens.mjs';

const tree = loadTokens();
const index = indexTokens(tree);

const { pairs } = JSON.parse(readFileSync(join(ROOT, 'contrast-pairs.json'), 'utf8'));

const allowFile = join(ROOT, 'contrast-known-failures.json');
const allowlist = existsSync(allowFile) ? JSON.parse(readFileSync(allowFile, 'utf8')) : { failures: [] };
const allowed = new Map(allowlist.failures.map((f) => [f.id, { ...f, used: false }]));

/** A token path or a literal colour, resolved to `{r, g, b, a}`. */
function colorOf(ref) {
  if (typeof ref === 'string' && (ref.startsWith('#') || ref.startsWith('rgb'))) return parseColor(ref);
  return parseColor(resolve(ref, index));
}

const rows = [];
let hardFailures = 0;

for (const pair of pairs) {
  const row = { ...pair, ratio: null, verdict: null, note: '' };

  try {
    const bg = colorOf(pair.bg);
    let fg = colorOf(pair.fg);
    if (pair.fgAlpha !== undefined) fg = composite({ ...fg, a: pair.fgAlpha }, bg);
    else fg = composite(fg, bg);
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
