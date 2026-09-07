// Self-test for the contrast gate itself.
//
// The gate's allowlist is the one place a failing pair is tolerated on purpose,
// so it is the one place a failure can hide. Each test below copies the gate
// and its inputs into a scratch directory, breaks exactly one thing, and
// asserts the gate goes red for that reason and no other. A gate nobody has
// seen fail is a decoration; this file is where each way it must fail, fails.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INPUTS = ['tokens.json', 'contrast-pairs.json', 'contrast-known-failures.json'];

/** A throwaway copy of the gate and everything it reads; nothing else. */
function scratch() {
  const dir = mkdtempSync(join(tmpdir(), 'contrast-selftest-'));
  cpSync(join(ROOT, 'scripts'), join(dir, 'scripts'), { recursive: true });
  for (const file of INPUTS) cpSync(join(ROOT, file), join(dir, file));
  return dir;
}

function runGate(dir) {
  const result = spawnSync(process.execPath, [join(dir, 'scripts', 'check-contrast.mjs')], { cwd: dir, encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}

const readJson = (dir, file) => JSON.parse(readFileSync(join(dir, file), 'utf8'));
const writeJson = (dir, file, data) => writeFileSync(join(dir, file), JSON.stringify(data, null, 2));

/** Break one thing with `mutate`, run the gate, assert it fails and says why. */
function assertFailsFor(name, mutate, expectedNote) {
  test(name, () => {
    const dir = scratch();
    try {
      mutate(dir);
      const { status, output } = runGate(dir);
      assert.equal(status, 1, `the gate exited ${status} instead of failing:\n${output}`);
      assert.match(output, expectedNote, `the gate failed, but not for the reason under test:\n${output}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

/** An allowlisted pair whose ratio stays below its minimum through the mutation. */
function excusedPair(dir, id) {
  const pair = readJson(dir, 'contrast-pairs.json').pairs.find((p) => p.id === id);
  const entry = readJson(dir, 'contrast-known-failures.json').failures.find((f) => f.id === id);
  assert.ok(pair && entry, `${id} must be a pair with an allowlist entry for this test to mean anything`);
  return { pair, entry };
}

const editPairs = (dir, edit) => {
  const data = readJson(dir, 'contrast-pairs.json');
  edit(data.pairs);
  writeJson(dir, 'contrast-pairs.json', data);
};
const editAllowlist = (dir, edit) => {
  const data = readJson(dir, 'contrast-known-failures.json');
  edit(data.failures);
  writeJson(dir, 'contrast-known-failures.json', data);
};

test('an untouched copy of the gate and its inputs passes', () => {
  const dir = scratch();
  try {
    const { status, output } = runGate(dir);
    assert.equal(status, 0, output);
    assert.match(output, /OK — every pair either clears its minimum or carries a written reason/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// The first allowlisted text row, whichever it is on this branch: the tests
// below need a pair that fails its minimum and carries an excuse, not a
// specific colour.
const SUBJECT = () => readJson(ROOT, 'contrast-known-failures.json').failures[0].id;

assertFailsFor(
  'a pair re-pointed at a different background keeps its id but loses its excuse',
  (dir) => {
    const { pair } = excusedPair(dir, SUBJECT());
    // Any other opaque surface: the excuse names a pair, and this is not it.
    const other = pair.bg === 'semantic.surface.inverse' ? 'semantic.surface.default' : 'semantic.surface.inverse';
    editPairs(dir, (pairs) => {
      pairs.find((p) => p.id === pair.id).bg = other;
    });
  },
  /written for bg .* but the pair now measures bg .* a different pair, not the one excused/,
);

assertFailsFor(
  'an allowlist entry that names a different foreground than the pair it excuses fails',
  (dir) => {
    editAllowlist(dir, (failures) => {
      failures.find((f) => f.id === SUBJECT()).fg = 'semantic.text.primary';
    });
  },
  /written for fg "semantic\.text\.primary" but the pair now measures fg .* a different pair, not the one excused/,
);

assertFailsFor(
  'loosening a pair\'s minimum does not let its old excuse stand',
  (dir) => {
    const { pair } = excusedPair(dir, SUBJECT());
    editPairs(dir, (pairs) => {
      // Still failing after the loosening, so the binding check is what fires.
      pairs.find((p) => p.id === pair.id).min = pair.min - 0.1;
    });
  },
  /written for min [\d.]+, the pair now requires [\d.]+/,
);

assertFailsFor(
  'a colour that got worse since the ruling is not covered by the ruling',
  (dir) => {
    const { pair } = excusedPair(dir, SUBJECT());
    // Push the foreground towards the background: same pair, worse ratio.
    const tokens = readJson(dir, 'tokens.json');
    const path = pair.fg.split('.');
    let node = tokens;
    for (const key of path) node = node[key];
    const value = node.$value;
    if (typeof value === 'string' && value.startsWith('{')) {
      node = tokens;
      for (const key of value.slice(1, -1).split('.')) node = node[key];
    }
    node.$value = '#B0B8C0';
    writeJson(dir, 'tokens.json', tokens);
  },
  /worse than the [\d.]+ the entry was written for/,
);

assertFailsFor(
  'a recorded ratio that no longer matches what is measured fails until it is re-read',
  (dir) => {
    editAllowlist(dir, (failures) => {
      failures.find((f) => f.id === SUBJECT()).ratio -= 1;
    });
  },
  /not the [\d.]+ the entry was written for — the colour moved; re-read the ruling/,
);

assertFailsFor(
  'an entry with no decision is not a ruling',
  (dir) => {
    editAllowlist(dir, (failures) => {
      delete failures.find((f) => f.id === SUBJECT()).decision;
    });
  },
  /entry has no decision/,
);

assertFailsFor(
  'an entry with no reason is not an excuse',
  (dir) => {
    editAllowlist(dir, (failures) => {
      failures.find((f) => f.id === SUBJECT()).reason = '   ';
    });
  },
  /entry has no reason/,
);
