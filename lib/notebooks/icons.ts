import {
  Atom01Icon,
  BalanceScaleIcon,
  Book02Icon,
  BookHeartIcon,
  Brain02Icon,
  Briefcase01Icon,
  Building03Icon,
  Calculator01Icon,
  Camera01Icon,
  ChartLineData01Icon,
  CodeIcon,
  Coffee01Icon,
  Dna01Icon,
  Film01Icon,
  GlobeIcon,
  Idea01Icon,
  LanguageSkillIcon,
  Leaf01Icon,
  MicroscopeIcon,
  Mortarboard01Icon,
  MusicNote01Icon,
  Notebook01Icon,
  PaintBrush01Icon,
  Rocket01Icon,
  Stethoscope02Icon,
  TestTube01Icon,
} from "@hugeicons/core-free-icons";

type IconData = typeof Notebook01Icon;

/**
 * The icons a notebook can have. Notebooks store the key, so an icon can be
 * redrawn or replaced without touching saved data. Never remove a key that
 * has shipped; unknown keys fall back to the notebook icon.
 */
export const notebookIcons = {
  notebook: Notebook01Icon,
  book: Book02Icon,
  graduation: Mortarboard01Icon,
  idea: Idea01Icon,
  brain: Brain02Icon,
  atom: Atom01Icon,
  dna: Dna01Icon,
  "test-tube": TestTube01Icon,
  microscope: MicroscopeIcon,
  medicine: Stethoscope02Icon,
  math: Calculator01Icon,
  chart: ChartLineData01Icon,
  code: CodeIcon,
  globe: GlobeIcon,
  language: LanguageSkillIcon,
  law: BalanceScaleIcon,
  business: Briefcase01Icon,
  architecture: Building03Icon,
  art: PaintBrush01Icon,
  music: MusicNote01Icon,
  film: Film01Icon,
  photo: Camera01Icon,
  nature: Leaf01Icon,
  space: Rocket01Icon,
  reading: BookHeartIcon,
  personal: Coffee01Icon,
} satisfies Record<string, IconData>;

export type NotebookIconKey = keyof typeof notebookIcons;

export const notebookIconKeys = Object.keys(notebookIcons) as NotebookIconKey[];

export function notebookIcon(key: string | undefined): IconData {
  return (key && notebookIcons[key as NotebookIconKey]) || Notebook01Icon;
}
