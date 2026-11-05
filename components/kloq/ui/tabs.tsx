"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import * as React from "react";
import {
  type SegmentedControlSize,
  segmentedControlItemLayoutClassName,
  segmentedControlItemSizeClassNames,
} from "../lib/segmented-control";
import { cn } from "../lib/utils";

type TabsVariant = "default" | "underline";
type TabsSize = SegmentedControlSize;

const TabsListContext: React.Context<TabsSize> = React.createContext<TabsSize>("default");

export function Tabs({ className, ...props }: TabsPrimitive.Root.Props): React.ReactElement {
  return (
    <TabsPrimitive.Root
      className={cn("flex flex-col gap-2 data-[orientation=vertical]:flex-row", className)}
      data-slot="tabs"
      {...props}
    />
  );
}

export function TabsList({
  variant = "default",
  size = "default",
  className,
  children,
  ...props
}: TabsPrimitive.List.Props & {
  size?: TabsSize;
  variant?: TabsVariant;
}): React.ReactElement {
  return (
    <TabsPrimitive.List
      className={cn(
        "relative z-0 flex w-fit items-center justify-center gap-x-0.5 font-sans text-muted-foreground",
        "data-[orientation=vertical]:flex-col",
        variant === "default"
          ? "rounded-lg bg-muted p-0.5"
          : "data-[orientation=vertical]:px-1 data-[orientation=horizontal]:py-1 *:data-[slot=tabs-tab]:hover:bg-accent",
        className,
      )}
      data-size={size}
      data-slot="tabs-list"
      {...props}
    >
      <TabsListContext.Provider value={size}>{children}</TabsListContext.Provider>
      <TabsPrimitive.Indicator
        className={cn(
          "absolute bottom-0 start-0 h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) rtl:-translate-x-(--active-tab-left) -translate-y-(--active-tab-bottom) transition-[width,translate] duration-200 ease-in-out",
          variant === "underline"
            ? "z-10 bg-primary data-[orientation=horizontal]:h-0.5 data-[orientation=vertical]:w-0.5 data-[orientation=vertical]:-translate-x-px rtl:data-[orientation=vertical]:translate-x-px data-[orientation=horizontal]:translate-y-px"
            : "-z-1 rounded-md bg-background shadow-(--shadow-sm) dark:bg-input",
        )}
        data-slot="tab-indicator"
      />
    </TabsPrimitive.List>
  );
}

export function TabsTab({
  className,
  size,
  ...props
}: TabsPrimitive.Tab.Props & {
  size?: TabsSize;
}): React.ReactElement {
  const contextSize: TabsSize = React.useContext(TabsListContext);
  const resolvedSize: TabsSize = size ?? contextSize;

  return (
    <TabsPrimitive.Tab
      className={cn(
        "relative flex shrink-0 grow cursor-pointer items-center justify-center whitespace-nowrap rounded-md border border-transparent font-medium text-base outline-none transition-[color,background-color,box-shadow] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-disabled:pointer-events-none data-[orientation=vertical]:w-full data-[orientation=vertical]:justify-start data-active:text-foreground data-disabled:opacity-64 sm:text-sm",
        segmentedControlItemLayoutClassName,
        segmentedControlItemSizeClassNames[resolvedSize],
        "data-[orientation=horizontal]:after:absolute data-[orientation=horizontal]:after:inset-x-0 data-[orientation=horizontal]:after:top-1/2 data-[orientation=horizontal]:after:h-full data-[orientation=horizontal]:after:min-h-6 data-[orientation=horizontal]:after:-translate-y-1/2 pointer-coarse:data-[orientation=horizontal]:after:min-h-11",
        className,
      )}
      data-size={resolvedSize}
      data-slot="tabs-tab"
      {...props}
    />
  );
}

export function TabsPanel({ className, ...props }: TabsPrimitive.Panel.Props): React.ReactElement {
  return (
    <TabsPrimitive.Panel
      className={cn("flex-1 outline-none", className)}
      data-slot="tabs-content"
      {...props}
    />
  );
}

export {
  TabsPanel as TabsContent,
  TabsPrimitive,
  type TabsSize,
  TabsTab as TabsTrigger,
  type TabsVariant,
};
