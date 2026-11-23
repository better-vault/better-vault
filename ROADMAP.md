# Roadmap

This page lists what better-vault has shipped, what comes next and what is out of scope. Version numbers are plans, not promises, and the order can change with feedback. To suggest something, [open a feature request](https://github.com/better-vault/better-vault/issues/new/choose).

## Shipped

| Version            | What it added                                                                                                                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **v0.1.0**         | Notebooks and sources (text, Markdown, PDF, web pages), chat in Sources and Web modes with citations, Reports, Flashcards, Quiz, Data table and Mind map                                                                                                     |
| **v0.2.0**         | Slide deck, Infographic, Anatomy figures, Whiteboard with Annotate, several chats per notebook, citation marks and footnotes                                                                                                                                 |
| **v0.3.0**         | The website and documentation at [better-vault.dev](https://www.better-vault.dev)                                                                                                                                                                            |
| **v0.4.0, v0.4.1** | The desktop app for macOS, Windows and Linux, with notebooks in a local SQLite file, signed macOS builds and automatic updates                                                                                                                               |
| **v0.4.2**         | Sign in with ChatGPT to use your plan instead of an OpenAI key, and the providers' own logos                                                                                                                                                                 |
| **v0.5.0**         | Audio Overviews with ElevenLabs, storage (Google Drive, S3, R2) for sources, backups and exports, folders, OpenCode, an account profile, and in-app updates                                                                                                  |
| **v0.6.0**         | Vaults and a Finder-style notebooks page, a calendar, a ⌘K command palette that searches inside PDFs, pictures from PDFs, effort levels, DeepSeek, a usage ring and a primary colour                                                                         |
| **v0.7.0**         | Linked notes with a graph, skills, MCP for AI agents, visuals in chat answers, Canvas, calendar preferences and an optional account                                                                                                                          |
| **v0.8.0, v0.9.0** | Bots with their own characters, access settings and approvals, and skills fetched from skills.sh                                                                                                                                                             |
| **Next release**   | YouTube videos, Word, Excel, PowerPoint and EPUB sources with an icon for every format, OpenRouter and Kimi, MCP access to everything in the app, plugins with Creator mode through MCP, and Pro and Max plans with skills and plugins synced across devices |

## Understand your notebook

A **notebook guide** will summarize each notebook, list its key topics and suggest questions, and refresh when the sources change. You will be able to save a chat answer as a note and turn notes into sources.

**Chat settings** will give a notebook a goal or persona, an answer style and an answer length. One of those styles, the **learning guide**, is a tutor mode that asks questions back and works through problems step by step instead of giving the answer at once.

You will also be able to choose the **language of answers and Studio outputs** separately from the interface language. Reports gain **FAQ and timeline** formats beside the briefing doc, study guide and blog post.

## More sources and research

**Images** read by vision models and **audio files** transcribed by the provider's speech-to-text will join today's documents, web pages and YouTube videos.

**Discover sources** will let you describe a topic and have the model find web pages with its provider's built-in search, then add the ones you choose. **Deep research** runs a longer search in the background and writes a cited report you can add as a source. Retrieval will also gain **embedding-based search** over passages, alongside today's keyword search.

## Creator mode and customization

Plugins and Creator mode through MCP are the base for making better-vault your own. Next, **Creator mode in the app** lets you describe a panel, a workbench or a theme in a bot's chat; the bot builds it, shows it in the sandbox and refines it with you, without an outside agent.

Plugins can now add **Studio tools** of their own and **mods** that reshape the app, and the **plugin directory** lists reviewed plugins in the app and on the site. Next, plugins will get **more places to appear**: sidebars and chat commands. **Synced customization** will carry your settings, themes and bots to your other devices through the same account sync as skills and plugins.

## Edit and share

You will be able to **edit a Studio output with a prompt**, changing one slide, one section of a report or one branch of a mind map, and **review a slide deck's outline** before it is built. Notebooks will be **shareable as a file**, and you will be able to copy a notebook.

## Later

**Chat adapters** will connect better-vault to Slack, Microsoft Teams, Discord and Telegram, so you can ask the agent to send a message there, or talk to your notebooks from those apps. Vercel AI Gateway and more interface languages are planned. A layout made for phones, installable as an app, is also on the list.

The desktop app will grow too: API keys kept in the operating system's keychain, and whole folders of documents added as sources by dragging them in. This site will get example notebooks, so you can try better-vault without your own files.

## Not planned

**Video overviews** are out of scope; better-vault focuses on cited chat and written, visual and spoken outputs. **Keeping notebooks on a server** is out of scope too: better-vault stays local-first, and an account is only an option for Better Vault AI, the backups you choose to put in Better Vault Cloud, and syncing your skills and plugins.
