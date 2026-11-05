import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { Markdown } from "@/components/chat/markdown";
import { Dialog } from "@/components/panelui/dialog";
import { Sheet } from "@/components/panelui/sheet";
import { loadBlob } from "@/lib/db/blobs";
import { useSourceWithChunks } from "@/lib/db/sources";
import type { Chunk, Source, SourceImage } from "@/lib/db/types";
import { countWords } from "@/lib/format";
import { reflow } from "@/lib/sources/reflow";
import { cn } from "@/lib/utils";

interface SourceReaderProps {
  reading: { sourceId: string; passage?: string } | null;
  onClose: () => void;
}

/** Shows a source's text, scrolled to a cited passage when there is one. */
export function SourceReader({ reading, onClose }: SourceReaderProps) {
  const { t: tCommon } = useTranslation();
  return (
    <Sheet side="right" open={reading !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <Sheet.Content
        closeLabel={tCommon("actions.close")}
        className="w-[min(36rem,calc(100vw-2*var(--sheet-gap)))]"
      >
        {reading ? <ReaderBody sourceId={reading.sourceId} passage={reading.passage} /> : null}
      </Sheet.Content>
    </Sheet>
  );
}

function ReaderBody({ sourceId, passage }: { sourceId: string; passage?: string }) {
  const { t, i18n } = useTranslation("sources");
  const read = useSourceWithChunks(sourceId);
  const source = read?.source;
  const chunks = read?.chunks;
  const highlighted = useRef<HTMLDivElement>(null);
  const placed = useMemo(
    () => (source && chunks ? imagesByChunk(source, chunks) : new Map<string, PlacedImage[]>()),
    [source, chunks],
  );

  useEffect(() => {
    if (chunks && passage)
      highlighted.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [chunks, passage]);

  if (!source) return null;
  const words = countWords(source.text);

  return (
    <>
      <Sheet.Header
        title={source.title}
        description={`${t(`kinds.${source.kind}`)} · ${t("words", { count: words, formattedCount: words.toLocaleString(i18n.language) })}`}
      >
        {source.url ? (
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("openPage")}
            <Icon icon={ArrowUpRight01Icon} size={14} className="rtl:-scale-x-100" />
          </a>
        ) : null}
      </Sheet.Header>
      <Sheet.Body>
        <div className="flex flex-col gap-3 pb-6 text-[0.9375rem] leading-7">
          {chunks?.map((chunk) => {
            const active = chunk.id === passage;
            return (
              <Fragment key={chunk.id}>
                <div
                  ref={active ? highlighted : undefined}
                  className={cn(
                    "flex flex-col gap-3 rounded-xl transition-colors",
                    active && "-mx-3 bg-info/10 px-3 py-2 ring-1 ring-info/30",
                  )}
                >
                  {source.kind === "markdown" ? (
                    <Markdown text={chunk.text} bare />
                  ) : (
                    <ChunkWithPictures
                      text={chunk.text}
                      images={placed.get(chunk.id) ?? []}
                      title={source.title}
                    />
                  )}
                </div>
                {source.kind === "markdown"
                  ? placed
                      .get(chunk.id)
                      ?.map(({ image }) => (
                        <SourcePicture key={image.blobId} image={image} title={source.title} />
                      ))
                  : null}
              </Fragment>
            );
          })}
        </div>
      </Sheet.Body>
    </>
  );
}

/** A passage as paragraphs, with the lines a PDF broke joined again. */
function ChunkText({ text }: { text: string }) {
  const blocks = useMemo(() => reflow(text), [text]);
  return blocks.map((block, index) =>
    block.kind === "item" ? (
      <p
        key={index}
        className="relative ps-5 before:absolute before:start-1.5 before:content-['•']"
      >
        {block.text}
      </p>
    ) : (
      <p key={index} className={cn(block.kind === "heading" && "font-medium text-foreground")}>
        {block.text}
      </p>
    ),
  );
}

interface PlacedImage {
  image: SourceImage;
  /** Where in the passage it goes, in characters. */
  offset: number;
}

/** A passage with its pictures where their pages end, and the text between them reflowed. */
function ChunkWithPictures({
  text,
  images,
  title,
}: {
  text: string;
  images: PlacedImage[];
  title: string;
}) {
  if (images.length === 0) return <ChunkText text={text} />;
  const parts: ReactNode[] = [];
  let from = 0;
  images.forEach(({ image, offset }, index) => {
    const piece = text.slice(from, offset);
    if (piece.trim()) parts.push(<ChunkText key={`text-${index}`} text={piece} />);
    parts.push(<SourcePicture key={image.blobId} image={image} title={title} />);
    from = offset;
  });
  const rest = text.slice(from);
  if (rest.trim()) parts.push(<ChunkText key="text-end" text={rest} />);
  return parts;
}

/** Each picture in the passage its page's text ends in. */
function imagesByChunk(source: Source, chunks: Chunk[]): Map<string, PlacedImage[]> {
  const out = new Map<string, PlacedImage[]>();
  if (!source.images?.length || chunks.length === 0) return out;
  const starts: number[] = [];
  const ends: number[] = [];
  let from = 0;
  for (const chunk of chunks) {
    const at = source.text.indexOf(chunk.text, from);
    const start = at >= 0 ? at : from;
    starts.push(start);
    ends.push(start + chunk.text.length);
    from = start + chunk.text.length;
  }
  for (const image of [...source.images].sort((a, b) => a.at - b.at)) {
    let index = ends.findIndex((end) => image.at <= end);
    if (index < 0) index = chunks.length - 1;
    const id = chunks[index].id;
    const offset = Math.min(Math.max(0, image.at - starts[index]), chunks[index].text.length);
    out.set(id, [...(out.get(id) ?? []), { image, offset }]);
  }
  return out;
}

/** A picture from the PDF, loaded from its stored file; pressing it shows it larger. */
function SourcePicture({ image, title }: { image: SourceImage; title: string }) {
  const { t } = useTranslation("sources");
  const { t: tCommon } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    let live = true;
    let made: string | null = null;
    void loadBlob(image.blobId).then((blob) => {
      if (!blob || !live) return;
      made = URL.createObjectURL(blob);
      setUrl(made);
    });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [image.blobId]);

  const label = t("picture", { title });
  return (
    <>
      <button
        type="button"
        onClick={() => setZoomed(true)}
        aria-label={label}
        className="block w-full cursor-zoom-in overflow-hidden rounded-xl bg-muted ring-1 ring-border outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
        style={{ aspectRatio: `${image.width} / ${image.height}` }}
      >
        {url ? <img src={url} alt="" loading="lazy" className="size-full object-contain" /> : null}
      </button>
      <Dialog open={zoomed} onOpenChange={setZoomed}>
        <Dialog.Content size="lg" closeLabel={tCommon("actions.close")}>
          <Dialog.Header title={label} />
          {url ? (
            <img src={url} alt="" className="max-h-[75vh] w-full rounded-xl object-contain" />
          ) : null}
        </Dialog.Content>
      </Dialog>
    </>
  );
}
