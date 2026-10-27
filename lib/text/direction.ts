/** Whether a text is mostly in a right-to-left script (Arabic, Hebrew, Syriac, Thaana). */
export function isRightToLeft(text: string): boolean {
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  const rtl =
    text.match(/[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}]/gu)
      ?.length ?? 0;
  return letters > 0 && rtl / letters > 0.3;
}
