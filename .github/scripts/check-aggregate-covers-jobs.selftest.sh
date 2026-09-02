#!/usr/bin/env bash
# Proves the coverage check can fail.
#
# The case that matters is the third one: a gate present in the workflow but
# absent from the aggregate's `needs:`. That job can fail while the required
# check stays green, which is exactly what this check exists to prevent — so a
# version of it that cannot detect that is worse than none.

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script="$here/check-aggregate-covers-jobs.py"

[ -f "$script" ] || { echo "self-test FAILED: $script is missing" >&2; exit 1; }

work="$(mktemp -d)"

fixture() { printf '%s\n' "$2" > "$work/$1.yml"; }

expect() {
  local want="$1" label="$2" got=0
  python3 "$script" "$work/$2.yml" >/dev/null 2>&1 || got=$?
  if [ "$got" -ne "$want" ]; then
    echo "self-test FAILED: '$label' expected exit $want, got $got" >&2
    exit 1
  fi
  printf '  ok  %-38s exit %s\n' "$label" "$got"
}

echo "aggregate-covers-jobs self-test"

fixture complete 'name: CI
jobs:
  build:
    runs-on: ubuntu-latest
  lint:
    runs-on: ubuntu-latest
  ci-ok:
    name: ci-ok
    needs:
      - build
      - lint'
expect 0 complete

fixture flow 'name: CI
jobs:
  build:
    runs-on: ubuntu-latest
  ci-ok:
    name: ci-ok
    needs: [build]'
expect 0 flow

fixture uncovered 'name: CI
jobs:
  build:
    runs-on: ubuntu-latest
  lint:
    runs-on: ubuntu-latest
  ci-ok:
    name: ci-ok
    needs:
      - build'
expect 1 uncovered

fixture phantom 'name: CI
jobs:
  build:
    runs-on: ubuntu-latest
  ci-ok:
    name: ci-ok
    needs:
      - build
      - a-job-that-was-renamed'
expect 1 phantom

fixture missing 'name: CI
jobs:
  build:
    runs-on: ubuntu-latest'
expect 1 missing

echo "self-test passed: an unwired gate, a stale dependency and a missing"
echo "aggregate are all caught"
