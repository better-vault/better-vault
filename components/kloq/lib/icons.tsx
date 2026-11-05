/**
 * better-vault addition (not in kloq): the icons kloq imports from
 * `lucide-react`, drawn with Hugeicons instead, because better-vault uses
 * Hugeicons only (AGENTS.md, "UI rules"). Each export keeps its lucide name
 * so kloq's files need only their import path changed. Re-running the
 * shadcn CLI brings `lucide-react` imports back: point them here again.
 */
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Add01Icon,
  Alert02Icon,
  ArrowDown01Icon,
  ArrowDown02Icon,
  ArrowLeft01Icon,
  ArrowLeft02Icon,
  ArrowRight01Icon,
  ArrowRight02Icon,
  ArrowUp01Icon,
  ArrowUp02Icon,
  AsteriskIcon,
  Building03Icon,
  Calendar01Icon,
  Calendar02Icon,
  Calendar03Icon,
  CalendarAdd01Icon,
  CalendarCheckIn01Icon,
  CalendarDownload01Icon,
  CalendarSearchIcon,
  CalendarSetting01Icon,
  Cancel01Icon,
  ClipboardIcon,
  ClipboardPasteIcon,
  Clock01Icon,
  ComputerPhoneSyncIcon,
  Copy01Icon,
  Delete02Icon,
  DragDropHorizontalIcon,
  Globe02Icon,
  Gps01Icon,
  KeyboardIcon,
  LayoutThreeColumnIcon,
  LeftToRightListBulletIcon,
  LinkSquare02Icon,
  Loading03Icon,
  Location01Icon,
  Mail01Icon,
  MinusSignIcon,
  Moon02Icon,
  Move01Icon,
  Notification01Icon,
  PaintBoardIcon,
  PenTool01Icon,
  PencilEdit01Icon,
  PlugSocketIcon,
  RepeatIcon,
  Scissor01Icon,
  Search01Icon,
  Settings02Icon,
  SlidersHorizontalIcon,
  SquareIcon,
  SquareLock02Icon,
  Sun03Icon,
  TextAlignLeftIcon,
  Tick02Icon,
  Undo02Icon,
  UnfoldLessIcon,
  UnfoldMoreIcon,
  UserAdd01Icon,
  UserGroupIcon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import type { ComponentType, SVGProps } from "react";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "ref"> {
  size?: number | string;
  strokeWidth?: number;
  absoluteStrokeWidth?: boolean;
}

/** What lucide calls an icon component. */
export type LucideIcon = ComponentType<IconProps>;

function make(icon: IconSvgElement, name: string): LucideIcon {
  function Icon({ size = 24, strokeWidth = 1.75, absoluteStrokeWidth: _absolute, ...props }: IconProps) {
    return (
      <HugeiconsIcon
        icon={icon}
        size={size}
        strokeWidth={strokeWidth}
        aria-hidden={props["aria-label"] ? undefined : true}
        {...(props as Record<string, unknown>)}
      />
    );
  }
  Icon.displayName = name;
  return Icon;
}

