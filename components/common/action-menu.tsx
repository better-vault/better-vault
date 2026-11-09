import type { ReactNode } from "react";
import { Icon, type IconSvgElement } from "@/components/icon";
import { Menu } from "@/components/panelui/menu";

/** One row of a menu, shared by an item's "⋯" menu and its right-click menu. */
export type MenuAction =
  | {
      kind: "item";
      id: string;
      label: string;
      icon: IconSvgElement;
      /** Keys shown at the row's end, such as ["⌘", "⌫"]. */
      shortcut?: string[];
      destructive?: boolean;
      onSelect: () => void;
    }
  | {
      kind: "sub";
      id: string;
      label: string;
      icon: IconSvgElement;
      items: MenuAction[];
    }
  | {
      kind: "radio";
      id: string;
      label: string;
      value: string;
      options: { value: string; label: string }[];
      onChange: (value: string) => void;
    }
  | { kind: "separator"; id: string };

/** Draws actions as Panel menu rows; works inside `Menu` and `ContextMenu` alike. */
export function MenuActions({ actions }: { actions: MenuAction[] }): ReactNode {
  return actions.map((action) => {
    switch (action.kind) {
      case "separator":
        return <Menu.Separator key={action.id} />;
      case "radio":
        return (
          <Menu.Group key={action.id}>
            <Menu.GroupLabel>{action.label}</Menu.GroupLabel>
            <Menu.RadioGroup
              value={action.value}
              onValueChange={(next: unknown) => typeof next === "string" && action.onChange(next)}
            >
              {action.options.map((option) => (
                <Menu.RadioItem key={option.value} value={option.value}>
                  {option.label}
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Group>
        );
      case "sub":
        return (
          <Menu.Sub key={action.id}>
            <Menu.SubTrigger>
              <Icon icon={action.icon} />
              {action.label}
            </Menu.SubTrigger>
            <Menu.SubContent>
              <MenuActions actions={action.items} />
            </Menu.SubContent>
          </Menu.Sub>
        );
      default:
        return (
          <Menu.Item
            key={action.id}
            variant={action.destructive ? "destructive" : undefined}
            onClick={action.onSelect}
          >
            <Icon icon={action.icon} />
            {action.label}
            {action.shortcut ? <Menu.Shortcut>{action.shortcut.join("")}</Menu.Shortcut> : null}
          </Menu.Item>
        );
    }
  });
}
