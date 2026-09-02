#!/usr/bin/env bash
# Proves the aggregate gate can fail.
#
# A required status check that has never been observed failing is a decoration,
# not a gate. This runs immediately before the real evaluation, so every
# pipeline re-proves that a failed upstream job turns the aggregate red — the
# mutation is the point, not the passing case.

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script="$here/aggregate-result.py"

[ -f "$script" ] || { echo "self-test FAILED: $script is missing" >&2; exit 1; }

expect() {
  local want="$1" label="$2" payload="$3" got=0
  printf '%s' "$payload" | python3 "$script" >/dev/null 2>&1 || got=$?
  if [ "$got" -ne "$want" ]; then
    echo "self-test FAILED: '$label' expected exit $want, got $got" >&2
    exit 1
  fi
  printf '  ok  %-28s exit %s\n' "$label" "$got"
}

echo "aggregate-result self-test"
expect 0 "all succeeded"        '{"a":{"result":"success"},"b":{"result":"success"}}'
expect 0 "a legitimate skip"    '{"a":{"result":"success"},"b":{"result":"skipped"}}'
expect 1 "one failure"          '{"a":{"result":"success"},"b":{"result":"failure"}}'
expect 1 "one cancellation"     '{"a":{"result":"success"},"b":{"result":"cancelled"}}'
expect 1 "every gate failed"    '{"a":{"result":"failure"},"b":{"result":"failure"}}'
expect 1 "a missing result"     '{"a":{}}'
echo "self-test passed: the aggregate fails when an upstream gate fails"
