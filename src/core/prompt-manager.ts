import { getDatabase, initDatabase, getTagByName, updateTagPrompt, getOrCreateTag } from './database'

/**
 * Default prompts for common tags
 */
const DEFAULT_PROMPTS: Record<string, string> = {
  todo: `Show all items as an interactive checklist.
- Display incomplete items first, grouped by date
- Each item should have a checkbox
- Show the date each item was created
- Allow checking items off`,

  done: `Show completed items in reverse chronological order.
- Group by date
- Show a summary count at the top`,
}

/**
 * Fallback prompt for tags without a custom prompt
 */
const FALLBACK_PROMPT = `Display all notes with this tag in a clean, organized way.
- Group by date
- Make it easy to scan and read
- Highlight any action items or important information`

/**
 * Get the prompt for a tag
 * Returns custom prompt if set, default prompt if available, or fallback
 */
export function getPromptForTag(tagName: string): string {
  initDatabase()

  const tag = getTagByName(tagName.toLowerCase())

  // Return custom prompt if set
  if (tag?.prompt) {
    return tag.prompt
  }

  // Check for default prompt
  const lowerName = tagName.toLowerCase()
  if (DEFAULT_PROMPTS[lowerName]) {
    return DEFAULT_PROMPTS[lowerName]
  }

  return FALLBACK_PROMPT
}

/**
 * Set a custom prompt for a tag
 */
export function setPromptForTag(tagName: string, prompt: string): void {
  initDatabase()

  const tag = getOrCreateTag(tagName.toLowerCase())
  updateTagPrompt(tag.id, prompt)
}

/**
 * Check if a tag has a custom prompt (not using default)
 */
export function hasCustomPrompt(tagName: string): boolean {
  initDatabase()

  const tag = getTagByName(tagName.toLowerCase())
  return !!tag?.prompt
}

/**
 * Get the default prompt for a tag type (for showing in UI)
 */
export function getDefaultPrompt(tagName: string): string | null {
  return DEFAULT_PROMPTS[tagName.toLowerCase()] || null
}

/**
 * List all available default prompt templates
 */
export function listDefaultPrompts(): Record<string, string> {
  return { ...DEFAULT_PROMPTS }
}
