import type { ReactNode } from "react";
import { Label } from "@/components/panelui/label";

interface FieldProps {
  label: ReactNode;
  htmlFor?: string;
  /** A link or small button at the end of the label line. */
  action?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}

/** A label, its control and a hint under it. */
export function Field({ label, htmlFor, action, hint, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>
        <Label.Text>{label}</Label.Text>
        {action ? <Label.Action>{action}</Label.Action> : null}
      </Label>
      {children}
      {hint ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
