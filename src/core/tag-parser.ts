/**
 * Tag Parser
 *
 * Supports dual syntax for tags:
 * - Hashtags: #todo, #project/website, #person/sarah
 * - Wiki-links: [[todo]], [[project/website]], [[person/sarah]]
 *
 * Both syntaxes are normalized to the same canonical form (without prefix).
 */

export interface TagOccurrence {
  tag: string           // Normalized tag name (e.g., "todo", "project/website")
  line: number          // 1-based line number
  column: number        // 0-based column where tag starts
  raw: string           // Original text (e.g., "#todo" or "[[todo]]")
  context: string       // The full line of text
}

export interface ParsedNote {
  occurrences: TagOccurrence[]
  tags: Set<string>     // Unique tags found in the note
}

// Regex patterns for both syntaxes
// Hashtag: #word or #word/subword (supports letters, numbers, underscores, hyphens, slashes)
const HASHTAG_PATTERN = /#([\w\-]+(?:\/[\w\-]+)*)/g

// Wiki-link: [[word]] or [[word/subword]]
const WIKILINK_PATTERN = /\[\[([\w\-]+(?:\/[\w\-]+)*)\]\]/g

/**
 * Parse a single line of text for tags
 */
export function parseLineForTags(line: string, lineNumber: number): TagOccurrence[] {
  const occurrences: TagOccurrence[] = []

  // Find hashtags
  let match: RegExpExecArray | null
  const hashtagRegex = new RegExp(HASHTAG_PATTERN.source, 'g')

  while ((match = hashtagRegex.exec(line)) !== null) {
    occurrences.push({
      tag: match[1].toLowerCase(),
      line: lineNumber,
      column: match.index,
      raw: match[0],
      context: line,
    })
  }

  // Find wiki-links
  const wikilinkRegex = new RegExp(WIKILINK_PATTERN.source, 'g')

  while ((match = wikilinkRegex.exec(line)) !== null) {
    occurrences.push({
      tag: match[1].toLowerCase(),
      line: lineNumber,
      column: match.index,
      raw: match[0],
      context: line,
    })
  }

  return occurrences
}

/**
 * Parse an entire note for all tag occurrences
 */
export function parseNote(content: string): ParsedNote {
  const lines = content.split('\n')
  const occurrences: TagOccurrence[] = []
  const tags = new Set<string>()

  for (let i = 0; i < lines.length; i++) {
    const lineOccurrences = parseLineForTags(lines[i], i + 1) // 1-based line numbers

    for (const occurrence of lineOccurrences) {
      occurrences.push(occurrence)
      tags.add(occurrence.tag)
    }
  }

  return { occurrences, tags }
}

/**
 * Extract just the unique tags from content (quick scan)
 */
export function extractTags(content: string): string[] {
  const { tags } = parseNote(content)
  return Array.from(tags).sort()
}

/**
 * Check if a string is a valid tag name
 */
export function isValidTagName(name: string): boolean {
  const pattern = /^[\w\-]+(?:\/[\w\-]+)*$/
  return pattern.test(name)
}

/**
 * Normalize a tag name (lowercase, trim)
 */
export function normalizeTagName(name: string): string {
  return name.toLowerCase().trim()
}

/**
 * Get the parent tag for hierarchical tags
 * e.g., "project/website" -> "project"
 * Returns null for top-level tags
 */
export function getParentTag(tag: string): string | null {
  const lastSlash = tag.lastIndexOf('/')
  if (lastSlash === -1) return null
  return tag.substring(0, lastSlash)
}

/**
 * Get all ancestor tags for a hierarchical tag
 * e.g., "project/website/frontend" -> ["project", "project/website"]
 */
export function getAncestorTags(tag: string): string[] {
  const parts = tag.split('/')
  const ancestors: string[] = []

  for (let i = 1; i < parts.length; i++) {
    ancestors.push(parts.slice(0, i).join('/'))
  }

  return ancestors
}

/**
 * Check if a tag is a child of another tag
 */
export function isChildOf(child: string, parent: string): boolean {
  return child.startsWith(parent + '/')
}

/**
 * Get the display name for a tag (last segment)
 * e.g., "project/website" -> "website"
 */
export function getTagDisplayName(tag: string): string {
  const lastSlash = tag.lastIndexOf('/')
  if (lastSlash === -1) return tag
  return tag.substring(lastSlash + 1)
}
