const loading = new Map<string, Promise<void>>();

/**
 * Loads a script once. Every caller waits for the same load, even while it
 * is still running, and a failed load is forgotten (its tag removed) so the
 * next try starts again instead of failing until the page is reloaded.
 */
export function loadScript(src: string, error: string): Promise<void> {
  const known = loading.get(src);
  if (known) return known;
  const load = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      loading.delete(src);
      reject(new Error(error));
    };
    document.head.appendChild(script);
  });
  loading.set(src, load);
  return load;
}
