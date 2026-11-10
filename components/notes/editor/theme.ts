import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

/**
 * The editor drawn with the app's tokens (src/styles/tokens.css), so it
 * follows light and dark mode and the accent. Logical properties keep it
 * right for right-to-left languages.
 */
export const notesTheme = EditorView.theme({
  "&": {
    height: "100%",
    color: "var(--foreground)",
    backgroundColor: "transparent",
    fontSize: "15px",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "inherit",
    lineHeight: "1.7",
    overflow: "auto",
  },
  ".cm-content": {
    maxWidth: "46rem",
    marginInline: "auto",
    paddingBlock: "1.5rem 40vh",
    paddingInline: "1.5rem",
    caretColor: "var(--foreground)",
  },
  ".cm-cursor": { borderInlineStartColor: "var(--foreground)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in oklab, var(--primary) 22%, transparent) !important",
  },
  ".cm-activeLine": { backgroundColor: "transparent" },
  ".cm-gutters": { display: "none" },
  ".cm-h": { fontWeight: "650", letterSpacing: "-0.01em" },
  ".cm-h1": { fontSize: "1.75em", lineHeight: "1.3", paddingBlockStart: "0.4em" },
  ".cm-h2": { fontSize: "1.4em", lineHeight: "1.35", paddingBlockStart: "0.35em" },
  ".cm-h3": { fontSize: "1.2em" },
  ".cm-h4, .cm-h5, .cm-h6": { fontSize: "1.05em" },
  ".cm-inline-code": {
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
    fontSize: "0.88em",
    backgroundColor: "var(--muted)",
    borderRadius: "0.3em",
    padding: "0.1em 0.3em",
  },
  ".cm-code-line": {
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
    fontSize: "0.88em",
    backgroundColor: "var(--muted)",
  },
  ".cm-wikilink": {
    color: "var(--primary)",
    cursor: "pointer",
    textDecoration: "underline",
    textDecorationColor: "color-mix(in oklab, var(--primary) 40%, transparent)",
    textUnderlineOffset: "3px",
  },
  ".cm-wikilink-missing": { opacity: "0.6", textDecorationStyle: "dashed" },
  ".cm-wikilink-embed": {
    display: "inline-block",
    border: "1px solid var(--border)",
    borderRadius: "0.5em",
    paddingInline: "0.45em",
    textDecoration: "none",
  },
  ".cm-wikilink-source": { color: "var(--primary)" },
  ".cm-tag": {
    color: "var(--primary)",
    backgroundColor: "color-mix(in oklab, var(--primary) 12%, transparent)",
    borderRadius: "999px",
    paddingInline: "0.4em",
  },
  ".cm-highlight": { backgroundColor: "color-mix(in oklab, var(--warning) 35%, transparent)" },
  ".cm-comment": { color: "var(--muted-foreground)", opacity: "0.7" },
  ".cm-bullet": { color: "var(--muted-foreground)", paddingInlineEnd: "0.2em" },
  ".cm-task": { marginInlineEnd: "0.35em", verticalAlign: "-1px", accentColor: "var(--primary)" },
  ".cm-task-done": { color: "var(--muted-foreground)", textDecoration: "line-through" },
  ".cm-callout": {
    backgroundColor: "color-mix(in oklab, var(--info) 10%, transparent)",
    borderInlineStart: "3px solid var(--info)",
    paddingInlineStart: "0.8em",
  },
  ".cm-callout[data-callout=warning], .cm-callout[data-callout=caution], .cm-callout[data-callout=danger]":
    {
      backgroundColor: "color-mix(in oklab, var(--warning) 12%, transparent)",
      borderInlineStartColor: "var(--warning)",
    },
  ".cm-callout[data-callout=tip], .cm-callout[data-callout=success], .cm-callout[data-callout=check]":
    {
      backgroundColor: "color-mix(in oklab, var(--success) 12%, transparent)",
      borderInlineStartColor: "var(--success)",
    },
  ".cm-callout-title": { fontWeight: "600" },
  ".cm-quote": {
    borderInlineStart: "3px solid var(--border)",
    paddingInlineStart: "0.8em",
    color: "var(--muted-foreground)",
  },
  ".cm-tooltip": {
    border: "1px solid var(--border)",
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground)",
    borderRadius: "0.75rem",
    overflow: "hidden",
  },
  ".cm-tooltip-autocomplete > ul > li": { padding: "0.3em 0.6em" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--accent)",
    color: "var(--accent-foreground)",
  },
  ".cm-completionDetail": {
    color: "var(--muted-foreground)",
    marginInlineStart: "0.6em",
    fontStyle: "normal",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--muted)",
    border: "none",
    color: "var(--muted-foreground)",
  },
  ".cm-panels": {
    backgroundColor: "var(--card)",
    color: "var(--foreground)",
    borderColor: "var(--border)",
  },
});

export const notesHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.strong, fontWeight: "700" },
    { tag: tags.emphasis, fontStyle: "italic" },
    { tag: tags.strikethrough, textDecoration: "line-through" },
    { tag: tags.link, color: "var(--primary)" },
    { tag: tags.url, color: "var(--muted-foreground)" },
    { tag: [tags.processingInstruction, tags.meta], color: "var(--muted-foreground)" },
    { tag: tags.quote, color: "var(--muted-foreground)" },
    { tag: tags.monospace, fontFamily: "var(--font-mono, ui-monospace, monospace)" },
    { tag: tags.list, color: "var(--muted-foreground)" },
    { tag: tags.contentSeparator, color: "var(--muted-foreground)" },
  ]),
);
