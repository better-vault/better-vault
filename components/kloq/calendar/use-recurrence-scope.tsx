"use client";

/**
 * Promise-based "this / this and following / all" chooser, mounted once at the calendar root.
 * Dismissal resolves `null` — never treat `null` as "all", that deletes whole series.
 */

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { CalEvent } from "../lib/calendar-types";
import { type Occurrence, RECURRENCE_SCOPES, type RecurrenceScope } from "../lib/recurrence";
import { describeRRule, parseRRule } from "../lib/rrule";
import { type RecurrenceScopeAction, RecurrenceScopeDialog } from "./recurrence-scope-dialog";

interface RecurrenceScopeRequest {
  /** what the answer will be used for — copy and button colour hang off it */
  action: RecurrenceScopeAction;
  /** the MASTER store event, never a placement */
  event: CalEvent;
  /** which instance of the series is being acted on */
  occurrence: Occurrence;
}

/** Ask, and get an answer or `null` for "they dismissed it". */
export type AskRecurrenceScope = (
  request: RecurrenceScopeRequest,
) => Promise<RecurrenceScope | null>;

const ScopeContext = createContext<AskRecurrenceScope | null>(null);

/** The asker, or `null` outside a provider — callers must branch, not assume "all". */
export function useRecurrenceScope(): AskRecurrenceScope | null {
  return useContext(ScopeContext);
}

export function RecurrenceScopeProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<RecurrenceScopeRequest | null>(null);
  // a ref, not state: settling a promise is not a render input
  const resolver = useRef<((scope: RecurrenceScope | null) => void) | null>(null);

  const settle = useCallback((scope: RecurrenceScope | null) => {
    const resolve = resolver.current;
    resolver.current = null;
    setRequest(null);
    resolve?.(scope);
  }, []);

  const ask = useCallback<AskRecurrenceScope>(
    (next) =>
      new Promise((resolve) => {
        // a new question dismisses the open one so no caller awaits a promise that never settles
        resolver.current?.(null);
        resolver.current = resolve;
        setRequest(next);
      }),
    [],
  );

  // on the first occurrence "this and following" equals "all", so don't offer both
  const scopes = request?.occurrence.isFirst ? (["this", "all"] as const) : RECURRENCE_SCOPES;

  const parts = request?.event.rrule ? parseRRule(request.event.rrule) : null;

  return (
    <ScopeContext.Provider value={ask}>
      {children}
      <RecurrenceScopeDialog
        open={request !== null}
        onOpenChange={(open) => {
          if (!open && resolver.current) settle(null);
          else if (!open) setRequest(null);
        }}
        action={request?.action ?? "edit"}
        title={request?.event.title}
        summary={parts ? describeRRule(parts) : undefined}
        scopes={scopes}
        onChoose={settle}
        onCancel={() => settle(null)}
      />
    </ScopeContext.Provider>
  );
}
