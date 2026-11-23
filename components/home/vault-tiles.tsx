import {
  Archive01Icon,
  File01Icon,
  Image01Icon,
  MusicNote01Icon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconSvgElement } from "@/components/icon";
import { sourceFormatIcons } from "@/components/sources/source-format";
import type { FileKind } from "@/lib/files/kinds";
import { cn } from "@/lib/utils";

/**
 * The Vault page's tiles. A folder is a frosted pocket with sheets of paper
 * peeking out of it, which rise when you point at it; badges at its foot
 * show the kinds of file it holds. A single file is one sheet in the same
 * frame. Colours are the `--vault-*` tokens, so both follow the theme.
 */

/** Brand marks for the formats that have one (public/formats, from theSVG). */
const marks: Partial<Record<FileKind, string>> = {
  docx: "/formats/microsoft-word.svg",
  xlsx: "/formats/microsoft-excel.svg",
  pptx: "/formats/microsoft-powerpoint.svg",
  pdf: "/formats/pdf.svg",
  markdown: "/formats/markdown.svg",
  html: "/formats/html5.svg",
  youtube: "/formats/youtube.svg",
  json: "/formats/json.svg",
};

const kindIcons: Record<Exclude<FileKind, keyof typeof sourceFormatIcons>, IconSvgElement> = {
  image: Image01Icon,
  audio: MusicNote01Icon,
  video: Video01Icon,
  archive: Archive01Icon,
  other: File01Icon,
};

export function kindIcon(kind: FileKind): IconSvgElement {
  return kind in sourceFormatIcons
    ? sourceFormatIcons[kind as keyof typeof sourceFormatIcons]
    : kindIcons[kind as keyof typeof kindIcons];
}

/** A round badge for one kind of file: its brand mark on white, or its icon on ink. */
export function KindBadge({
  kind,
  className,
  style,
  bare = false,
}: {
  kind: FileKind;
  className?: string;
  style?: CSSProperties;
  /** Just the mark, with no disc behind it: for the tiles' corner. */
  bare?: boolean;
}) {
  const mark = marks[kind];
  if (bare)
    return (
      <span
        style={style}
        className={cn(
          "flex aspect-square items-center justify-center drop-shadow-[0_1px_2px_oklch(0_0_0/0.45)]",
          className,
        )}
      >
        {mark ? (
          <img
            src={mark}
            alt=""
            draggable={false}
            // The Markdown mark is drawn in black; on dark surfaces it is drawn in white.
            className={cn("size-full object-contain", kind === "markdown" && "dark:invert")}
          />
        ) : (
          <Icon
            icon={kindIcon(kind)}
            strokeWidth={1.6}
            className="size-full text-(--vault-sheet)"
          />
        )}
      </span>
    );
  return (
    <span
      style={style}
      className={cn(
        "flex aspect-square items-center justify-center rounded-full shadow-[0_1px_3px_oklch(0_0_0/0.35)]",
        mark
          ? "bg-(--vault-sheet)"
          : "bg-foreground text-background dark:bg-background dark:text-foreground",
        className,
      )}
    >
      {mark ? (
        <img src={mark} alt="" draggable={false} className="h-[52%] w-[52%] object-contain" />
      ) : (
        <Icon icon={kindIcon(kind)} className="h-[52%] w-[52%]" />
      )}
    </span>
  );
}

/**
 * The frosted pocket's outline, as a polygon in percentages so it scales with
 * the tile. (A polygon, unlike an SVG mask, scales with the tile in every browser.)
 */
const pocketMask: CSSProperties = {
  clipPath: `polygon(${[
    [0, 26],
    [0.45, 21.5],
    [1.95, 18.6],
    [4.1, 17],
    [6.77, 16.5],
    [45.1, 16.5],
    [48.1, 16.8],
    [50.75, 18.3],
    [53.4, 22],
    [55.6, 26.5],
    [57.1, 28.6],
    [59, 29.3],
    [61.65, 29.5],
    [93.2, 29.5],
    [96.6, 30.1],
    [98.8, 32.5],
    [99.85, 35.5],
    [100, 38.5],
    [100, 100],
    [0, 100],
  ]
    .map(([x, y]) => `${x}% ${y}%`)
    .join(", ")})`,
};

/** Where each sheet sits in the folder, and how it leans. */
const sheets = [
  { left: "3.5%", top: "3.5%", width: "37%", height: "42%", turn: "-2.5deg" },
  { left: "37%", top: "8.5%", width: "35%", height: "38%", turn: "1deg" },
  { left: "68%", top: "12.5%", width: "28.5%", height: "34%", turn: "2.5deg" },
];

