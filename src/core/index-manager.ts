import * as crypto from 'crypto'
import {
  listAllNotes,
  readNote,
  formatDateForFileName,
} from './file-manager'
import {
  initDatabase,
  upsertNote,
  getNoteByDate,
  deleteNote,
  getOrCreateTag,
  addTagOccurrence,
  deleteOccurrencesForNote,
  getTagsWithCounts,
  getOccurrencesForTag,
  getBlocksWithTag,
  TagWithCount,
  TagOccurrenceWithDetails,
  BlockRecord,
} from './database'
import { parseNote } from './tag-parser'
import { listDefaultPrompts } from './prompt-manager'

/**
 * Compute a hash of content for change detection
 */
function computeHash(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex')
}

/**
 * Index a single note file
 * Returns true if the note was updated, false if unchanged
 */
export async function indexNote(date: Date): Promise<boolean> {
  const dateStr = formatDateForFileName(date)
  const content = await readNote(date)

  if (content === null) {
    // Note was deleted, remove from index
    const existingNote = getNoteByDate(dateStr)
    if (existingNote) {
      deleteOccurrencesForNote(existingNote.id)
      deleteNote(dateStr)
    }
    return true
  }

  const hash = computeHash(content)
  const existingNote = getNoteByDate(dateStr)

  // Skip if content hasn't changed
  if (existingNote && existingNote.file_hash === hash) {
    return false
  }

  // Upsert note record
  const noteRecord = upsertNote(dateStr, hash)

  // Clear old occurrences for this note
  deleteOccurrencesForNote(noteRecord.id)

  // Parse and index tags
  const { occurrences } = parseNote(content)

  for (const occurrence of occurrences) {
    const tagRecord = getOrCreateTag(occurrence.tag)
    addTagOccurrence(tagRecord.id, noteRecord.id, occurrence.line, occurrence.context)
  }

  return true
}

/**
 * Full reindex of all notes
 * Returns the number of notes indexed
 */
export async function reindexAll(): Promise<number> {
  initDatabase()

  const dates = await listAllNotes()
  let count = 0

  for (const date of dates) {
    await indexNote(date)
    count++
  }

  return count
}

/**
 * Incremental index - only update changed files
 * Returns the number of notes that were updated
 */
export async function incrementalIndex(): Promise<number> {
  initDatabase()

  const dates = await listAllNotes()
  let updatedCount = 0

  for (const date of dates) {
    const wasUpdated = await indexNote(date)
    if (wasUpdated) {
      updatedCount++
    }
  }

  return updatedCount
}

/**
 * Get all tags with their occurrence counts
 */
export function getAllTagsWithCounts(): TagWithCount[] {
  initDatabase()
  return getTagsWithCounts()
}

/**
 * Block occurrence with details for display
 */
export interface BlockOccurrence {
  block_id: string
  date: string
  line: number
  content: string
}

/**
 * Get all blocks containing a specific tag
 */
export function getTagOccurrences(tagName: string): BlockOccurrence[] {
  initDatabase()
  const blocks = getBlocksWithTag(tagName.toLowerCase())
  return blocks.map(block => ({
    block_id: block.id,
    date: block.note_date,
    line: block.line_number,
    content: block.content,
  }))
}

/**
 * Search tags by prefix (for autocomplete)
 */
export function searchTags(query: string): TagWithCount[] {
  const allTags = getAllTagsWithCounts()
  const lowerQuery = query.toLowerCase()

  return allTags.filter(tag =>
    tag.name.toLowerCase().includes(lowerQuery)
  )
}

/**
 * Build a hierarchical tag tree for sidebar display
 */
export interface TagTreeNode {
  name: string           // Full tag name (e.g., "project/website")
  displayName: string    // Short name (e.g., "website")
  count: number
  prompt: string | null
  children: TagTreeNode[]
}

export function buildTagTree(): TagTreeNode[] {
  const tags = getAllTagsWithCounts()
  const rootNodes: TagTreeNode[] = []
  const nodeMap = new Map<string, TagTreeNode>()

  // Get predefined tags and add them with 0 count if not already present
  const defaultPrompts = listDefaultPrompts()
  const existingTagNames = new Set(tags.map(t => t.name))

  for (const tagName of Object.keys(defaultPrompts)) {
    if (!existingTagNames.has(tagName)) {
      tags.push({
        id: -1, // placeholder
        name: tagName,
        prompt: defaultPrompts[tagName],
        count: 0,
      })
    }
  }

  // Sort tags so parents come before children
  tags.sort((a, b) => a.name.localeCompare(b.name))

  for (const tag of tags) {
    const parts = tag.name.split('/')
    const displayName = parts[parts.length - 1]

    const node: TagTreeNode = {
      name: tag.name,
      displayName,
      count: tag.count,
      prompt: tag.prompt,
      children: [],
    }

    nodeMap.set(tag.name, node)

    if (parts.length === 1) {
      // Top-level tag
      rootNodes.push(node)
    } else {
      // Child tag - find parent
      const parentName = parts.slice(0, -1).join('/')
      const parent = nodeMap.get(parentName)

      if (parent) {
        parent.children.push(node)
      } else {
        // Parent doesn't exist as a tag, add as root
        rootNodes.push(node)
      }
    }
  }

  return rootNodes
}
