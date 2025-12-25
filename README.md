# chynotes

## What is chynotes?

chynotes is a daily notes app with one simple idea: you only write in today's page. There are no folders to organize, no pages to create, no structure to maintain. You open the app, you write your thoughts as a list, and you tag things as you go. That's it.

The magic is in the tags. When you write `#todo buy groceries` or `meeting with #sarah about the project`, those tags become clickable. Click on `#todo` and you see all your todos, organized and interactive. Click on `#sarah` and you see every conversation, commitment, and note involving Sarah. You never built these pages—they build themselves.

Here's the key: each tag page is defined by a prompt. That prompt tells an AI what to build. The AI doesn't just summarize your notes—it writes working code that becomes the page. Your `#todo` tag might have a prompt like "show all todos as a checklist I can check off." The AI generates a functional checklist. Your `#finances` tag might say "show my expenses as a chart by category." The AI generates that chart. The prompt is the definition; the code is the output.

Your notes are stored as simple text files on your computer—one file per day. There is no proprietary format, no database lock-in, no cloud dependency. If chynotes disappeared tomorrow, you'd still have readable files you can open in any text editor. The app is just a lens for viewing and organizing what you already wrote.

chynotes is for people who want to capture thoughts quickly without thinking about where they go. Write now, organize never. The tags do the work.

---

## How It Works (Technical Overview)

### Your Files

Everything you write lives in plain text files, one per day, named by date (like `2025-01-16.md`). These files sit in a folder on your computer that you control. You can open them with any text editor, back them up however you like, or sync them with any service you choose. The app never locks you in.

### The Index

When you open chynotes, it scans your notes and builds a lightweight index—a fast lookup table that knows where every tag appears. This index is temporary and rebuildable. If you delete it, the app simply scans your files again. It exists only to make the app fast, not to own your data.

### Tag Pages: Prompts That Generate Code

This is the core of chynotes. Every tag has a prompt—a plain English description of what the tag page should do. When you click a tag:

1. The app gathers all notes with that tag
2. It sends those notes plus the prompt to an AI
3. The AI generates working code (a small interactive page)
4. That code runs and becomes what you see

The prompt for `#todo` might be: *"Show all items tagged #todo as a checklist. Let me check items off. Show incomplete items first, grouped by date."* The AI writes code that does exactly that—a real checklist you can interact with.

The prompt for `#project/website` might be: *"List all notes about this project in timeline order. Highlight any open questions or blockers. Show a progress summary at the top."* The AI generates a project dashboard.

You can edit any tag's prompt to change what the page does. Want your `#books` page to show a reading list with ratings? Just describe it. The AI figures out the code.

### Speed and Caching

The generated code is cached. Once a tag page is built, it loads instantly until your notes change. The AI only regenerates when there's new content. This keeps the app fast even though AI is doing the heavy lifting behind the scenes.

### Privacy Options

You can use cloud AI services for the best results, or run a local AI on your own computer for complete privacy. Your notes never have to leave your machine if you don't want them to.

---

## Examples

| Tag | Prompt | What You Get |
|-----|--------|--------------|
| `#todo` | "Show as interactive checklist, incomplete first" | A checklist you can check off |
| `#person/sarah` | "Timeline of interactions, highlight commitments" | A relationship history with action items |
| `#expenses` | "Chart spending by category, list recent items" | A visual spending breakdown |
| `#ideas` | "Group by theme, show connections between ideas" | A clustered idea board |
| `#weekly-review` | "Summarize last 7 days, list wins and open loops" | An auto-generated weekly summary |

---

## Summary

| What | How |
|------|-----|
| You write | In today's daily page, as a list |
| You tag | Inline, like `#todo` or `#project/website` |
| Tag pages | Defined by prompts that generate working code |
| You view | Click any tag to see a functional, interactive page |
| Your files | Plain text, on your computer, always yours |
| The app | A fast web interface that reads your notes and runs AI-generated pages |