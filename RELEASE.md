# Releasing

There is no registry and no `npm publish`: `package.json` is `private: true`, and both consumers install this package as a git dependency pinned to a tag. **The tag is the release.** Everything below exists so that a tag is reproducible by whoever cuts the next one, and so that nothing reaches a consumer that was not proven on `main` first.

## Before the tag

All of this is checked on `main`, at the commit that will carry the tag. A release branch is never tagged.

1. **`npm test` is green on `main`.** The `ci-ok` check on the merge commit, and a local run on a fresh checkout of that commit. Local matters because CI does not run `npm run build`: the drift gate asserts the committed `dist/` equals a fresh build, and building first would make that assertion vacuous.
2. **`dist/` is regenerated and drift-clean.** `npm run build && git status --porcelain` prints nothing. A tag whose `dist/` lags `tokens.json` installs the old palette in both consumers with no error anywhere.
3. **The contrast register has been read**, not just run. `npm run check:contrast` prints the table; every `ALLOWED` and `EXEMPT` row in `contrast-known-failures.json` carries a reason and the decision it records. A row still "awaiting" a decision is a reason not to tag, because the tag freezes it into what consumers ship.
4. **The decider is named.** Every pull request since the previous tag that changes what a consumer renders names, in its description, who decided it. The trigger is the generated output, not the file edited: a value in `tokens.json`, and equally a design constant the build emits into `dist/`. Those constants live in `scripts/lib/spec.mjs`, in the exported `SPEC` object — two entries today, `pageGradient` and `focusRing`, the second emitted as `--focus-ring` and the preset's `ringWidth.DEFAULT` / `ringColor.DEFAULT`. `scripts/build.mjs` imports `SPEC` and declares no design value of its own; what it does hold is naming and defaulting policy, which step 5 classes as a rename rather than a value change. **The two files to read are therefore `tokens.json` and `scripts/lib/spec.mjs`**, and `git log <previous tag>..main -- tokens.json scripts/lib/spec.mjs` is the list of pull requests this step is about — for the first tag, the whole history. Naming the two `SPEC` entries is an illustration and not a list: the rule is written against the output, so a constant added to `SPEC` is covered on the day it lands (ADR-0002, points 2 and 3, which also require every colour `SPEC` composes to carry a row in `contrast-pairs.json`). A token value change is a design decision (AGENTS.md, "The source of truth"), and a build constant that reaches `dist/` is one on the same footing: a consumer cannot tell which file a rendered value came from, and a tag that carries either unsigned ships a value nobody chose. No name, no tag.
5. **The version is right.** `package.json` `version` follows console ADR-0004 and DESIGN_HANDOFF F5, read against what the build emits rather than against `tokens.json` alone: renaming or removing a name a consumer can use — a token, a CSS variable, a preset key — is a **major**; a deprecation keeps the old name resolving for one minor; a value change alone, in `tokens.json` or in a design constant the build emits, is a minor. The `Unreleased` section of `CHANGELOG.md` becomes the heading for this version in the same pull request as the bump.

## The tag

Annotated, on `main`, pushed on its own:

```sh
git switch main && git pull --ff-only
npm test && npm run build && git status --porcelain   # green, and prints nothing
git tag -a vX.Y.Z -m "design-tokens vX.Y.Z"
git push origin vX.Y.Z
```

The tag name is `v` + the `package.json` version, exactly. A tag is never moved or deleted once pushed: a consumer pinned to it has already resolved it, and a moved tag is the drift ADR-0004 exists to prevent. A mistaken tag is followed by a corrected patch tag, and the changelog says so.

The person cutting the tag is one of the maintainers in `CODEOWNERS`.

## After the tag

The tag changes nothing until the consumers pin it. One pull request per consumer, opened by whoever cut the tag:

- `samourai-console` and `samourai-hub` bump `"@samourai/design-tokens": "github:samouraiworld/samourai-design-tokens#vX.Y.Z"` in `package.json` and refresh their lockfile.
- Each consumer's CI runs the token-resolution guard against the new preset; a class that no longer resolves fails there, which is the point of pinning rather than tracking a branch.
- The repin pull request pastes the `check:contrast` rows whose ratio moved since the consumer's previous pin, so the reviewer sees what a value change does to the screens before the palette lands on them.
- The consumer's version-drift rule (README, "The version-drift rule for consumers") is what makes the repin happen: a consumer more than one minor behind the newest tag fails its own CI.
