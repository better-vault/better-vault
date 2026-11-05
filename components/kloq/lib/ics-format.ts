import { MINUTES_PER_DAY, pad2 } from "./date-math";
import type { AttendeeStatus } from "./event-types";
import { formatInstant, type Instant, toDateOnlyString } from "./instant";

export const dateStamp = (d: Date) =>
  `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;

/** Floating local time — no Z, no TZID. */
export const dateTimeStamp = (d: Date) =>
  `${dateStamp(d)}T${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;

/** DTSTAMP must be UTC (RFC 5545 §3.8.7.2). */
export const utcStamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
  `T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;

export const escapeText = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const MAX_OCTETS = 75;

const encoder = new TextEncoder();
const octets = (s: string) => encoder.encode(s).length;

/** RFC 5545 §3.1 folding at 75 octets, breaking only between code points or escape pairs. */
export function foldLine(line: string): string {
  if (octets(line) <= MAX_OCTETS) return line;

  const cps = Array.from(line);
  const atoms: string[] = [];
  for (let i = 0; i < cps.length; i++) {
    if (cps[i] === "\\" && i + 1 < cps.length) atoms.push(cps[i] + cps[++i]);
    else atoms.push(cps[i]!);
  }

  const chunks: string[] = [];
  let cur = "";
  let curOctets = 0;
  // continuations spend one octet on the leading space
  let limit = MAX_OCTETS;
  for (const atom of atoms) {
    const size = octets(atom);
    if (cur !== "" && curOctets + size > limit) {
      chunks.push(cur);
      cur = "";
      curOctets = 0;
      limit = MAX_OCTETS - 1;
    }
    cur += atom;
    curOctets += size;
  }
  if (cur !== "") chunks.push(cur);
  return chunks.join("\r\n ");
}

// RFC 5545 §3.1: quote on `,;:`; an embedded double quote has no escape, so it is dropped
export const quoteParam = (v: string) =>
  /[,;:]/.test(v) ? `"${v.replace(/"/g, "")}"` : v.replace(/"/g, "");

const PARTSTAT_OF: Record<AttendeeStatus, string> = {
  accepted: "ACCEPTED",
  declined: "DECLINED",
  tentative: "TENTATIVE",
  pending: "NEEDS-ACTION",
};

export const partstatOf = (s: AttendeeStatus): string => PARTSTAT_OF[s];

const STATUS_OF: Record<string, AttendeeStatus> = Object.fromEntries(
  Object.entries(PARTSTAT_OF).map(([k, v]) => [v, k as AttendeeStatus]),
);
export const statusOfPartstat = (v: string | undefined): AttendeeStatus | undefined =>
  STATUS_OF[v?.toUpperCase() ?? ""];

/** Wrap content lines in a VCALENDAR envelope: folded, CRLF-joined, CRLF-terminated. */
export function vcalendar(lines: readonly string[], prodId?: string): string {
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      `PRODID:-//${prodId ?? "kloq"}//EN`,
      ...lines,
      "END:VCALENDAR",
    ]
      .map(foldLine)
      .join("\r\n") + "\r\n"
  );
}

/** Undo RFC 5545 §3.1 folding. Accepts CRLF, LF and CR; blank lines dropped after unfolding. */
export function unfoldICS(text: string): string[] {
  // strip a UTF-8 BOM
  const src = text.replace(/^﻿/, "");
  const out: string[] = [];
  for (const raw of src.split(/\r\n|\n|\r/)) {
    if (raw.startsWith(" ") || raw.startsWith("\t")) {
      if (out.length > 0) {
        out[out.length - 1] += raw.slice(1);
        continue;
      }
      out.push(raw.slice(1));
      continue;
    }
    out.push(raw);
  }
  return out.filter((l) => l.trim() !== "");
}

/** One parsed content line: `NAME;PARAM=v:value`. */
export interface ICSContentLine {
  /** upper-cased property name */
  name: string;
  /** upper-cased param names → values, already caret- and quote-decoded */
  params: Record<string, string>;
  /** raw value, still TEXT-escaped */
  value: string;
}

