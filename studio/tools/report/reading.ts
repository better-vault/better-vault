/**
 * Where the reader is in a document, from the scroll position. Pure, so the
 * contents panel stays simple and this is easy to test.
 */

/**
 * The heading being read: the last one whose top has passed `line` (the
 * scroll position plus an offset). At the very end of the document, the last
 * heading, even if it never reaches the line. -1 before the first heading.
 */
export function activeHeading(tops: readonly number[], line: number, atEnd: boolean): number {
  if (tops.length === 0) return -1;
  if (atEnd) return tops.length - 1;
  let active = -1;
  for (let index = 0; index < tops.length; index++) {
    if (tops[index] <= line + 1) active = index;
    else break;
  }
  return active;
}

/** How much of the document has been read, from 0 to 1. */
export function readingProgress(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
): number {
  const range = scrollHeight - clientHeight;
  if (range <= 0) return 1;
  return Math.min(1, Math.max(0, scrollTop / range));
}

/**
 * How far to scroll a list so a row is fully visible, with a margin; the
 * current position when it already is.
 */
export function scrollToShow(
  rowTop: number,
  rowHeight: number,
  listScrollTop: number,
  listHeight: number,
  margin = 12,
): number {
  if (rowTop - margin < listScrollTop) return Math.max(0, rowTop - margin);
  if (rowTop + rowHeight + margin > listScrollTop + listHeight)
    return rowTop + rowHeight + margin - listHeight;
  return listScrollTop;
}
