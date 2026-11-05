import { contrastRatio, formatHex, parseColor, type RGB, type RGBA } from "../lib/color";

let ctx: CanvasRenderingContext2D | null | undefined;

/** Any CSS color the browser can paint (lab(), color-mix(), …) → RGBA, via a 1px readback. */
export function resolveColor(css: string): RGBA | null {
  const direct = parseColor(css);
  if (direct) return direct;
  if (!css) return null;
  if (ctx === undefined) {
    ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    if (ctx) {
      ctx.canvas.width = 1;
      ctx.canvas.height = 1;
    }
  }
  if (!ctx) return null;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = "rgba(1, 2, 3, 0.5)";
  const sentinel = ctx.fillStyle;
  ctx.fillStyle = css;
  if (ctx.fillStyle === sentinel && css.trim() !== "rgba(1, 2, 3, 0.5)") return null;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  // premultiplied readback: un-premultiply so translucent layers composite correctly
  const alpha = a / 255;
  if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 };
  // the color lib works in 0–1
  const ch = (v: number) => Math.min(1, v / 255 / alpha);
  return { r: ch(r), g: ch(g), b: ch(b), a: alpha };
}

export function hex(c: RGB | RGBA | null): string {
  return c ? formatHex(c) : "—";
}

/** `layer` composited over an opaque `backdrop`. */
export function composite(layer: RGBA, backdrop: RGB): RGB {
  const a = layer.a ?? 1;
  return {
    r: layer.r * a + backdrop.r * (1 - a),
    g: layer.g * a + backdrop.g * (1 - a),
    b: layer.b * a + backdrop.b * (1 - a),
  };
}

export function contrastLabel(fg: RGB | null, bg: RGB | null): string {
  if (!fg || !bg) return "—";
  const r = contrastRatio(fg, bg);
  const grade = r >= 7 ? "AAA" : r >= 4.5 ? "AA" : r >= 3 ? "AA large" : "fail";
  return `${r.toFixed(2)}:1 ${grade}`;
}

/** The background behind the calendar, opaque. `root` is the calendar's own element when known. */
export function pageBackground(root?: HTMLElement | null): RGB {
  const el = root ?? document.querySelector<HTMLElement>("[data-kloq-root]") ?? document.body;
  const bg = resolveColor(getComputedStyle(el).backgroundColor);
  if (bg && (bg.a ?? 1) > 0.99) return bg;
  const body = resolveColor(getComputedStyle(document.body).backgroundColor);
  const base = body && (body.a ?? 1) > 0.99 ? body : { r: 255, g: 255, b: 255 };
  return bg ? composite(bg, base) : base;
}