// RFC 6868 param-value decoding
function unescapeParam(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== "^" || i + 1 >= s.length) {
      out += s[i];
      continue;
    }
    const next = s[++i];
    out += next === "n" ? "\n" : next === "^" ? "^" : next === "'" ? '"' : "^" + next;
  }
  return out;
}

/** Split a content line into name, params and value; `null` for a line with no unquoted colon. */
export function parseContentLine(line: string): ICSContentLine | null {
  let quoted = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') quoted = !quoted;
    else if (c === ":" && !quoted) {
      colon = i;
      break;
    }
  }
  if (colon === -1) return null;

  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);

  const parts: string[] = [];
  let cur = "";
  quoted = false;
  for (const c of head) {
    if (c === '"') {
      quoted = !quoted;
      cur += c;
    } else if (c === ";" && !quoted) {
      parts.push(cur);
      cur = "";
    } else cur += c;
  }
  parts.push(cur);

  const name = (parts.shift() ?? "").trim().toUpperCase();
  if (name === "") return null;

  const params: Record<string, string> = {};
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq === -1) continue;
    const key = p.slice(0, eq).trim().toUpperCase();
    let v = p.slice(eq + 1).trim();
    if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) v = v.slice(1, -1);
    params[key] = unescapeParam(v);
  }
  return { name, params, value };
}

/** RFC 5545 TEXT unescaping. Single pass: a `.replace()` chain would turn `\\n` into a newline. */
export function unescapeText(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== "\\" || i + 1 >= s.length) {
      out += s[i];
      continue;
    }
    const next = s[++i];
    out +=
      next === "n" || next === "N"
        ? "\n"
        : next === "\\" || next === ";" || next === "," || next === ":"
          ? next
          : "\\" + next;
  }
  return out;
}

const DATE_VALUE = /^(\d{4})(\d{2})(\d{2})$/;
const DATE_TIME_VALUE = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/;

export interface ICSDate {
  instant: Instant;
  /** date-only (all-day) rather than a moment */
  dateOnly: boolean;
  /** the `TZID` param, when present */
  tzid?: string;
}

/**
 * Parse a `DTSTART`/`DTEND` value: date → all-day, `Z` → UTC converted to local, floating → local.
 * `TZID` is approximated: the wall clock is read as local and the zone name kept on `timeZone`.
 */
export function parseICSDateValue(
  value: string,
  params: Record<string, string> = {},
): ICSDate | null {
  const v = value.trim();
  const tzid = params.TZID;

  const d = DATE_VALUE.exec(v);
  if (d) {
    // the value shape is authoritative over VALUE=DATE-TIME
    return {
      instant: `${d[1]}-${d[2]}-${d[3]}`,
      dateOnly: true,
      ...(tzid ? { tzid } : {}),
    };
  }

  const t = DATE_TIME_VALUE.exec(v);
  if (!t) return null;
  const [, y, mo, da, h, mi, s, z] = t;
  const parts = [y, mo, da, h, mi, s].map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  // hour 24 (`T240000`) normalises to 00:00 the next day through either constructor
  const date = z
    ? new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]))
    : new Date(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]);
  if (Number.isNaN(date.getTime())) return null;

  // `VALUE=DATE` on a date-time value: the param wins
  if (params.VALUE?.toUpperCase() === "DATE")
    return { instant: toDateOnlyString(date), dateOnly: true, ...(tzid ? { tzid } : {}) };

  return { instant: formatInstant(date), dateOnly: false, ...(tzid ? { tzid } : {}) };
}

const DURATION = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;

/** RFC 5545 `DURATION` → whole minutes (seconds rounded), or `null`. */
export function parseICSDuration(value: string): number | null {
  const m = DURATION.exec(value.trim());
  if (!m) return null;
  const [, sign, w, d, h, mi, s] = m;
  if (!w && !d && !h && !mi && !s) return null;
  const minutes =
    Number(w ?? 0) * 7 * MINUTES_PER_DAY +
    Number(d ?? 0) * MINUTES_PER_DAY +
    Number(h ?? 0) * 60 +
    Number(mi ?? 0) +
    Math.round(Number(s ?? 0) / 60);
  return sign === "-" ? -minutes : minutes;
}