export const AlignLeft = make(TextAlignLeftIcon, "AlignLeft");
export const ArrowDown = make(ArrowDown02Icon, "ArrowDown");
export const ArrowLeft = make(ArrowLeft02Icon, "ArrowLeft");
export const ArrowRight = make(ArrowRight02Icon, "ArrowRight");
export const ArrowUp = make(ArrowUp02Icon, "ArrowUp");
export const Asterisk = make(AsteriskIcon, "Asterisk");
export const Bell = make(Notification01Icon, "Bell");
export const Building2 = make(Building03Icon, "Building2");
export const Calendar = make(Calendar03Icon, "Calendar");
export const CalendarArrowDown = make(CalendarDownload01Icon, "CalendarArrowDown");
export const CalendarClock = make(CalendarCheckIn01Icon, "CalendarClock");
export const CalendarCog = make(CalendarSetting01Icon, "CalendarCog");
export const CalendarDays = make(Calendar01Icon, "CalendarDays");
export const CalendarPlus = make(CalendarAdd01Icon, "CalendarPlus");
export const CalendarRange = make(Calendar02Icon, "CalendarRange");
export const CalendarSearch = make(CalendarSearchIcon, "CalendarSearch");
export const Check = make(Tick02Icon, "Check");
export const ChevronDown = make(ArrowDown01Icon, "ChevronDown");
export const ChevronDownIcon = make(ArrowDown01Icon, "ChevronDownIcon");
export const ChevronLeft = make(ArrowLeft01Icon, "ChevronLeft");
export const ChevronRight = make(ArrowRight01Icon, "ChevronRight");
export const ChevronRightIcon = make(ArrowRight01Icon, "ChevronRightIcon");
export const ChevronUpIcon = make(ArrowUp01Icon, "ChevronUpIcon");
export const ChevronsDownUp = make(UnfoldLessIcon, "ChevronsDownUp");
export const ChevronsUpDown = make(UnfoldMoreIcon, "ChevronsUpDown");
export const ChevronsUpDownIcon = make(UnfoldMoreIcon, "ChevronsUpDownIcon");
export const Clipboard = make(ClipboardIcon, "Clipboard");
export const ClipboardPaste = make(ClipboardPasteIcon, "ClipboardPaste");
export const Clock = make(Clock01Icon, "Clock");
export const Columns3 = make(LayoutThreeColumnIcon, "Columns3");
export const CopyPlus = make(Copy01Icon, "CopyPlus");
export const ExternalLink = make(LinkSquare02Icon, "ExternalLink");
export const Globe = make(Globe02Icon, "Globe");
export const GripHorizontal = make(DragDropHorizontalIcon, "GripHorizontal");
export const Keyboard = make(KeyboardIcon, "Keyboard");
export const List = make(LeftToRightListBulletIcon, "List");
export const Loader2Icon = make(Loading03Icon, "Loader2Icon");
export const LocateFixed = make(Gps01Icon, "LocateFixed");
export const Lock = make(SquareLock02Icon, "Lock");
export const Mail = make(Mail01Icon, "Mail");
export const MapPin = make(Location01Icon, "MapPin");
export const MinusIcon = make(MinusSignIcon, "MinusIcon");
export const MonitorSmartphone = make(ComputerPhoneSyncIcon, "MonitorSmartphone");
export const Moon = make(Moon02Icon, "Moon");
export const Move = make(Move01Icon, "Move");
export const Palette = make(PaintBoardIcon, "Palette");
export const PenTool = make(PenTool01Icon, "PenTool");
export const Pencil = make(PencilEdit01Icon, "Pencil");
export const Plus = make(Add01Icon, "Plus");
export const PlusIcon = make(Add01Icon, "PlusIcon");
export const Repeat = make(RepeatIcon, "Repeat");
export const RotateCcw = make(Undo02Icon, "RotateCcw");
export const Scissors = make(Scissor01Icon, "Scissors");
export const Search = make(Search01Icon, "Search");
export const SearchIcon = make(Search01Icon, "SearchIcon");
export const Settings2 = make(Settings02Icon, "Settings2");
export const SlidersHorizontal = make(SlidersHorizontalIcon, "SlidersHorizontal");
export const Square = make(SquareIcon, "Square");
export const Sun = make(Sun03Icon, "Sun");
export const Trash2 = make(Delete02Icon, "Trash2");
export const TriangleAlert = make(Alert02Icon, "TriangleAlert");
export const Unplug = make(PlugSocketIcon, "Unplug");
export const UserPlus = make(UserAdd01Icon, "UserPlus");
export const Users = make(UserGroupIcon, "Users");
export const Video = make(Video01Icon, "Video");
export const X = make(Cancel01Icon, "X");
export const XIcon = make(Cancel01Icon, "XIcon");
