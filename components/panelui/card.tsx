import type { ComponentProps, ElementType } from 'react';
import { tv } from 'tailwind-variants';

const cardVariants = tv({
  slots: {
    root: 'group/card flex flex-col rounded-2xl border bg-card text-card-foreground shadow-xs',
    header: [
      'grid auto-rows-min grid-cols-[minmax(0,1fr)] items-start gap-x-4 gap-y-1.5 p-6',
      'has-data-[slot=card-action]:grid-cols-[minmax(0,1fr)_auto]',
      'group-data-[size=sm]/card:gap-y-1 group-data-[size=sm]/card:p-4',
    ],
    title: 'text-lg font-semibold leading-tight tracking-[-0.01em] group-data-[size=sm]/card:text-base',
    description: 'text-sm text-muted-foreground',
    // Its own column, across both of the heading's rows, so a long title wraps
    // beside it instead of underneath it.
    action: 'col-start-2 row-span-2 row-start-1 self-start justify-self-end',
    // `first:` for a card with no header, which would otherwise start flush.
    content: 'px-6 pb-6 first:pt-6 group-data-[size=sm]/card:px-4 group-data-[size=sm]/card:pb-4 group-data-[size=sm]/card:first:pt-4',
    footer: 'flex items-center gap-2',
  },
  variants: {
    footer: {
      /** Part of the card: same surface, continuing the content's padding. */
      plain: {
        footer:
          'px-6 pb-6 first:pt-6 group-data-[size=sm]/card:px-4 group-data-[size=sm]/card:pb-4 group-data-[size=sm]/card:first:pt-4',
      },
      /**
       * A band set into the bottom of the card: a rule across its top, a step
       * darker, and the card's own bottom corners. For a footer that is what
       * somebody does with the card, not more of what it says.
       */
      panel: {
        footer:
          'mt-auto rounded-b-[calc(var(--radius-2xl)-1px)] border-t bg-muted/60 px-6 py-4 group-data-[size=sm]/card:px-4 group-data-[size=sm]/card:py-3',
      },
    },
  },
});

export interface CardProps extends ComponentProps<'div'> {
  /** `sm` tightens the padding and the title, for a card in a dense grid. Default `default`. */
  size?: 'default' | 'sm';
  /**
   * The element to render. `article` for a card that stands on its own, `li`
   * for one in a list, `section` for one that groups a part of a page.
   */
  as?: 'div' | 'article' | 'section' | 'li';
}

function CardRoot({ size = 'default', as: Element = 'div', className, ...props }: CardProps) {
  const slots = cardVariants();
  const Tag = Element as ElementType;
  return <Tag data-slot="card" data-size={size} className={slots.root({ className })} {...props} />;
}
CardRoot.displayName = 'Card';

export interface CardHeaderProps extends ComponentProps<'div'> {}

/** The title, the line under it, and the action beside them. */
function CardHeader({ className, ...props }: CardHeaderProps) {
  const slots = cardVariants();
  return <div data-slot="card-header" className={slots.header({ className })} {...props} />;
}
CardHeader.displayName = 'Card.Header';

export interface CardTitleProps extends ComponentProps<'h3'> {
  /** The heading level, to fit the page around the card. Default `h3`. */
  as?: 'h2' | 'h3' | 'h4' | 'div';
}

/** What the card is about. A heading, so the page outline includes it. */
function CardTitle({ as: Element = 'h3', className, ...props }: CardTitleProps) {
  const slots = cardVariants();
  const Tag = Element as ElementType;
  return <Tag data-slot="card-title" className={slots.title({ className })} {...props} />;
}
CardTitle.displayName = 'Card.Title';

export interface CardDescriptionProps extends ComponentProps<'p'> {}

/** A line under the title. */
function CardDescription({ className, ...props }: CardDescriptionProps) {
  const slots = cardVariants();
  return <p data-slot="card-description" className={slots.description({ className })} {...props} />;
}
CardDescription.displayName = 'Card.Description';

export interface CardActionProps extends ComponentProps<'div'> {}

/** A control for the whole card, held in the header's top trailing corner. */
function CardAction({ className, ...props }: CardActionProps) {
  const slots = cardVariants();
  return <div data-slot="card-action" className={slots.action({ className })} {...props} />;
}
CardAction.displayName = 'Card.Action';

export interface CardContentProps extends ComponentProps<'div'> {}

/** The body. */
function CardContent({ className, ...props }: CardContentProps) {
  const slots = cardVariants();
  return <div data-slot="card-content" className={slots.content({ className })} {...props} />;
}
CardContent.displayName = 'Card.Content';

export interface CardFooterProps extends ComponentProps<'div'> {
  /**
   * `plain` continues the card. `panel` is a darker band set into its bottom,
   * for actions. Default `plain`.
   */
  variant?: 'plain' | 'panel';
}

/** The row at the bottom, usually the card's actions. */
function CardFooter({ variant = 'plain', className, ...props }: CardFooterProps) {
  const slots = cardVariants({ footer: variant });
  return <div data-slot="card-footer" className={slots.footer({ className })} {...props} />;
}
CardFooter.displayName = 'Card.Footer';

export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Title: CardTitle,
  Description: CardDescription,
  Action: CardAction,
  Content: CardContent,
  Footer: CardFooter,
});

export { CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter };
