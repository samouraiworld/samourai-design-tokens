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

// The first allowlisted row, whichever it is on this branch: the seven
// mutations that follow need a pair that fails its minimum and carries an
// excuse, not a specific colour. It has to be addressed by token path, because
// one of them moves the colour itself; a `spec:` row's colour is composed in
// scripts/lib/spec.mjs and there is no token to edit.
//
// That is a limit of these seven mutations, not of the gate. The other half of
// the binding — a row addressed by a `spec:` role, which is the half that only
// exists at all since the roles landed — is mutated at the end of this file,
// against a subject built for it.
const TOKEN_PATH_SUBJECT = () => {
  const entry = readJson(ROOT, 'contrast-known-failures.json').failures[0];
  assert.ok(
    !String(entry.fg).startsWith('spec:'),
    `${entry.id} is allowlisted by a spec: role; these mutations edit tokens.json and cannot move it`,
  );
  return entry.id;
};

assertFailsFor(
  'a pair re-pointed at a different background keeps its id but loses its excuse',
  (dir) => {
    const { pair } = excusedPair(dir, TOKEN_PATH_SUBJECT());
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
      failures.find((f) => f.id === TOKEN_PATH_SUBJECT()).fg = 'semantic.text.primary';
    });
  },
  /written for fg "semantic\.text\.primary" but the pair now measures fg .* a different pair, not the one excused/,
);

assertFailsFor(
  'loosening a pair\'s minimum does not let its old excuse stand',
  (dir) => {
    const { pair } = excusedPair(dir, TOKEN_PATH_SUBJECT());
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
    const { pair } = excusedPair(dir, TOKEN_PATH_SUBJECT());
    // Push the foreground towards the background: same pair, worse ratio.
    //
    // The literal lands on the pair's OWN token, not on the ramp step it
    // aliases. Following the alias would move a shared primitive — the
    // placeholder ink and `semantic.border.input` are both `color.slate.500`
    // since ADR-0002 — and drag an unrelated gated row below its minimum, so
    // the gate would go red partly for a reason this test is not about. Two
    // rows still report it, surface.default and surface.muted: both are the
    // placeholder ink under test, on the two surfaces it is excused against.
    const tokens = readJson(dir, 'tokens.json');
    const path = pair.fg.split('.');
    let node = tokens;
    for (const key of path) node = node[key];
    node.$value = '#B0B8C0';
    writeJson(dir, 'tokens.json', tokens);
  },
  /worse than the [\d.]+ the entry was written for/,
);

assertFailsFor(
  'a recorded ratio that no longer matches what is measured fails until it is re-read',
  (dir) => {
    editAllowlist(dir, (failures) => {
      failures.find((f) => f.id === TOKEN_PATH_SUBJECT()).ratio -= 1;
    });
  },
  /not the [\d.]+ the entry was written for — the colour moved; re-read the ruling/,
);

assertFailsFor(
  'an entry with no decision is not a ruling',
  (dir) => {
    editAllowlist(dir, (failures) => {
      delete failures.find((f) => f.id === TOKEN_PATH_SUBJECT()).decision;
    });
  },
  /entry has no decision/,
);

assertFailsFor(
  'an entry with no reason is not an excuse',
  (dir) => {
    editAllowlist(dir, (failures) => {
      failures.find((f) => f.id === TOKEN_PATH_SUBJECT()).reason = '   ';
    });
  },
  /entry has no reason/,
);

// --- Rows addressed by a `spec:` role ---------------------------------------
//
// Everything above moves a row addressed by a token path. A row addressed by a
// role is the seam the binding has to cover as well: its colour is composed in
// scripts/lib/spec.mjs, so re-pointing it at the literal that role paints today
// leaves the ratio untouched and only the `fg` binding can see that the row has
// stopped following the spec. No shipped row is both role-addressed and
// allowlisted — the ring clears its minimums — so the subject is built in the
// scratch copy rather than borrowed from the repository. Building it is setup
// and not one of the breaks: the test right below it holds that state to the
// same bar as the untouched tree, so each mutation after it is still the only
// thing wrong when the gate goes red.
const ROLE_SUBJECT = 'focus-ring/surface.default';

