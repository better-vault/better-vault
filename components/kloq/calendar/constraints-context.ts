"use client";

/**
 * The resolved drop constraints plus the visible `days`, shared by context.
 * One value, not two contexts, so columns and constraints can't fall out of step.
 */

import { createContext, useContext } from "react";
import { type Constraints, NO_CONSTRAINTS } from "../lib/constraints";

interface ConstraintScope {
  constraints: Constraints;
  /** the visible columns the constraints are being drawn against */
  days: readonly Date[];
}

const EMPTY_SCOPE: ConstraintScope = {
  constraints: NO_CONSTRAINTS,
  days: [],
};

const ConstraintsContext = createContext<ConstraintScope>(EMPTY_SCOPE);

export const ConstraintsProvider = ConstraintsContext.Provider;

/** The active constraints, and the columns they apply to. */
export function useConstraints(): ConstraintScope {
  return useContext(ConstraintsContext);
}
