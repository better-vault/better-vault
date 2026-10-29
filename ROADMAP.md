# Roadmap

This page lists what better-vault has shipped, what comes next and what is out of scope. Version numbers are plans, not promises, and the order can change with feedback. To suggest something, [open a feature request](https://github.com/better-vault/better-vault/issues/new/choose).

## Shipped

| Version          | What it added                                                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **v0.1.0**       | Notebooks and sources (text, Markdown, PDF, web pages), chat in Sources and Web modes with citations, Reports, Flashcards, Quiz, Data table and Mind map |
| **v0.2.0**       | Slide deck, Infographic, Anatomy figures, Whiteboard with Annotate, several chats per notebook, citation marks and footnotes                          |
| **v0.3.0**       | The website and documentation at [better-vault.dev](https://better-vault.dev)                                                                         |
| **v0.4.0, v0.4.1** | The desktop app for macOS, Windows and Linux, with notebooks in a local SQLite file, signed macOS builds and automatic updates                      |

## v0.5: Understand your notebook

A **notebook guide** will summarize each notebook, list its key topics and suggest questions, and refresh when the sources change. **Notes** will let you write your own notes, save a chat answer as a note and turn notes into sources.

**Chat settings** will give a notebook a goal or persona, an answer style and an answer length. One of those styles, the **learning guide**, is a tutor mode that asks questions back and works through problems step by step instead of giving the answer at once.

You will also be able to choose the **language of answers and Studio outputs** separately from the interface language. Reports gain **FAQ and timeline** formats beside the briefing doc, study guide and blog post.

## v0.6: More sources and research

**More source types** are coming: DOCX, EPUB, YouTube transcripts, images read by vision models, and audio files transcribed by the provider's speech-to-text.

**Discover sources** will let you describe a topic and have the model find web pages with its provider's built-in search, then add the ones you choose. **Deep research** runs a longer search in the background and writes a cited report you can add as a source. Retrieval will also gain **embedding-based search** over passages, alongside today's keyword search.

## v0.7: Edit and share

You will be able to **edit a Studio output with a prompt**, changing one slide, one section of a report or one branch of a mind map, and **review a slide deck's outline** before it is built. Notebooks will be **shareable as a file**, and you will be able to copy a notebook.

## Later

More providers are planned, starting with OpenRouter and Vercel AI Gateway, along with more interface languages. A layout made for phones, installable as an app, is also on the list.

The desktop app will grow too: API keys kept in the operating system's keychain, and whole folders of documents added as sources by dragging them in. This site will get example notebooks, so you can try better-vault without your own files.

## Not planned

**Audio and video overviews** are out of scope; better-vault focuses on cited chat and written and visual outputs. **Accounts and server storage** are out of scope too, because better-vault stays local-first and your data lives on your device.
