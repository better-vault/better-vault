# Accessibility

better-vault should work for everyone who studies and writes with it, whatever they use to read, type, point or listen. This page says what we aim for, what we know falls short, and how to tell us about a barrier.

## Our goal

We aim for the web app, the desktop app and better-vault.dev to meet [WCAG 2.2](https://www.w3.org/TR/WCAG22/) at level AA. This is a target, not a claim: better-vault has not been through a formal accessibility evaluation yet.

We give most attention to the parts people use every day: the notebook chat, sources, notes, the Studio's tools and outputs, Settings, and the Vault page.

## How we build for it

These rules are part of every change (they are in [AGENTS.md](AGENTS.md), which both people and coding agents follow):

| Area           | What we do                                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Components** | We build on Panel UI and shadcn, which bring keyboard support, focus handling and ARIA roles for menus, dialogs, sheets and tabs. |
| **Labels**     | Every icon-only button has a translated `aria-label`.                                                                             |
| **Language**   | Every string goes through translations, and layouts use logical properties, so right-to-left languages work.                      |
| **Colour**     | Colours come from theme tokens, in light and dark mode, never fixed values.                                                       |
| **Motion**     | Animations, such as the whiteboard's handwriting and the Vault's folder tiles, respect reduced motion.                            |
| **Keyboard**   | The app has keyboard shortcuts for its main actions, and lists them where they apply.                                             |

When a change affects how something is reached, read or operated, its pull request should say how it was checked: by keyboard, with a screen reader, in both themes, or at 200% zoom. The [pull request template](.github/PULL_REQUEST_TEMPLATE.md) has room for it.

## Supported environments

| Environment        | What we support                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| **Browsers**       | Current versions of Chrome, Edge, Firefox and Safari.                                                                 |
| **Desktop app**    | macOS 12 or later, Windows 10 and 11, and 64-bit Linux.                                                               |
| **Input**          | Mouse, trackpad, touch and keyboard.                                                                                  |
| **Assistive tech** | We aim to work with VoiceOver, NVDA, JAWS, TalkBack and system zoom, but have not yet tested each one systematically. |

## Known limitations

| Experience                   | Limitation                                                                                                          | Workaround                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Whiteboard and Canvas**    | Drawings are pictures to a screen reader; shapes and handwriting are not described one by one.                      | Text on a board can be selected and copied; Ask AI's answers are also ordinary text elements. |
| **Graph view and mind maps** | The graph is drawn on a canvas and isn't navigable by screen reader.                                                | The Notes list, backlinks and the mind map's Markdown hold the same links.                    |
| **Anatomy figures**          | 3D parts are described in their labels and steps, but rotating the figure needs a pointer.                          | The parts list and steps can be read without the figure.                                      |
| **Generated files**          | PDFs the AI makes are not tagged for screen readers, and right-to-left scripts may not be shaped correctly in them. | Ask for Word, Markdown or HTML instead; those keep their structure.                           |
| **Plugins**                  | Plugins are made by third parties and may not follow these rules.                                                   | Turn a plugin off or uninstall it in Settings → Plugins.                                      |

## Report a barrier

[Open an accessibility issue](https://github.com/better-vault/better-vault/issues/new?template=accessibility.yml) and tell us what you were trying to do and what got in the way. You don't need to tell us anything about yourself or any disability, and screenshots or recordings are welcome but never required. If you'd rather not use GitHub yourself, anyone can file it for you.

## What happens next

A maintainer reads every accessibility issue, labels it `accessibility`, and aims to reply within a week to confirm what is affected. We fix barriers that stop someone from finishing a task before other work in the same area, and say in the issue when a fix is released. If we can't fix something soon, we add it to the known limitations above with a workaround.

## Keeping this page current

The maintainers of better-vault own this statement and review it with each release. Suggestions for this page are welcome as an issue or a pull request.
