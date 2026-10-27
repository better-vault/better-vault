"use client";

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { strokeCss } from "./palette";
import type { ElementOf } from "./schema";
import { fontFamily, LINE_HEIGHT, measureText } from "./text";
import type { BoardModel } from "./use-board";

/**
 * Typing on the board: a textarea laid exactly over the text it edits,
 * following the zoom and the text's turn. The text grows as it is typed,
 * from its start, centre or end depending on its alignment.
 */
export function TextEditor({
  board,
  element,
  onDone,
}: {
  board: BoardModel;
  element: ElementOf<"text">;
  onDone: () => void;
}) {
  const { t } = useTranslation("studio");
  const input = useRef<HTMLTextAreaElement>(null);
  const view = board.view ?? { x: 0, y: 0, zoom: 1 };
  const { setElements } = board;
  const { id, font, fontSize } = element;

  useEffect(() => {
    const textarea = input.current;
    if (!textarea) return;
    textarea.focus({ preventScroll: true });
    textarea.select();
  }, []);

  // Fonts may finish loading after the text was measured.
  useEffect(() => {
    let live = true;
    void document.fonts?.ready.then(() => {
      if (!live) return;
      setElements((list) =>
        list.map((item) =>
          item.id === id && item.type === "text"
            ? { ...item, ...measureText(item.text, item.font, item.fontSize) }
            : item,
        ),
      );
    });
    return () => {
      live = false;
    };
  }, [id, font, fontSize, setElements]);

  function type(text: string) {
    setElements((list) =>
      list.map((item) => {
        if (item.id !== element.id || item.type !== "text") return item;
        const size = measureText(text, item.font, item.fontSize);
        const shift =
          item.align === "center"
            ? (item.width - size.width) / 2
            : item.align === "end"
              ? item.width - size.width
              : 0;
        return { ...item, text, x: item.x + shift, ...size };
      }),
    );
  }

  const zoom = view.zoom;
  const degrees = (element.angle * 180) / Math.PI;

  return (
    <textarea
      ref={input}
      aria-label={t("whiteboard.textLabel")}
      value={element.text}
      dir="auto"
      wrap="off"
      spellCheck
      onChange={(event) => type(event.target.value)}
      onBlur={onDone}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape" || (event.key === "Enter" && (event.metaKey || event.ctrlKey))) {
          event.preventDefault();
          onDone();
        }
      }}
      className="absolute m-0 resize-none overflow-hidden border-0 bg-transparent p-0 whitespace-pre outline-none"
      style={{
        left: view.x + element.x * zoom,
        top: view.y + element.y * zoom,
        width: (element.width + element.fontSize) * zoom,
        height: element.height * zoom,
        fontFamily: fontFamily[element.font],
        fontSize: element.fontSize * zoom,
        lineHeight: LINE_HEIGHT,
        color: strokeCss(element.stroke),
        opacity: element.opacity / 100,
        textAlign: element.align,
        transform: degrees ? `rotate(${degrees}deg)` : undefined,
        transformOrigin: `${(element.width / 2) * zoom}px ${(element.height / 2) * zoom}px`,
        caretColor: strokeCss(element.stroke),
      }}
    />
  );
}
