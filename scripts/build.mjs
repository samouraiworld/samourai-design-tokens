#!/usr/bin/env node
// Generate dist/ from tokens.json. Pure function of tokens.json: same input,
// byte-identical output, no clock, no environment, no network.
//
//   node scripts/build.mjs           write dist/
//   node scripts/build.mjs --check   regenerate in memory and diff against
//                                    dist/ on disk; exit 1 on any difference
//
// The variable NAMES are not invented here. They reproduce the names in the
// design drop's tokens.css, because the delivered HTML prototypes and the
// component spec tables address those names directly: renaming --surface to
// --color-surface-default would not break a build, it would silently unstyle
// every prototype. Anything additive (a token the drop's hand-written CSS
// happened to omit) is emitted too — a token that generates no output is a
// token a consumer cannot use.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadTokens, walkTokens, indexTokens, resolve, resolveValue, parseColor } from './lib/tokens.mjs';

const DIST = join(ROOT, 'dist');
const CHECK = process.argv.includes('--check');

const tree = loadTokens();
const tokens = walkTokens(tree);
const index = indexTokens(tree);
const byPath = new Map(tokens.map((t) => [t.path, t]));

const flat = (path) => {
  if (!byPath.has(path)) throw new Error(`build expects the token "${path}" and tokens.json does not define it`);
  return resolve(path, index);
};

// --- Spec constants ---------------------------------------------------------
// Values the design system fixes but tokens.json v0.1 does not yet carry as
// tokens. Each is asserted against a token it derives from, so a palette change
// flows through and a token rename fails the build rather than the browser.
const SPEC = {
  // DESIGN_SYSTEM.md §2: "frost gradient 115deg #DCE6F0 → #EEF3F8 (45%) → #FFFFFF".
  pageGradient: { angle: '115deg', stops: [['color.frost.200', '0%'], ['color.frost.100', '45%'], ['color.white', '100%']] },
  // COMPONENTS.md delivered the ring as "0 0 0 3px rgba(43,75,219,.35) on
  // every interactive element". That halo alone composites to #B5C0F2 on white
  // and measures 1.78:1, which does not satisfy SC 1.4.11 for the one indicator
  // a keyboard user has to locate themselves with. The ring is now two-tone: an
  // opaque core in the action colour — 6.70:1 on white, 6.01:1 on the page —
  // with the delivered halo kept at its 3 px width, pushed outside the core.
  // The core is what contrast-pairs.json measures, because it is what carries
  // the indicator; the halo stays because it is what makes it read as a ring.
  focusRing: { source: 'semantic.action.primary', core: '2px', halo: '5px', haloAlpha: 0.35 },
};

// --- Path → CSS custom property --------------------------------------------
const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

// The two names the design drop chose that a mechanical mapping would miss.
// CSS ONLY: the delivered prototypes address `--bg-page-flat` and `--hairline`
// by name. The Tailwind preset uses the mechanical names instead
// (`surface-page`, `border-hairline`) because the token test keys off the
// family — the first segment — and `bg-page-flat` would put a token in a family
// called `bg`, where `bg-page-flat` reads as the utility rather than the token.
const CSS_ALIASES = {
  'semantic.surface.page': 'bg-page-flat',
  'semantic.border.hairline': 'hairline',
};

const CSS_PREFIX = {
  'font.family': 'font',
  'font.size': 'text',
  'font.weight': 'weight',
  'font.tracking': 'tracking',
  'font.lineHeight': 'leading',
  space: 'sp',
  radius: 'r',
  shadow: 'shadow',
  'motion.duration': 'dur',
  'motion.easing': 'ease',
};

function cssName(path) {
  if (CSS_ALIASES[path]) return CSS_ALIASES[path];
  return mechanicalName(path);
}

