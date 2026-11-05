export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface RGBA extends RGB {
  /** 0–1 */
  a: number;
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

export const rgb = (r: number, g: number, b: number): RGB => ({ r, g, b });

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

// Björn Ottosson's Oklab matrices, verbatim.

interface Lab {
  L: number;
  a: number;
  b: number;
}

function srgbToOklab({ r, g, b }: RGB): Lab {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

function oklabToSrgb({ L, a, b }: Lab): RGB {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return {
    r: clamp01(linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    g: clamp01(linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    b: clamp01(linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
  };
}

const NAMED: Record<string, RGBA> = {
  white: { r: 1, g: 1, b: 1, a: 1 },
  black: { r: 0, g: 0, b: 0, a: 1 },
  transparent: { r: 0, g: 0, b: 0, a: 0 },
};

// `none` (CSS Color 4) appears in Tailwind's palette, e.g. `oklch(26.9% 0 none)`, and reads as 0
function num(token: string, full = 1): number {
  const t = token.trim();
  if (t === "none") return 0;
  return t.endsWith("%") ? (parseFloat(t) / 100) * full : parseFloat(t);
}

const comp = (token: string): number => (token.trim() === "none" ? 0 : parseFloat(token));

function args(src: string): string[] {
  return src
    .replace(/^[a-z]+\(/i, "")
    .replace(/\)$/, "")
    .split(/[\s,]+/)
    .filter(Boolean);
}

export function parseColor(input: string): RGBA | null {
  const css = input.trim();
  if (NAMED[css.toLowerCase()]) return { ...NAMED[css.toLowerCase()] };

  if (css.startsWith("#")) {
    const hex = css.slice(1);
    const wide = hex.length > 4;
    const size = wide ? 2 : 1;
    const at = (i: number) => {
      const part = hex.substr(i * size, size);
      return parseInt(wide ? part : part + part, 16) / 255;
    };
    if (hex.length !== 3 && hex.length !== 4 && hex.length !== 6 && hex.length !== 8) return null;
    return {
      r: at(0),
      g: at(1),
      b: at(2),
      a: hex.length === 4 || hex.length === 8 ? at(3) : 1,
    };
  }

  const fn = css.slice(0, css.indexOf("(")).toLowerCase();
  const parts = args(css).filter((p) => p !== "/");
  // the slash may be glued to a token
  const flat = args(css.replace(/\//g, " / "));
  const slash = flat.indexOf("/");
  const alpha = slash === -1 ? 1 : num(flat[slash + 1]);
  const c = slash === -1 ? parts : flat.slice(0, slash);

  if (fn === "rgb" || fn === "rgba")
    return {
      r: clamp01(num(c[0], 255) / (c[0].includes("%") ? 1 : 255)),
      g: clamp01(num(c[1], 255) / (c[1].includes("%") ? 1 : 255)),
      b: clamp01(num(c[2], 255) / (c[2].includes("%") ? 1 : 255)),
      a: c.length > 3 ? num(c[3]) : alpha,
    };

  if (fn === "oklch") {
    const L = num(c[0]);
    const C = comp(c[1]);
    const h = (comp(c[2]) * Math.PI) / 180;
    return {
      ...oklabToSrgb({ L, a: C * Math.cos(h), b: C * Math.sin(h) }),
      a: alpha,
    };
  }

  if (fn === "oklab")
    return {
      ...oklabToSrgb({ L: num(c[0]), a: comp(c[1]), b: comp(c[2]) }),
      a: alpha,
    };

  return null;
}

export function formatHex({ r, g, b }: RGB): string {
  const h = (n: number) =>
    Math.round(clamp01(n) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** `color-mix(in srgb, a <weightA>, b)`; alpha travels with the mix. */
export function mixSrgb(a: RGBA, b: RGBA, weightA: number): RGBA {
  const w = clamp01(weightA);
  const lerp = (x: number, y: number) => x * w + y * (1 - w);
  return {
    r: lerp(a.r, b.r),
    g: lerp(a.g, b.g),
    b: lerp(a.b, b.b),
    a: lerp(a.a, b.a),
  };
}

/** `color-mix(in oklab, a <weightA>, b)`. */
export function mixOklab(a: RGBA, b: RGBA, weightA: number): RGBA {
  const w = clamp01(weightA);
  const A = srgbToOklab(a);
  const B = srgbToOklab(b);
  return {
    ...oklabToSrgb({
      L: A.L * w + B.L * (1 - w),
      a: A.a * w + B.a * (1 - w),
      b: A.b * w + B.b * (1 - w),
    }),
    a: a.a * w + b.a * (1 - w),
  };
}

/** Source-over: a translucent layer painted on an opaque backdrop. */
export function over(layer: RGBA, backdrop: RGB): RGB {
  const a = clamp01(layer.a);
  return {
    r: layer.r * a + backdrop.r * (1 - a),
    g: layer.g * a + backdrop.g * (1 - a),
    b: layer.b * a + backdrop.b * (1 - a),
  };
}

/** WCAG 2.x relative luminance. */
function relativeLuminance({ r, g, b }: RGB): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** WCAG 2.x contrast ratio, 1–21. Order-independent. */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG 2.2 AA for body text. */
export const AA_NORMAL_TEXT = 4.5;
/** WCAG 2.2 AA for large text and non-text contrast. */
export const AA_LARGE_TEXT = 3;
