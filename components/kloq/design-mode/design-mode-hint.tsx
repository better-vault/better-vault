"use client";

import * as React from "react";
import { Button } from "../ui/button";
import { Kbd, KbdGroup } from "../ui/kbd";
import { useDesignMode } from "./design-mode-provider";

/** A slim footer bar under the calendar: in the layout, so it never sits on top of content. */
export const DesignModeHint = React.memo(function DesignModeHint(): React.ReactElement {
  const { enabled, toggle } = useDesignMode();
  return (
    <div data-dm-hint className="flex shrink-0 items-center border-t bg-background px-2 py-1">
      <Button variant="ghost" size="xs" aria-pressed={enabled} onClick={toggle}>
        <KbdGroup>
          <Kbd>⌥</Kbd>
          <Kbd>D</Kbd>
        </KbdGroup>
        design mode
        {enabled ? <span className="size-1.5 rounded-full bg-brand" aria-hidden /> : null}
      </Button>
    </div>
  );
});
