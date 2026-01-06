/**
 * Centralized explanations for the app's philosophy and features.
 * These are displayed via hover tooltips throughout the UI.
 *
 * Content can include [[tag]] syntax which becomes interactive -
 * hovering shows more info, clicking navigates to the tag page.
 */

export const explanations = {
  dailyNotes: {
    title: 'Daily Notes',
    body: `Chynotes is built around daily notes — not arbitrary pages. This is intentional.

Use [[tags]] to organize. Every tag becomes a page that automatically collects all its mentions. No need to create or maintain separate pages — just write and tag.`,
  },

  // Nested explanation for when users hover [[tags]] within a tooltip
  tags: {
    title: 'Tags',
    body: `Write [[anything]] and it becomes a tag. Tags can be nested like [[project/website]].

Click any tag to see its page — an auto-generated view of every block that mentions it.`,
  },

  search: {
    title: 'Search',
    body: `Fuzzy search — typos and partial matches still work.

Search looks through all your notes. Results are ranked by relevance.`,
  },

  timeline: {
    title: 'Timeline',
    body: `Drag to browse through your edits.

Discarded ideas are still ideas — scrub back to recover them.`,
  },

  diffToggle: {
    title: 'Changes',
    body: `Shows what was added or removed at each point in the timeline.

Green = added, red = removed.`,
  },

  semanticBacklinks: {
    title: 'Semantic Backlinks',
    body: `Not just explicit mentions — these are blocks related by meaning.

You may see ideas here that don't use the tag but are still relevant.`,
  },

  softLock: {
    title: 'Soft-Locked',
    body: `Past notes are read-only by default.

This encourages linking with [[tags]] instead of scattering updates across old pages.`,
  },

  history: {
    title: 'History',
    body: `Recent daily notes. Click any date to view.

Past notes are soft-locked — you'll be asked before editing.`,
  },

  linkedReferences: {
    title: 'Linked References',
    body: `Blocks that explicitly mention this tag.

Click any block to jump to it in context.`,
  },
} as const

export type ExplanationKey = keyof typeof explanations
