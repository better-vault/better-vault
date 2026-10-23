import type { ComponentProps } from 'react';
import { tv } from 'tailwind-variants';

const labelVariants = tv({
  slots: {
    root: [
      'group/label flex w-full min-w-0 items-center gap-2 text-sm font-medium leading-5 text-foreground select-none',
      // A control wrapped in the label tells it how it is.
      'has-disabled:cursor-not-allowed has-disabled:opacity-50 has-[[aria-invalid=true]]:text-destructive',
      'data-disabled:cursor-not-allowed data-disabled:opacity-50 data-invalid:text-destructive',
    ],
    // The required mark is drawn after the text by CSS, so it follows the name
    // however the label is composed, and is not read out as "star".
    text: [
      'flex min-w-0 items-baseline',
      "group-data-required/label:after:ms-0.5 group-data-required/label:after:text-destructive group-data-required/label:after:content-['*']",
    ],
    textInner: 'min-w-0 truncate',
    hint: [
      'shrink-0 font-normal text-muted-foreground',
      // An invalid field's hint is the reason, so it takes the colour too.
      'group-data-invalid/label:text-destructive group-has-[[aria-invalid=true]]/label:text-destructive',
    ],
    action: [
      'order-last ms-auto flex shrink-0 items-center gap-1.5 font-normal text-muted-foreground',
      '[&_a]:text-foreground [&_a]:underline-offset-4 [&_a]:outline-none [&_a:hover]:underline [&_a:focus-visible]:underline',
      'group-data-invalid/label:text-destructive',
    ],
  },
});

export interface LabelProps extends ComponentProps<'label'> {
  /**
   * Marks the field as one that must be filled. The mark is for the eye; set
   * `required` on the control as well, which is what a screen reader announces.
   */
  required?: boolean;
  /** Shows "Optional" after the text, for a form where most fields are required. */
  optional?: boolean;
  /**
   * Turns the label to the destructive colour. Needed when the label is tied
   * to its control by `htmlFor`; a label wrapped round its control reads it.
   */
  invalid?: boolean;
  /** Fades the label. As with `invalid`, a wrapped control is read on its own. */
  disabled?: boolean;
}

/**
 * The label element. A string child is the label's text; for more, compose
 * `Label.Text`, `Label.Hint` and `Label.Action`.
 */
function LabelRoot({
  required = false,
  optional = false,
  invalid = false,
  disabled = false,
  className,
  children,
  ...props
}: LabelProps) {
  const slots = labelVariants();
  const plain = typeof children === 'string' || typeof children === 'number';
  return (
    <label
      data-slot="label"
      data-required={required ? '' : undefined}
      data-invalid={invalid ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      className={slots.root({ className })}
      {...props}
    >
      {plain ? <LabelText>{children}</LabelText> : children}
      {optional ? <LabelHint>Optional</LabelHint> : null}
    </label>
  );
}
LabelRoot.displayName = 'Label';

export interface LabelTextProps extends ComponentProps<'span'> {}

/** The field's name. It truncates rather than pushing the action off the line. */
function LabelText({ className, children, ...props }: LabelTextProps) {
  const slots = labelVariants();
  return (
    <span data-slot="label-text" className={slots.text({ className })} {...props}>
      <span className={slots.textInner()}>{children}</span>
    </span>
  );
}
LabelText.displayName = 'Label.Text';

export interface LabelHintProps extends ComponentProps<'span'> {}

/**
 * A quieter word or two after the name: a limit, a format, a unit. On an
 * invalid field it takes the destructive colour, so it can say what is wrong.
 */
function LabelHint({ className, ...props }: LabelHintProps) {
  return <span data-slot="label-hint" className={labelVariants().hint({ className })} {...props} />;
}
LabelHint.displayName = 'Label.Hint';

export interface LabelActionProps extends ComponentProps<'span'> {}

/** Pushed to the far end of the line: a link, a count, a small button. */
function LabelAction({ className, ...props }: LabelActionProps) {
  return <span data-slot="label-action" className={labelVariants().action({ className })} {...props} />;
}
LabelAction.displayName = 'Label.Action';

export const Label = Object.assign(LabelRoot, {
  Text: LabelText,
  Hint: LabelHint,
  Action: LabelAction,
});

export { LabelText, LabelHint, LabelAction };
