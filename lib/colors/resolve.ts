/**
 * Theme colours as plain hex, for files made in the browser (PowerPoint,
 * exported drawings), which can't read CSS variables or oklch().
 */

let canvas: HTMLCanvasElement | null = null;

/** Any CSS colour (a variable, oklch(), color-mix()…) as "#rrggbb", read inside `scope`. */
export function resolveCssColor(css: string, scope: Element = document.body): string {
  const probe = document.createElement("span");
  probe.style.color = css;
  probe.style.display = "none";
  scope.append(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  canvas ??= document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return "#000000";
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = computed;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

/** Runs `read` inside a hidden element with the light theme's colours, even in dark mode. */
export function withLightScope<T>(read: (scope: Element) => T): T {
  const scope = document.createElement("div");
  scope.className = "theme-light";
  scope.style.display = "none";
  document.body.append(scope);
  try {
    return read(scope);
  } finally {
    scope.remove();
  }
}