/**
 * Make the role-addressed ring row a failing, excused row inside `dir`: the
 * indicator measures 6.70:1 on white, so a minimum of 7 puts it below the bar
 * without touching a single colour. What the three mutations below then break
 * is the binding, not the measurement.
 */
function excuseRoleAddressedRow(dir) {
  const pair = readJson(dir, 'contrast-pairs.json').pairs.find((p) => p.id === ROLE_SUBJECT);
  assert.equal(
    pair?.fg,
    'spec:focus-ring.indicator',
    `${ROLE_SUBJECT} must still be addressed by a spec: role for these tests to mean anything`,
  );
  editPairs(dir, (pairs) => {
    pairs.find((p) => p.id === ROLE_SUBJECT).min = 7.0;
  });
  editAllowlist(dir, (failures) => {
    failures.push({
      id: ROLE_SUBJECT,
      fg: 'spec:focus-ring.indicator',
      bg: 'semantic.surface.default',
      ratio: 6.7,
      min: 7.0,
      reason: 'Scratch-only: the ring held to a minimum this copy invents for it.',
      decision: 'Scratch-only, and deleted with the scratch directory.',
    });
  });
}

test('the role-addressed subject is green before anything is broken', () => {
  const dir = scratch();
  try {
    excuseRoleAddressedRow(dir);
    const { status, output } = runGate(dir);
    assert.equal(status, 0, `the subject itself fails the gate, so the mutations below prove nothing:\n${output}`);
    assert.match(output, new RegExp(`${ROLE_SUBJECT.replace('/', '\\/').replace('.', '\\.')}.*ALLOWED`));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

assertFailsFor(
  'a role-addressed pair re-pointed at the literal that role paints today loses its excuse',
  (dir) => {
    excuseRoleAddressedRow(dir);
    // The colour does not move: #2B4BDB is what spec:focus-ring.indicator
    // composes to today, so the row still measures 6.70 and the ratio has
    // nothing to report. What changed is that the row no longer reads
    // scripts/lib/spec.mjs — a geometry change would leave it behind, which is
    // the lie the roles exist to stop — and only the `fg` binding can say so.
    editPairs(dir, (pairs) => {
      pairs.find((p) => p.id === ROLE_SUBJECT).fg = '#2B4BDB';
    });
  },
  /written for fg "spec:focus-ring\.indicator" but the pair now measures fg "#2B4BDB" — a different pair, not the one excused/,
);

assertFailsFor(
  'a role-addressed pair re-pointed at another `spec:` role loses its excuse too',
  (dir) => {
    excuseRoleAddressedRow(dir);
    // The ring's other tone: still composed, still a real role, still not the
    // one the ruling was written about.
    editPairs(dir, (pairs) => {
      pairs.find((p) => p.id === ROLE_SUBJECT).fg = 'spec:focus-ring.outer';
    });
  },
  /written for fg "spec:focus-ring\.indicator" but the pair now measures fg "spec:focus-ring\.outer" — a different pair, not the one excused/,
);

assertFailsFor(
  'a colour the build composes, moved since the ruling, is not covered by the ruling',
  (dir) => {
    excuseRoleAddressedRow(dir);
    // The literal lands on the ring's own source token (SPEC.focusRing.source),
    // not on the ramp step it aliases, for the same reason as the token-path
    // mutation above: color.cobalt.500 is semantic.text.accent as well, and
    // moving it drags three unrelated gated rows under 4.5:1. Moving the source
    // alone takes the indicator from 6.70 to 4.92 and leaves one FAIL row.
    const tokens = readJson(dir, 'tokens.json');
    tokens.semantic.action.primary.$value = '#4A66E0';
    writeJson(dir, 'tokens.json', tokens);
  },
  /measures 4\.92, worse than the 6\.70 the entry was written for/,
);
