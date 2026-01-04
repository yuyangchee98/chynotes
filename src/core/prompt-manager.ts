import { initDatabase, getTagByName, updateTagPrompt, getOrCreateTag } from './database'

/**
 * Fallback prompt for tags without a custom prompt
 * Used for future AI directive features
 */
const FALLBACK_PROMPT = `Display all notes with this tag in a clean, organized way.
- Group by date
- Make it easy to scan and read
- Highlight any action items or important information`

/**
 * Get the prompt for a tag
 * Returns custom prompt if set, or fallback
 */
export function getPromptForTag(tagName: string): string {
  initDatabase()

  const tag = getTagByName(tagName.toLowerCase())

  // Return custom prompt if set
  if (tag?.prompt) {
    return tag.prompt
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
 * Check if a tag has a custom prompt
 */
export function hasCustomPrompt(tagName: string): boolean {
  initDatabase()

  const tag = getTagByName(tagName.toLowerCase())
  return !!tag?.prompt
}
