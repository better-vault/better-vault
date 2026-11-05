export { CalendarApp as Kloq, type KloqProps } from "./calendar/calendar-app";
/* the panel's calendar picker, standalone */
export {
  CalendarField,
  type CalendarFieldProps,
} from "./calendar/calendar-field";
export { CalendarList, type CalendarListProps } from "./calendar/calendar-list";
/* chrome — the app bar as opt-in parts; `<Kloq>` itself renders none of it */
export {
  type KloqChrome,
  KloqNav,
  KloqReset,
  KloqToolbar,
  type KloqToolbarProps,
  useKloq,
} from "./calendar/chrome";
export { EVENT_COLORS } from "./calendar/event-block";
export { DEFAULT_QUICK_ADD_MIN } from "./calendar/kloq-command";
export { MoveToInput } from "./calendar/move-to-input";
/* multi-timezone gutter */
export {
  createMultiTimeZoneGutter,
  formatZoneTime,
  GUTTER_WIDTH,
  MultiTimeZoneGutter,
  type MultiTimeZoneGutterProps,
  multiZoneGutterWidth,
  zoneTimeAt,
} from "./calendar/multi-tz-gutter";
// the ⌘K fields themselves, for hosts that want the surface outside the menu
export { QuickAddInput } from "./calendar/quick-add-input";
export {
  RecurrenceScopeDialog,
  type RecurrenceScopeDialogProps,
} from "./calendar/recurrence-scope-dialog";
export { ReminderField, type ReminderFieldProps } from "./calendar/reminder-field";
/* recurrence builder UI */
export { RRuleBuilder, type RRuleBuilderProps } from "./calendar/rrule-builder";
export { useKloqSettings } from "./calendar/settings-context";
// slots
export {
  type AllDayChipProps,
  type DayHeaderProps,
  DEFAULT_COMPONENTS,
  type EventBlockProps,
  type EventPanelProps,
  type KloqComponents,
  type NowIndicatorProps,
  type ResourceGutterProps,
  type TimeGutterProps,
  type TimelineBlockProps,
  type TimelineHeaderProps,
  type TimelineRowProps,
} from "./calendar/slots";
export { useKloqStore } from "./calendar/store-context";
export { GutterDateProvider, gutterDateFor, useGutterDate } from "./calendar/time-gutter";
export type { WorkingHours } from "./calendar/time-shade";
export { YearView, type YearViewProps } from "./calendar/year-view";
export {
  type Agenda,
  type AgendaDay,
  type AgendaEntry,
  groupAgenda,
} from "./lib/agenda";
/* attendee mutations */
export {
  type AttendeeSummary,
  addAttendee,
  addAttendees,
  attendeeLabel,
  attendeeStatus,
  findAttendee,
  initialsFor,
  isOrganizer,
  isValidEmail,
  organizerOf,
  RSVP_CHOICES,
  removeAttendee,
  setAttendeeOptional,
  setAttendeeStatus,
  summarize,
  summaryLabel,
  toggleAttendeeOptional,
} from "./lib/attendees";
export type { KloqAxis } from "./lib/axis";
/* configuration */
export {
  createSettings,
  DEFAULT_CONFIG,
  DEFAULT_SETTINGS,
  type KloqConfig,
  type KloqSettings,
} from "./lib/calendar-config";
/* multi-calendar */
export {
  accountDefaultCalendar,
  type CalendarAccount,
  type CalendarAccountGroup,
  type CalendarColor,
  type CalendarSource,
  clearCalendarSources,
  defaultAccount,
  defaultCalendar,
  defaultCalendarId,
  filterVisibleEvents,
  findAccount,
  findCalendar,
  getCalendarAccounts,
  getCalendarSources,
  groupByAccount,
  isEventVisible,
  isVisible,
  newEventCalendarId,
  registerCalendarAccount,
  registerCalendarAccounts,
  registerCalendarSources,
  resolveDefaultCalendar,
  resolveEventColor,
  setCalendarVisible,
  setDefaultCalendar,
  subscribeCalendarSources,
  toggleCalendarVisible,
  useCalendarSources,
  visibleCalendarIds,
} from "./lib/calendar-sources";
export type { KloqBatchOp } from "./lib/calendar-store";
// store
export {
  buildSeedEvents,
  type KloqChange,
  type KloqStore,
  localStorageAdapter,
  newEventId,
  type OnCommit,
  type PersistenceAdapter,
  SEED_EVENTS,
  STORAGE_KEY,
} from "./lib/calendar-store";
/* views & navigation */
export type {
  AllDayCalEvent,
  Attendee,
  AttendeeStatus,
  CalEvent,
  CalEventPatch,
  EventColor,
  Instant,
  KloqView,
  KloqViewKind,
  PlacedEvent,
  PlacementId,
  Reminder,
  ReminderMethod,
  StoreId,
  TimedCalEvent,
  ViewDescriptor,
} from "./lib/calendar-types";
export {
  AGENDA_DAYS,
  asPlacementId,
  continuesAfter,
  continuesBefore,
  DEFAULT_EVENT_COLOR,
  dateOnlyAfter,
  dateOnlyAt,
  daysBetween,
  displayDate,
  displayNow,
  eventZoneNote,
  formatInstant,
  formatMinutes,
  formatRange,
  HOUR_HEIGHT,
  hasForeignZone,
  instantAt,
  instantPlus,
  isBusy,
  isDateOnly,
  isTimeGridView,
  MAX_N_DAY_VIEW,
  MIN_EVENT_MIN,
  MIN_N_DAY_VIEW,
  MONTH_DAYS,
  MONTH_WEEKS,
  minutesOfDate,
  minutesToPx,
  parseInstant,
  pxToMinutes,
  resolveView,
  SNAP_FINE_MIN,
  SNAP_MIN,
  startOfWeek,
  type TimeFormatOptions,
  toDateOnlyString,
  viewKind,
  wallMinutesBetween,
  YEAR_MONTHS,
} from "./lib/calendar-types";
export {
  buildClipboardPayload,
  eventsToICS,
  eventsToText,
  looksLikeICS,
  parseClipboardEvents,
  readEventsFromClipboard,
  rebaseEvents,
  writeEventsToClipboard,
} from "./lib/clipboard";
export {
  BUILT_IN_COMMANDS,
  type BuiltInCommand,
  type BuiltInCommandGroup,
  COMMAND_GROUPS,
  type CommandGroupModel,
  commandAllowed,
  DEFAULT_COMMAND_GROUP,
  groupCommands,
  matchesQuery,
  normalizeQuery,
} from "./lib/command-model";
// ⌘K command registry
export {
  clearCommands,
  getCommands,
  type KloqCommand,
  registerCommands,
  subscribeCommands,
} from "./lib/command-registry";
/* conflicts — busy-time collisions, distinct from the visual overlap layout */
export {
  type ConflictOptions,
  type ConflictPair,
  conflictBetween,
  conflictClusters,
  conflictsFor,
  describeConflicts,
  type EventInterval,
  eventInterval,
  findConflicts,
  intervalsOverlap,
  isBlocking,
  isConflicting,
  overlapMs,
  participantsOf,
  sharedParticipants,
} from "./lib/conflicts";
/* constraints — what the grid refuses; the pure half lives in lib/constraints */
export {
  type ConstraintGesture,
  type Constraints,
  createConstraints,
  disabledBands,
  type KloqConstraints,
  type Slot as ConstraintSlot,
  slotAllowed,
} from "./lib/constraints";
export type { CraftEvent, DragFrame, DragKind } from "./lib/craft-bus";
export { craftBus } from "./lib/craft-bus";
export { densityRestoreScript } from "./lib/density";
// event search + "when" formatters
export {
  allDayDisplayEnd,
  type EventSearchOptions,
  type EventSearchResult,
  formatDayLabel,
  formatDurationShort,
  formatEventWhen,
  formatWhen,
  searchEvents,
} from "./lib/event-search";
export { downloadICS, type ToICSOptions, toICS } from "./lib/ics";
/* ICS import */
export {
  type ICSContentLine,
  type ICSDate,
  type ICSImportOptions,
  type ICSImportResult,
  type ICSSkip,
  parseContentLine,
  parseICS,
  parseICSDateValue,
  parseICSDuration,
  unescapeText,
  unfoldICS,
} from "./lib/ics-import";
/* remappable keyboard layer */
export {
  actionForEvent,
  bindingFromEvent,
  displayKey,
  isBindableKey,
  KEY_ACTIONS,
  type KeyActionId,
  type Keymap,
  type ResolvedKeymap,
  resolveKeymap,
} from "./lib/keymap";
/* timeline — the row-binding seam, the window and its axis, and the grid slot */
export { byResourceId, type Lane, type LaneAdapter } from "./lib/lane";
export {
  isV2Event,
  migrateV1,
  PAYLOAD_VERSION,
  type PayloadV2,
  readPayload,
} from "./lib/migrate";
export {
  compareForDay,
  hiddenOn,
  layoutMonth,
  type MonthChip,
  type MonthLayout,
} from "./lib/month-grid";
/* move-to */
export { describeMove, type MoveTarget, type MoveToOptions, parseMoveTarget } from "./lib/move-to";
export {
  formatViewTitle,
  isoWeek,
  isoWeekYear,
  type NavigationKeys,
  rangeOfView,
  type StepDirection,
  stepAnchor,
  stepLabel,
  todayAnchor,
} from "./lib/navigation";
export type { PlacedOccurrence } from "./lib/projection";
/* projection */
export { type DayBounds, type Projection, projectEvents } from "./lib/projection";
// natural-language quick add
export {
  parseQuickAdd,
  type QuickAddOptions,
  type QuickAddResult,
  type QuickAddToken,
  type QuickAddTokenKind,
} from "./lib/quick-add";
export { QUICK_ADD_KIND_ORDER, QUICK_ADD_KINDS } from "./lib/quick-add-kinds";
export {
  highlightSegments,
  type QuickAddPreview,
  type QuickAddSegment,
  quickAddPreview,
  UNTITLED,
} from "./lib/quick-add-view";
/* recurrence expansion — `registerRecurrenceEngine` swaps in `rrule` or a backend */
export {
  applyPlan,
  deleteOccurrence,
  type ExpandRecurrenceFn,
  editOccurrence,
  entriesFor,
  exdatesOf,
  expandRecurrence,
  getRecurrenceEngine,
  isOccurrenceKey,
  masterIdOf,
  nextOccurrence,
  nodeFor,
  nodesFor,
  type Occurrence,
  occurrenceAt,
  occurrenceKey,
  occurrenceStartOf,
  previousOccurrence,
  type RecurrencePlan,
  type RecurrenceScope,
  registerRecurrenceEngine,
  segmentKey,
  withoutSegment,
} from "./lib/recurrence";
/* reminders — computed fire times; nothing here delivers a notification */
export {
  addReminder,
  DEFAULT_REMINDER,
  describeReminder,
  describeReminders,
  formatReminderOffset,
  MAX_MINUTES_BEFORE,
  MAX_REMINDERS,
  nextReminderAcross,
  nextReminderAt,
  normalizeReminder,
  normalizeReminders,
  parseReminderAmount,
  REMINDER_PRESETS,
  REMINDER_UNITS,
  type ReminderOccurrence,
  type ReminderPreset,
  type ReminderUnit,
  reminderBaseTime,
  reminderTimes,
  removeReminder,
  replaceReminder,
  splitReminderUnit,
} from "./lib/reminders";
/* recurrence — the pure RRULE library */
export {
  DEFAULT_DESCRIBE_OPTIONS,
  type DescribeOptions,
  describeRRule,
  endOf,
  isExpressible,
  nthWeekdayOfMonth,
  PRESET_IDS,
  type PresetId,
  parseRRule,
  presetIdFor,
  presetsFor,
  type RRuleByDay,
  type RRuleEnd,
  type RRuleFreq,
  type RRuleParts,
  type RRulePreset,
  type RRuleUntil,
  type RRuleWeekday,
  serializeRRule,
  untilFromDate,
  untilToDate,
  WEEKDAY_CODES,
  weekdayCodeOf,
  withEnd,
} from "./lib/rrule";
/* selection & clipboard */
export {
  addToSelection,
  applySelectionClick,
  clearSelection,
  eventsInMarquee,
  extendSelection,
  isSelected,
  removeFromSelection,
  replaceSelection,
  retainSelection,
  type SelectionState,
  selectAll,
  selectionFrom,
  selectionIndex,
  selectionOrder,
  selectOnly,
  toggleSelection,
} from "./lib/selection";
export {
  getMotion,
  MOTION_DEFAULTS,
  type MotionState,
  resetMotion,
  type SpringSpec,
  setMotion,
  springLinear,
  springSamples,
  subscribeMotion,
} from "./lib/springs";
export {
  configureStorage,
  eventsStorageKey,
  type StorageConfig,
  type StorageSetting,
} from "./lib/storage";
export {
  getScheme,
  getTheme,
  type KloqScheme,
  type KloqTheme,
  resolveScheme,
  SCHEME_STORAGE_KEY,
  setScheme,
  setTheme,
  THEME_RESTORE_SCRIPT,
  THEME_STORAGE_KEY,
  THEMES,
  themeRestoreScript,
  themeTransition,
  toggleScheme,
  watchSystemScheme,
} from "./lib/themes";
export {
  resolveWindow,
  type TimelineWindow,
  type TimelineWindowConfig,
} from "./lib/timeline-window";
/* time zones — the pure layer; everything goes through `Intl`, no tz database ships */
export {
  COMMON_ZONES,
  canonicalZone,
  coerceTimeZone,
  type Disambiguation,
  describeAuthoredZone,
  formatAuthoredTime,
  formatInstantInZone,
  formatInZone,
  hourLabel,
  type InstantLike,
  instantFromWallClock,
  isForeignZone,
  isValidTimeZone,
  listAllZones,
  listCommonZones,
  localZone,
  normalizeZoneColumns,
  resolveWallClock,
  sameZone,
  searchZones,
  type TimeZoneColumn,
  toMs,
  unzonedInstant,
  type WallClockKind,
  type WallClockResolution,
  wallClockIn,
  type ZoneOption,
  type ZoneWallClock,
  zoneAbbr,
  zoneCityLabel,
  zonedDate,
  zoneLongName,
  zoneOffsetLabel,
  zoneOffsetMinutes,
} from "./lib/timezone";
/* SSR seam */
export { useIsClient } from "./lib/use-is-client";
/* year view — mini-months and the density behind their heat map */
export {
  buildYearGrid,
  type DayLoad,
  DENSITY_LEVELS,
  type DensityBucket,
  densityBucket,
  densityByDay,
  densityFill,
  describeLoad,
  loadOn,
  weekdayColumns,
  type YearCell,
  type YearDensityOptions,
  type YearMonth,
} from "./lib/year-grid";
export { TimelineGrid, type TimelineGridProps } from "./timeline/timeline-grid";
