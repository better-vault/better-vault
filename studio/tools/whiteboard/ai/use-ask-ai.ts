import { useCallback, useEffect, useRef, useState } from "react";
import {
  activeModel,
  credentialsFor,
  effortFor,
  getSettings,
  isProviderReady,
  useSettings,
} from "@/lib/db/settings";
import type { Size } from "../actions";
import type { Point } from "../geometry";
import { newId } from "../scene";
import type { BoardElement } from "../schema";
import type { BoardModel } from "../use-board";
import { toScreen, toWorld } from "../viewport";
import { createAnimator, type Animator } from "./animator";
import { answerOrigin, BoardLayout } from "./layout";
import { boardItem } from "./schema";

export type AskStatus = "idle" | "thinking" | "writing";

/** What is written on the board already, for the model to build on. */
function boardText(elements: readonly BoardElement[]) {
  return elements
    .flatMap((element) => (element.type === "text" ? [element.text] : []))
    .join("\n")
    .slice(0, 8000);
}

/**
 * "Ask AI" on a board: sends the question, lays the answer out as it
 * streams in, and writes it by hand. When it is done the whole answer is one
 * group and one undo step, saved like any other change.
 */
export function useAskAi(board: BoardModel, size: () => Size) {
  const settings = useSettings();
  const model = settings ? activeModel(settings) : null;
  const [status, setStatus] = useState<AskStatus>("idle");
  const [pen, setPen] = useState<Point | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = useRef<{ animator: Animator; abort: AbortController } | null>(null);
  const boardRef = useRef(board);
  useEffect(() => {
    boardRef.current = board;
  });

  // Follow the pen: when it nears the bottom or the end of the view, the view glides on.
  useEffect(() => {
    if (!pen) return;
    const { view, setView } = boardRef.current;
    if (!view) return;
    const { width, height } = size();
    const [sx, sy] = toScreen(pen, view);
    // Below the toolbar at the top, above the Ask field at the foot.
    const dy = sy > height - 130 ? sy - (height - 130) : sy < 150 ? sy - 150 : 0;
    const dx = sx > width - 80 ? sx - (width - 80) : sx < 60 ? sx - 60 : 0;
    if (dx || dy) setView({ ...view, x: view.x - dx * 0.2, y: view.y - dy * 0.2 });
  }, [pen, size]);

  const stop = useCallback(() => {
    run.current?.abort.abort();
    run.current?.animator.stop();
    run.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const ask = useCallback(
    async (question: string) => {
      stop();
      setError(null);
      const current = boardRef.current;
      const saved = await getSettings();
      const chosen = activeModel(saved);
      if (!chosen) return;

      // Where the answer goes, and a view that shows its start.
      const view = current.view ?? { x: 0, y: 0, zoom: 1 };
      const zoom = Math.min(1.1, Math.max(0.75, view.zoom));
      const corner = toWorld([80, 160], { ...view, zoom });
      const [ox, oy] = answerOrigin(current.latestRef.current.elements, corner);
      current.setView({ zoom, x: 80 - ox * zoom, y: 160 - oy * zoom });

      const before = current.latestRef.current;
      const group = newId();
      const layout = new BoardLayout(ox, oy);
      const abort = new AbortController();
      const animator = createAnimator({
        put: (element) =>
          boardRef.current.setElements((list) => {
            const at = list.findIndex((each) => each.id === element.id);
            if (at === -1) return [...list, element];
            const next = list.slice();
            next[at] = element;
            return next;
          }),
        pen: setPen,
        done: (written) => {
          if (written.length) boardRef.current.record(before);
          setStatus("idle");
          if (run.current?.animator === animator) run.current = null;
        },
      });
      run.current = { animator, abort };
      setStatus("thinking");

      try {
        const response = await fetch("/api/whiteboard/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            board: boardText(before.elements),
            model: chosen,
            credentials: credentialsFor(saved, chosen.provider),
            effort: effortFor(saved, chosen.provider),
          }),
          signal: abort.signal,
        });
        if (!response.ok || !response.body) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? response.statusText);
        }
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const message = JSON.parse(line) as { item?: unknown; error?: string };
            if (message.error) throw new Error(message.error);
            const item = boardItem.safeParse(message.item);
            if (!item.success) continue;
            setStatus("writing");
            animator.add(
              layout.place(item.data).map((op) => ({
                ...op,
                element: { ...op.element, groupIds: [group] },
              })) as never,
            );
          }
        }
        animator.finish();
      } catch (failure) {
        if (abort.signal.aborted) return;
        animator.stop();
        setError(failure instanceof Error ? failure.message : String(failure));
        setStatus("idle");
      }
    },
    [stop],
  );

  return { status, pen, error, ask, stop, ready: model !== null, settings };
}

/** Which provider can turn speech into text with the user's keys, if any. */
export function voiceProvider(settings: ReturnType<typeof useSettings>) {
  if (!settings) return null;
  for (const id of ["openai", "elevenlabs"] as const) {
    if (isProviderReady(settings, id) && settings.providers[id].apiKey)
      return { provider: id, apiKey: settings.providers[id].apiKey };
  }
  return null;
}