/** The name before the CSS-only aliases are applied. */
function mechanicalName(path) {
  const seg = path.split('.');

  if (seg[0] === 'color') return seg.slice(1).map(kebab).join('-');

  if (seg[0] === 'semantic') {
    const rest = seg.slice(1).map(kebab);
    // `surface.default` is just `--surface`; `.default` is the absence of a
    // variant, not a variant named "default".
    if (rest.at(-1) === 'default') rest.pop();
    return rest.join('-');
  }

  const twoLevel = `${seg[0]}.${seg[1]}`;
  const prefix = CSS_PREFIX[twoLevel] ?? CSS_PREFIX[seg[0]];
  if (!prefix) throw new Error(`no CSS naming rule for "${path}"`);
  const tail = (CSS_PREFIX[twoLevel] ? seg.slice(2) : seg.slice(1)).map(kebab).join('-');
  return `${prefix}-${tail}`;
}

// --- Value → CSS ------------------------------------------------------------
// Quote a family name only when it is not a bare CSS identifier. Quoting is not
// cosmetic: `'sans-serif'` is a font NAMED "sans-serif", not the generic
// keyword, so the fallback at the end of the stack quietly stops working.
function quoteFamily(name) {
  const bareIdentifier = /^-?[A-Za-z_][A-Za-z0-9_-]*$/.test(name);
  return bareIdentifier ? name : `'${name}'`;
}

function cssValue(token) {
  const value = resolveValue(token.value, index);
  switch (token.type) {
    case 'fontFamily':
      return value.map(quoteFamily).join(', ');
    case 'cubicBezier':
      return `cubic-bezier(${value.join(', ')})`;
    case 'shadow': {
      const { offsetX, offsetY, blur, spread, color } = value;
      return `${offsetX} ${offsetY} ${blur} ${spread} ${color}`;
    }
    default:
      return String(value);
  }
}

