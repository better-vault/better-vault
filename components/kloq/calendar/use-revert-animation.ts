import { useCallback } from "react";
import { announceReverted } from "../lib/announce";
import { entriesFor } from "../lib/recurrence";
import { ms, prefersReducedMotion, SPRING, SPRING_MS } from "../lib/springs";
import type { Announce } from "./live-region";

export function useRevertAnimation({
  registry,
  announce,
  eventOf,
}: {
  registry: Map<string, HTMLElement>;
  announce: Announce;
  eventOf: (id: string) => { title?: string };
}) {
  return useCallback(
    (ids: string[]) => {
      // assertive: with reduced motion the shake is gone and this is the only signal
      announce(announceReverted(ids.map((id) => eventOf(id))), "assertive");
      if (prefersReducedMotion()) return;
      // keyed by placement id (one event, many nodes); `preLead` covers ids changed by the revert
      const pre = new Map<string, DOMRect>();
      const preLead = new Map<string, DOMRect>();
      for (const id of ids) {
        for (const [key, node] of entriesFor(registry, id)) {
          const rect = node.getBoundingClientRect();
          pre.set(key, rect);
          if (!preLead.has(id)) preLead.set(id, rect);
        }
      }
      // double rAF: the revert has re-rendered by the second frame
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          for (const id of ids)
            for (const [key, node] of entriesFor(registry, id)) {
              const old = pre.get(key) ?? preLead.get(id);
              const shake = () =>
                node.animate(
                  [
                    { transform: "translateX(0)" },
                    { transform: "translateX(-5px)" },
                    { transform: "translateX(4px)" },
                    { transform: "translateX(-2px)" },
                    { transform: "translateX(0)" },
                  ],
                  { duration: ms(260), easing: "ease-out" },
                );
              if (!old) {
                shake();
                continue;
              }
              const now = node.getBoundingClientRect();
              const dx = old.left - now.left;
              const dy = old.top - now.top;
              const sy = now.height > 0 ? old.height / now.height : 1;
              if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sy - 1) < 0.01) {
                shake();
                continue;
              }
              const anim = node.animate(
                [
                  {
                    transform: `translate(${dx}px, ${dy}px) scaleY(${sy})`,
                    transformOrigin: "left top",
                  },
                  { transform: "none", transformOrigin: "left top" },
                ],
                { duration: SPRING_MS, easing: SPRING },
              );
              anim.onfinish = shake;
            }
        }),
      );
    },
    [registry, announce, eventOf],
  );
}
