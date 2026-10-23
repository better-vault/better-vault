import { Switch as BaseSwitch } from '@base-ui/react/switch';
import type { CSSProperties } from 'react';
import { tv } from 'tailwind-variants';

export type SwitchSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type SwitchColor = 'primary' | 'success' | 'info' | 'destructive';

/** Height and width of the track. The thumb is the height less 2px of padding on each side. */
const SIZE: Record<SwitchSize, [string, string]> = {
  xs: ['1rem', '1.75rem'],
  sm: ['1.25rem', '2.125rem'],
  md: ['1.5rem', '2.625rem'],
  lg: ['1.75rem', '3.125rem'],
  xl: ['2rem', '3.625rem'],
};

const SPRING = 'ease-[cubic-bezier(0.3,1.35,0.45,1)]';

const switchVariants = tv({
  slots: {
    root: [
      'group/switch relative inline-flex h-(--switch-h) w-(--switch-w) shrink-0 cursor-pointer items-center rounded-full p-0.5 outline-none',
      'bg-input transition-[background-color,box-shadow] duration-200 dark:bg-input/80',
      'hover:not-data-disabled:bg-[color-mix(in_oklab,var(--input),var(--foreground)_8%)]',
      'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      'data-disabled:cursor-not-allowed data-disabled:opacity-50 aria-busy:cursor-progress',
      // The fill: the whole track in the switch's colour, uncovered from the
      // thumb's starting side as it travels.
      "before:absolute before:inset-0 before:rounded-[inherit] before:bg-(--switch-color) before:content-['']",
      'before:[clip-path:inset(0_100%_0_0_round_999px)] before:transition-[clip-path] before:duration-300 before:ease-[cubic-bezier(0.3,1.35,0.45,1)]',
      'rtl:before:[clip-path:inset(0_0_0_100%_round_999px)]',
      'data-checked:before:[clip-path:inset(0_0_0_0_round_999px)]',
      'motion-reduce:before:transition-none',
    ],
    thumb: [
      'relative z-10 flex size-[calc(var(--switch-h)-4px)] items-center justify-center rounded-full bg-white',
      // On, the thumb takes the colour that reads on the fill: dark on a light primary, white on the rest.
      'transition-colors data-checked:bg-(--switch-thumb)',
      'shadow-[0_1px_2px_rgb(0_0_0/0.18),0_2px_6px_-1px_rgb(0_0_0/0.12)]',
      `transition-[translate,width] duration-300 ${SPRING} motion-reduce:transition-none`,
      // On: across by the track's width less its height, which is the room left.
      'data-checked:translate-x-[calc(var(--switch-w)-var(--switch-h))] rtl:data-checked:-translate-x-[calc(var(--switch-w)-var(--switch-h))]',
      // Pressed: a fifth longer, towards where it is going. When on, it grows back the way it came.
      'group-active/switch:not-data-disabled:w-[calc((var(--switch-h)-4px)*1.22)]',
      'group-active/switch:data-checked:not-data-disabled:translate-x-[calc(var(--switch-w)-var(--switch-h)-(var(--switch-h)-4px)*0.22)]',
      'rtl:group-active/switch:data-checked:not-data-disabled:-translate-x-[calc(var(--switch-w)-var(--switch-h)-(var(--switch-h)-4px)*0.22)]',
      'group-aria-busy/switch:w-[calc(var(--switch-h)-4px)]',
    ],
    spinner: 'size-[62%] animate-spin text-(--switch-color) group-not-data-checked/switch:text-muted-foreground motion-reduce:animate-none',
  },
  variants: {
    color: {
      primary: { root: '[--switch-color:var(--primary)] [--switch-thumb:var(--primary-foreground)]' },
      success: { root: '[--switch-color:var(--success)] [--switch-thumb:white]' },
      info: { root: '[--switch-color:var(--info)] [--switch-thumb:white]' },
      destructive: { root: '[--switch-color:var(--destructive)] [--switch-thumb:white]' },
    },
  },
  defaultVariants: { color: 'primary' },
});

export interface SwitchProps extends Omit<BaseSwitch.Root.Props, 'className' | 'color'> {
  /** Default `md`. */
  size?: SwitchSize;
  /** The colour it fills with when on. `primary` by default; pick another for what it means. */
  color?: SwitchColor;
  /**
   * What a screen reader calls it, when there is no visible label tied to it.
   * A `Label` wrapped round it, or pointing at its `id`, is better when there is room.
   */
  label?: string;
  /** A change is being saved: a ring turns in the thumb, and it cannot be pressed again until it is done. */
  pending?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** A switch. Takes `checked`/`onCheckedChange` or `defaultChecked`, and `name` for a form. */
function Switch({ size = 'md', color, label, pending = false, className, style, readOnly, ...props }: SwitchProps) {
  const slots = switchVariants({ color });
  const [height, width] = SIZE[size];
  return (
    <BaseSwitch.Root
      data-slot="switch"
      data-size={size}
      aria-label={label}
      aria-busy={pending || undefined}
      readOnly={pending || readOnly}
      className={slots.root({ className })}
      style={{ ['--switch-h' as string]: height, ['--switch-w' as string]: width, ...style }}
      {...props}
    >
      <BaseSwitch.Thumb data-slot="switch-thumb" className={slots.thumb()}>
        {pending ? (
          <svg viewBox="0 0 24 24" aria-hidden="true" className={slots.spinner()} fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity={0.2} strokeWidth={3.5} />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" />
          </svg>
        ) : null}
      </BaseSwitch.Thumb>
    </BaseSwitch.Root>
  );
}
Switch.displayName = 'Switch';

export { Switch };