function rgba(hex, alpha) {
  const { r, g, b } = parseColor(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// --- dist/tokens.css --------------------------------------------------------
const HEADER = `/* GENERATED FILE — DO NOT EDIT.
   Written by scripts/build.mjs from tokens.json, which is the source of truth.
   Editing this file by hand is undone by the next build and caught by
   \`npm run check:drift\`. Change tokens.json instead. */`;

function pick(prefix) {
  return tokens.filter((t) => t.path === prefix || t.path.startsWith(`${prefix}.`));
}

function declare(token) {
  const line = `  --${cssName(token.path)}: ${cssValue(token)};`;
  const note = token.description ? ` /* ${token.description} */` : '';
  return line + note;
}

function buildCss() {
  const gradient = `linear-gradient(${SPEC.pageGradient.angle}, ${SPEC.pageGradient.stops
    .map(([path, stop]) => `var(--${cssName(path)}) ${stop}`)
    .join(', ')})`;

  const ring = flat(SPEC.focusRing.source);
  const focus =
    `0 0 0 ${SPEC.focusRing.core} ${ring}, ` +
    `0 0 0 ${SPEC.focusRing.halo} ${rgba(ring, SPEC.focusRing.haloAlpha)}`;

  const sections = [
    ['primitives — colour', pick('color').map(declare)],
    [
      'semantic — surfaces and boundaries',
      [
        `  --bg-page: ${gradient};`,
        ...pick('semantic.surface').map(declare),
        ...pick('semantic.border').map(declare),
      ],
    ],
    ['semantic — text', pick('semantic.text').map(declare)],
    ['semantic — actions', [...pick('semantic.action').map(declare), `  --focus-ring: ${focus};`]],
    ['type', pick('font').map(declare)],
    ['space (4px base)', pick('space').map(declare)],
    ['radius', pick('radius').map(declare)],
    ['elevation', pick('shadow').map(declare)],
    ['motion', pick('motion').map(declare)],
  ];

  const body = sections
    .map(([title, lines]) => `  /* ${title} */\n${lines.join('\n')}`)
    .join('\n\n');

  return `${HEADER}\n:root {\n${body}\n}\n`;
}

// --- dist/tailwind.preset.js ------------------------------------------------
// Nicknames the design drop's preset introduced on top of the semantic names.
// They are the ergonomic path (`text-ink-2` beats `text-text-secondary`); the
// mechanical names are emitted as well so every semantic token resolves.
const PRESET_NICKNAMES = {
  ink: 'semantic.text.primary',
  'ink-2': 'semantic.text.secondary',
  'ink-3': 'semantic.text.tertiary',
  'ink-placeholder': 'semantic.text.placeholder',
  action: 'semantic.action.primary',
  'action-hover': 'semantic.action.primaryHover',
};

// Tailwind's bare classes (`rounded`, `text-base`, `duration-*`) read DEFAULT,
// not our step name. Both keys are emitted: dropping the step name is how
// `rounded-md` silently falls back to Tailwind's own 0.375rem.
const PRESET_DEFAULTS = { fontSize: 'md', borderRadius: 'md', transitionDuration: 'base' };
const PRESET_RENAMES = { fontSize: { md: 'base' } };

const js = (v) => JSON.stringify(v);

function scaleObject(prefix, transform = (t) => resolveValue(t.value, index)) {
  const out = {};
  for (const t of pick(prefix)) {
    if (t.path === prefix) continue;
    out[t.path.slice(prefix.length + 1)] = transform(t);
  }
  return out;
}

function withDefaults(kind, obj) {
  const renames = PRESET_RENAMES[kind] ?? {};
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v;
    if (renames[k]) out[renames[k]] = v;
  }
  const step = PRESET_DEFAULTS[kind];
  if (step && step in obj) out.DEFAULT = obj[step];
  return out;
}

function literal(obj, indent) {
  const pad = ' '.repeat(indent);
  const entries = Object.entries(obj).map(([k, v]) => {
    const key = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : js(k);
    const value = Array.isArray(v)
      ? `[${v.map(js).join(', ')}]`
      : v && typeof v === 'object'
        ? literal(v, indent + 2)
        : js(v);
    return `${pad}  ${key}: ${value},`;
  });
  return `{\n${entries.join('\n')}\n${pad}}`;
}

function buildPreset() {
  const colors = {};
  for (const [key, child] of Object.entries(tree.color)) {
    if (key.startsWith('$')) continue;
    colors[key] = '$value' in child ? flat(`color.${key}`) : scaleObject(`color.${key}`);
  }
  for (const t of pick('semantic')) colors[mechanicalName(t.path)] = flat(t.path);
  for (const [nick, path] of Object.entries(PRESET_NICKNAMES)) colors[nick] = flat(path);

  const shadows = Object.fromEntries(
    pick('shadow').map((t) => [t.path.slice('shadow.'.length), cssValue(t)]),
  );

  const gradient = `linear-gradient(${SPEC.pageGradient.angle}, ${SPEC.pageGradient.stops
    .map(([path, stop]) => `${flat(path)} ${stop}`)
    .join(', ')})`;

  const theme = {
    colors,
    spacing: scaleObject('space'),
    fontFamily: scaleObject('font.family'),
    fontSize: withDefaults('fontSize', scaleObject('font.size')),
    fontWeight: Object.fromEntries(
      Object.entries(scaleObject('font.weight')).map(([k, v]) => [k, String(v)]),
    ),
    lineHeight: Object.fromEntries(
      Object.entries(scaleObject('font.lineHeight')).map(([k, v]) => [k, String(v)]),
    ),
    letterSpacing: scaleObject('font.tracking'),
    borderRadius: withDefaults('borderRadius', scaleObject('radius')),
    boxShadow: shadows,
    backgroundImage: { frost: gradient },
    // Tailwind's ring utility is single-tone, so it carries the opaque core —
    // the part SC 1.4.11 measures. The full two-tone ring is on --focus-ring.
    ringColor: { DEFAULT: flat(SPEC.focusRing.source) },
    ringWidth: { DEFAULT: SPEC.focusRing.core },
    transitionTimingFunction: Object.fromEntries(
      pick('motion.easing').map((t) => [t.path.slice('motion.easing.'.length), cssValue(t)]),
    ),
    transitionDuration: withDefaults('transitionDuration', scaleObject('motion.duration')),
  };

  return `// GENERATED FILE — DO NOT EDIT.
// Written by scripts/build.mjs from tokens.json, which is the source of truth.
// Editing this file by hand is undone by the next build and caught by
// \`npm run check:drift\`. Change tokens.json instead.
//
// Colour keys are flat names on purpose: the token test in test/token-test.mjs
// asserts that every \`bg-/text-/border-/ring-/fill-/stroke-\` class naming one
// of these families resolves to a real key. A class that names a key which does
// not exist emits NO CSS and NO error — for \`border-*\` the element falls back
// to preflight's \`border: 0 solid #e5e7eb\`, a light grey line on our page.
//
// Not covered in v0.1, because tokens.json does not carry them yet: z-index,
// breakpoints, and a dark mode. See docs/adr/0001 and the README.

/** @type {{theme: {extend: Record<string, unknown>}}} */
export default {
  theme: {
    extend: ${literal(theme, 4)},
  },
};
`;
}

// --- dist/tokens.d.ts -------------------------------------------------------
function buildTypes() {
  const vars = [
    '--bg-page',
    '--focus-ring',
    ...tokens.map((t) => `--${cssName(t.path)}`),
  ].sort();
  const paths = tokens.map((t) => t.path).sort();

  return `// GENERATED FILE — DO NOT EDIT.
// Written by scripts/build.mjs from tokens.json, which is the source of truth.

/** Every dotted token path in tokens.json. */
export type TokenPath =
${paths.map((p) => `  | '${p}'`).join('\n')};

/** Every custom property declared by dist/tokens.css. */
export type TokenCssVariable =
${vars.map((v) => `  | '${v}'`).join('\n')};

export interface SamouraiTailwindPreset {
  theme: {
    extend: {
      colors: Record<string, string | Record<string, string>>;
      spacing: Record<string, string>;
      fontFamily: Record<string, string[]>;
      fontSize: Record<string, string>;
      fontWeight: Record<string, string>;
      lineHeight: Record<string, string>;
      letterSpacing: Record<string, string>;
      borderRadius: Record<string, string>;
      boxShadow: Record<string, string>;
      backgroundImage: Record<string, string>;
      ringColor: Record<string, string>;
      ringWidth: Record<string, string>;
      transitionTimingFunction: Record<string, string>;
      transitionDuration: Record<string, string>;
    };
  };
}

declare const preset: SamouraiTailwindPreset;
export default preset;
`;
}

// --- Emit or diff -----------------------------------------------------------
const artefacts = {
  'tokens.css': buildCss(),
  'tailwind.preset.js': buildPreset(),
  'tokens.d.ts': buildTypes(),
};

if (CHECK) {
  const drifted = [];
  for (const [name, content] of Object.entries(artefacts)) {
    const file = join(DIST, name);
    if (!existsSync(file)) {
      drifted.push(`${name}: missing from dist/ — it was never built, or it was deleted`);
      continue;
    }
    const onDisk = readFileSync(file, 'utf8');
    if (onDisk !== content) {
      drifted.push(`${name}: differs from a fresh build (${onDisk.length} bytes on disk, ${content.length} generated)`);
    }
  }
  if (drifted.length) {
    console.error('Drift — dist/ is not what tokens.json generates:\n');
    for (const d of drifted) console.error(`  FAIL  ${d}`);
    console.error('\nRun `npm run build` and commit dist/.');
    process.exit(1);
  }
  console.log(`OK — dist/ matches a fresh build (${Object.keys(artefacts).join(', ')}).`);
} else {
  mkdirSync(DIST, { recursive: true });
  for (const [name, content] of Object.entries(artefacts)) {
    writeFileSync(join(DIST, name), content, 'utf8');
    console.log(`wrote dist/${name}  (${content.length} bytes)`);
  }
}
