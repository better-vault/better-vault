import { ContextMenu as BaseContextMenu } from "@base-ui/react/context-menu";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * A right-click menu. Panel has no context menu, but Base UI's shares every
 * part with its menu (its positioner is the same component), so the menu's
 * content is Panel's own `Menu.Content` and `Menu.Item`s, drawn exactly like
 * the "⋯" menus:
 *
 * ```tsx
 * <ContextMenu>
 *   <ContextMenuTrigger render={<div />}>…</ContextMenuTrigger>
 *   <Menu.Content sideOffset={0}>…</Menu.Content>
 * </ContextMenu>
 * ```
 */
export function ContextMenu(props: ComponentProps<typeof BaseContextMenu.Root>) {
  return <BaseContextMenu.Root {...props} />;
}

export function ContextMenuTrigger({
  className,
  ...props
}: ComponentProps<typeof BaseContextMenu.Trigger>) {
  return (
    <BaseContextMenu.Trigger
      className={typeof className === "string" ? cn(className) : className}
      {...props}
    />
  );
}
