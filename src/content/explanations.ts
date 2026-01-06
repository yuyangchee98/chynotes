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
} as const

export type ExplanationKey = keyof typeof explanations
