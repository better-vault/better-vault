import { useCallback, useEffect, useRef, useState } from "react";
import {
  activeModel,
  contextCharsFor,
  credentialsFor,
  effortFor,
  getSettings,
  useSettings,
} from "@/lib/db/settings";
import { getChunks, listSources } from "@/lib/db/sources";
import { selectPassages, type Passage } from "@/lib/grounding/passages";
import type { Size } from "../actions";
import type { Point } from "../geometry";
import { newId } from "../scene";
import { emptyBoard, type BoardElement, type BoardFile } from "../schema";
import { boardSvg } from "../export";
import { exportFonts, resolveBoardPalette } from "../export-browser";
import { svgToPng } from "@/studio/exports/image";
import type { BoardModel } from "../use-board";
import { toScreen, toWorld } from "../viewport";
import { createAnimator, type Animator } from "./animator";
import { answerOrigin, BoardLayout } from "./layout";
import { boardItem } from "./schema";

export type AskStatus = "idle" | "thinking" | "writing";

/** The selection as a PNG, so the model sees drawings as well as words. */
async function selectionPicture(
  elements: readonly BoardElement[],
  files: Record<string, BoardFile>,
): Promise<string | undefined> {
  try {
    const data = { ...emptyBoard(), elements: [...elements], files };
    const palette = resolveBoardPalette();
    const { svg, width, height } = boardSvg(data, palette, await exportFonts(data));
    const scale = Math.min(2, 1600 / Math.max(width, height, 1));
    const blob = await svgToPng(svg, width, height, scale, palette.background);
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

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
export function useAskAi(board: BoardModel, size: () => Size, notebookId?: string) {
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
    async (question: string, selection?: readonly BoardElement[]) => {
      stop();
      setError(null);
      const current = boardRef.current;
      const about = selection?.length ? selection : null;
      const saved = await getSettings();
      const chosen = activeModel(saved);
      if (!chosen) return;

      // Where the answer goes, and a view that shows its start.
      const view = current.view ?? { x: 0, y: 0, zoom: 1 };
      const zoom = Math.min(1.1, Math.max(0.75, view.zoom));
      const corner = toWorld([80, 160], { ...view, zoom });
      // About a selection: beside it. Otherwise beside everything on the board.
      const [ox, oy] = answerOrigin(
        current.latestRef.current.elements,
        corner,
        about ?? current.latestRef.current.elements,
      );
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

      // The notebook's selected sources, as the chat reads them: the passages
      // that best match the question, within the model's context budget.
      let passages: Passage[] = [];
      if (notebookId) {
        const sources = (await listSources(notebookId)).filter((source) => source.selected);
        if (sources.length)
          passages = selectPassages({
            sources,
            chunks: await getChunks(sources.map((source) => source.id)),
            budget: Math.min(60_000, contextCharsFor(saved, chosen.provider)),
            query: [question, about ? boardText(about) : ""].join(" "),
          });
      }

      try {
        const response = await fetch("/api/whiteboard/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            board: boardText(before.elements),
            passages,
            ...(about
              ? {
                  selection: {
                    text: boardText(about),
                    image: await selectionPicture(about, before.files),
                  },
                }
              : {}),
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
    [notebookId, stop],
  );

  return { status, pen, error, ask, stop, ready: model !== null, settings };
}