/** The frame every tile shares: a soft translucent card, rounded like the reference. */
function Frame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "vault-frame relative block aspect-[4/3] w-full overflow-hidden bg-(--vault-back) ring-1 ring-foreground/8",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A folder (or a notebook): sheets for what it holds, a frosted pocket, and badges. */
export function FolderArt({
  kinds,
  count,
  tint,
  mark,
}: {
  /** The kinds of file inside, most common first; the first two get badges. */
  kinds: FileKind[];
  /** How many things it holds: up to three sheets show. */
  count: number;
  /** A colour token to tint the pocket with (the folder's or notebook's colour). */
  tint?: string;
  /** An icon pressed into the pocket, for notebooks. */
  mark?: IconSvgElement;
}) {
  const shown = sheets.slice(0, Math.min(3, Math.max(count, kinds.length > 0 ? 1 : 0)));
  return (
    <Frame>
      {shown.map((sheet, at) => (
        <span
          key={at}
          className="vault-sheet absolute flex items-start bg-(--vault-sheet) p-[5%] shadow-[0_1px_2px_oklch(0_0_0/0.25)]"
          style={
            {
              left: sheet.left,
              top: sheet.top,
              width: sheet.width,
              height: sheet.height,
              "--turn": sheet.turn,
              "--delay": `${at * 45}ms`,
            } as CSSProperties
          }
        >
          <Icon
            icon={kindIcon(kinds[at % Math.max(kinds.length, 1)] ?? "other")}
            strokeWidth={1.4}
            className="ms-[4%] mt-[6%] h-[46%] w-auto text-(--vault-sheet-ink)"
          />
        </span>
      ))}
      <span
        className="absolute inset-0"
        style={{
          ...pocketMask,
          // The folder's own colour, as chosen when it was made, as frosted glass: the
          // sheets behind show through, blurred. Lighter at the top, deeper at the foot.
          background: tint
            ? `radial-gradient(120% 85% at 45% 22%, color-mix(in oklch, color-mix(in oklch, var(--${tint}) 88%, var(--vault-sheet)) 74%, transparent), color-mix(in oklch, color-mix(in oklch, var(--${tint}) 80%, var(--vault-shade)) 84%, transparent) 80%)`
            : "radial-gradient(120% 85% at 45% 22%, var(--vault-front-from), var(--vault-front-to) 78%)",
          backdropFilter: "blur(9px) saturate(1.5)",
          WebkitBackdropFilter: "blur(9px) saturate(1.5)",
        }}
      />
      {/* A thin light edge along the pocket's top, like the reference's sheen. */}
      <span
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/18 via-transparent to-transparent"
        style={pocketMask}
      />
      {mark ? (
        <Icon
          icon={mark}
          strokeWidth={1.6}
          className="absolute end-[7%] bottom-[9%] size-[17%] text-white/55"
        />
      ) : null}
      <Badges kinds={kinds} />
    </Frame>
  );
}

/** One file: a single sheet of paper with a folded corner, rising out of the frame. */
export function FileArt({ kind }: { kind: FileKind }) {
  return (
    <Frame>
      <span
        className="vault-sheet absolute start-[21%] top-[9%] flex h-[105%] w-[58%] flex-col gap-[6%] bg-(--vault-sheet) px-[8%] pt-[16%] shadow-[0_2px_6px_oklch(0_0_0/0.3)]"
        style={
          {
            "--turn": "0deg",
            "--delay": "0ms",
            clipPath: "polygon(0 0, 78% 0, 100% 17%, 100% 100%, 0 100%)",
          } as CSSProperties
        }
      >
        <Icon
          icon={kindIcon(kind)}
          strokeWidth={1.4}
          className="h-[22%] w-auto self-start text-(--vault-sheet-ink)"
        />
        {[92, 100, 74, 86].map((width, at) => (
          <span
            key={at}
            className="block h-[3.5%] rounded-full bg-(--vault-sheet-ink)/60"
            style={{ width: `${width}%` }}
          />
        ))}
        {/* The folded corner. */}
        <span
          className="absolute end-0 top-0 h-[17%] w-[22%] bg-(--vault-sheet-ink)/45"
          style={{ clipPath: "polygon(0 0, 0 100%, 100% 100%)" }}
        />
      </span>
      <Badges kinds={[kind]} />
    </Frame>
  );
}

function Badges({ kinds }: { kinds: FileKind[] }) {
  const shown = kinds.slice(0, 2);
  if (shown.length === 0) return null;
  return (
    <span className="absolute start-[6%] bottom-[8%] flex w-[34%] gap-[8%]">
      {shown.map((kind) => (
        <KindBadge key={kind} kind={kind} bare className="w-[42%] shrink-0" />
      ))}
    </span>
  );
}

/** "studio." — the reference ends each name with a full stop, unless it has its own. */
export function TileName({ name }: { name: string }) {
  const punctuated = /[.!?…]$/.test(name.trim());
  return (
    <span className="block truncate text-[0.95rem] font-bold tracking-tight">
      {name}
      {punctuated ? null : "."}
    </span>
  );
}
