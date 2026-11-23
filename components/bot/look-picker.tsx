import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { botColor, botColorKeys } from "@/lib/bot/colors";
import { botLook, faceItems, headItems, neckItems } from "@/lib/bot/look";
import type { BotAvatar as BotLook } from "@/lib/db/types";
import { cn } from "@/lib/utils";
import { BotAvatar } from "./bot-avatar";

/** Headwear, face, neck and colour for a character, each a row that scrolls sideways. */
export function LookPicker({
  avatar,
  onChange,
}: {
  avatar: BotLook;
  onChange: (avatar: BotLook) => void;
}) {
  const { t } = useTranslation("bot");
  return (
    <>
      <LookRow
        slot="head"
        items={headItems}
        avatar={avatar}
        onChoose={(head) => onChange({ ...avatar, head })}
      />
      <LookRow
        slot="face"
        items={faceItems}
        avatar={avatar}
        onChoose={(face) => onChange({ ...avatar, face })}
      />
      <LookRow
        slot="neck"
        items={neckItems}
        avatar={avatar}
        onChoose={(neck) => onChange({ ...avatar, neck })}
      />
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t("editor.color")}</legend>
        <div className={rowScroll} style={rowFade}>
          <div
            className="flex w-max gap-2 px-2 py-1.5"
            role="radiogroup"
            aria-label={t("editor.color")}
          >
            {botColorKeys.map((color) => (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={avatar.color === color}
                aria-label={t(`colors.${color}`)}
                title={t(`colors.${color}`)}
                onClick={() => onChange({ ...avatar, color })}
                style={{ background: botColor(color).body }}
                className={cn(
                  "size-7 shrink-0 cursor-pointer rounded-full ring-offset-2 ring-offset-popover outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  avatar.color === color && "ring-2 ring-foreground",
                )}
              />
            ))}
          </div>
        </div>
      </fieldset>
    </>
  );
}

const rowScroll =
  "-mx-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
// The trailing edge fades, so a row that goes on looks like it does.
const rowFade: CSSProperties = {
  maskImage: "linear-gradient(to right, black calc(100% - 2rem), transparent)",
};

function LookRow<Item extends string>({
  slot,
  items,
  avatar,
  onChoose,
}: {
  slot: "head" | "face" | "neck";
  items: readonly Item[];
  avatar: BotLook;
  onChoose: (item: Item) => void;
}) {
  const { t } = useTranslation("bot");
  const current = botLook(avatar)[slot];
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{t(`look.${slot}`)}</legend>
      <div className={cn(rowScroll, "-my-3")} style={rowFade}>
        <div
          className="flex w-max gap-1 px-1 py-3"
          role="radiogroup"
          aria-label={t(`look.${slot}`)}
        >
          {items.map((item) => (
            <button
              key={item}
              type="button"
              role="radio"
              aria-checked={current === item}
              aria-label={t(`look.items.${item}` as "look.items.none")}
              title={t(`look.items.${item}` as "look.items.none")}
              onClick={() => onChoose(item)}
              style={
                current === item
                  ? ({ "--bot-surface": "var(--muted)" } as CSSProperties)
                  : undefined
              }
              className={cn(
                "flex size-14 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                current === item && "bg-muted ring-1 ring-foreground/20",
              )}
            >
              <BotAvatar avatar={{ ...avatar, [slot]: item }} size={44} still />
            </button>
          ))}
        </div>
      </div>
    </fieldset>
  );
}
