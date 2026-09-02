#!/usr/bin/env python3
"""Decide whether the aggregate gate passes, given the `needs` context.

Branch protection points at a single required check. That check is only worth
anything if it goes red when an upstream job goes red, so the decision lives
here — in a file a self-test can exercise — rather than inline in the workflow
where nothing can prove it.

Reads the JSON `needs` object on stdin. Prints a GitHub error annotation for
every job that concluded anything other than success or a legitimate skip, and
exits non-zero if there was at least one.
"""

import json
import sys

PASSING = ("success", "skipped")


def failures(needs):
    """Return {job name: result} for every job that did not pass."""
    return {
        name: (job or {}).get("result")
        for name, job in needs.items()
        if (job or {}).get("result") not in PASSING
    }


def main():
    needs = json.load(sys.stdin)
    if not isinstance(needs, dict):
        print("::error::the needs context was not an object")
        return 1

    bad = failures(needs)
    for name, result in sorted(bad.items()):
        print(f"::error::{name} concluded {result}")

    if bad:
        print(f"{len(bad)} of {len(needs)} gates did not pass")
        return 1

    print(f"all {len(needs)} gates succeeded or were legitimately skipped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
