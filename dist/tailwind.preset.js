// GENERATED FILE — DO NOT EDIT.
// Written by scripts/build.mjs from tokens.json, which is the source of truth.
// Editing this file by hand is undone by the next build and caught by
// `npm run check:drift`. Change tokens.json instead.
//
// Colour keys are flat names on purpose: the token test in test/token-test.mjs
// asserts that every `bg-/text-/border-/ring-/fill-/stroke-` class naming one
// of these families resolves to a real key. A class that names a key which does
// not exist emits NO CSS and NO error — for `border-*` the element falls back
// to preflight's `border: 0 solid #e5e7eb`, a light grey line on our page.
//
// Not covered in v0.1, because tokens.json does not carry them yet: z-index,
// breakpoints, and a dark mode. See docs/adr/0001 and the README.

/** @type {{theme: {extend: Record<string, unknown>}}} */
export default {
  theme: {
    extend: {
      colors: {
        slate: {
          "100": "#EEF2F6",
          "150": "#E4EAF1",
          "200": "#D9E1EA",
          "300": "#C9D3DE",
          "500": "#7C8894",
          "600": "#66737F",
          "700": "#56626E",
          "900": "#2F3A45",
        },
        frost: {
          "100": "#EEF3F8",
          "200": "#DCE6F0",
        },
        white: "#FFFFFF",
        black: "#000000",
        cobalt: {
          "100": "#E4E9FB",
          "500": "#2B4BDB",
          "600": "#2340C4",
        },
        green: {
          "100": "#E3F3EA",
          "500": "#2E8B57",
          "600": "#1F7A45",
        },
        amber: {
          "100": "#FBF1DC",
          "500": "#B7791F",
          "600": "#8A5A10",
        },
        red: {
          "100": "#FBE5E2",
          "500": "#C2372B",
          "600": "#B5321F",
        },
        "surface-page": "#EEF3F8",
        surface: "#FFFFFF",
        "surface-muted": "#EEF2F6",
        "surface-accent": "#E4E9FB",
        "surface-inverse": "#2F3A45",
        border: "#D9E1EA",
        "border-soft": "#E4EAF1",
        "border-hairline": "#EEF2F6",
        "border-input": "#C9D3DE",
        "text-primary": "#2F3A45",
        "text-secondary": "#56626E",
        "text-tertiary": "#66737F",
        "text-placeholder": "#7C8894",
        "text-inverse": "#FFFFFF",
        "text-accent": "#2B4BDB",
        "text-success": "#1F7A45",
        "text-warning": "#8A5A10",
        "text-danger": "#B5321F",
        "action-primary": "#2B4BDB",
        "action-primary-hover": "#2340C4",
        "action-on-primary": "#FFFFFF",
        "action-danger": "#C2372B",
        ink: "#2F3A45",
        "ink-2": "#56626E",
        "ink-3": "#66737F",
        "ink-placeholder": "#7C8894",
        action: "#2B4BDB",
        "action-hover": "#2340C4",
      },
      spacing: {
        "1": "4px",
        "2": "8px",
        "3": "12px",
        "4": "16px",
        "5": "20px",
        "6": "24px",
        "8": "32px",
        "10": "40px",
        "12": "48px",
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SF Mono", "Menlo", "monospace"],
      },
      fontSize: {
        xs: "12px",
        sm: "13px",
        md: "14px",
        base: "14px",
        lg: "16px",
        xl: "20px",
        "2xl": "24px",
        "3xl": "30px",
        "4xl": "40px",
        DEFAULT: "14px",
      },
      fontWeight: {
        regular: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
      },
      lineHeight: {
        tight: "1.1",
        snug: "1.25",
        body: "1.55",
      },
      letterSpacing: {
        tight: "-0.045em",
        snug: "-0.02em",
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        full: "999px",
        DEFAULT: "8px",
      },
      boxShadow: {
        card: "0px 8px 24px -16px rgba(47,58,69,0.25)",
        pop: "0px 20px 50px -20px rgba(47,58,69,0.35)",
      },
      backgroundImage: {
        frost: "linear-gradient(115deg, #DCE6F0 0%, #EEF3F8 45%, #FFFFFF 100%)",
      },
      ringColor: {
        DEFAULT: "rgba(43, 75, 219, 0.35)",
      },
      ringWidth: {
        DEFAULT: "3px",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.2, 0.7, 0.3, 1)",
      },
      transitionDuration: {
        fast: "120ms",
        base: "200ms",
        slow: "320ms",
        DEFAULT: "200ms",
      },
    },
  },
};
