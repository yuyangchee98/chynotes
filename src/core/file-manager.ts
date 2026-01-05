import * as fs from 'fs/promises'
import * as path from 'path'
import { existsSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { serializeBlocks, parseBlocks } from './block-parser'
import { parseNote } from './tag-parser'
import {
  upsertBlock,
  deleteBlocksForNote,
  addBlockTag,
  deleteBlockTags
} from './database'
import { queueBlocksForEmbedding } from './embedding-queue'

const NOTES_DIR_NAME = '.chynotes'
const NOTES_SUBDIR = 'notes'
const PAGES_SUBDIR = 'pages'

/**
 * Get the base chynotes directory path
 */
export function getChynotesDirectory(): string {
  return path.join(homedir(), NOTES_DIR_NAME)
}

/**
 * Get the notes directory path where daily notes are stored
 */
export function getNotesDirectory(): string {
  return path.join(getChynotesDirectory(), NOTES_SUBDIR)
}

/**
 * Ensure the notes directory exists, creating it if necessary
 */
export async function ensureNotesDirectory(): Promise<void> {
  const notesDir = getNotesDirectory()
  if (!existsSync(notesDir)) {
    await fs.mkdir(notesDir, { recursive: true })
  }
}

/**
 * Ensure the notes directory exists (sync version for initialization)
 */
export function ensureNotesDirectorySync(): void {
  const notesDir = getNotesDirectory()
  if (!existsSync(notesDir)) {
    mkdirSync(notesDir, { recursive: true })
  }
}

/**
 * Format a date as YYYY-MM-DD for file naming
 */
export function formatDateForFileName(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Get the file name for a specific date (e.g., "2025-01-16.md")
 */
export function getDateFileName(date: Date): string {
  return `${formatDateForFileName(date)}.md`
}

/**
 * Get the full file path for a specific date's note
 */
export function getNotePath(date: Date): string {
  return path.join(getNotesDirectory(), getDateFileName(date))
}

/**
 * Get today's note file name
 */
export function getTodayFileName(): string {
  return getDateFileName(new Date())
}

/**
 * Parse a date string from a file name (e.g., "2025-01-16.md" -> Date)
 */
export function parseDateFromFileName(fileName: string): Date | null {
  const match = fileName.match(/^(\d{4})-(\d{2})-(\d{2})\.md$/)
  if (!match) return null

  const [, year, month, day] = match
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
}

/**
 * Read a note for a specific date
 * @returns The note content, or null if the file doesn't exist
 */
export async function readNote(date: Date): Promise<string | null> {
  const filePath = getNotePath(date)

  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return content
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw error
  }
}

/**
 * Write (or overwrite) a note for a specific date
 * If content is empty, deletes the file instead
 * Automatically adds block IDs to any blocks without them
 */
export async function writeNote(date: Date, content: string): Promise<void> {
  const noteDate = formatDateForFileName(date)

  if (content === '') {
    await deleteNote(date)
    // Also clean up blocks in database
    deleteBlocksForNote(noteDate)
    return
  }

  // Inject block IDs into any blocks that don't have them
  const contentWithIds = serializeBlocks(content)

  await ensureNotesDirectory()
  const filePath = getNotePath(date)
  await fs.writeFile(filePath, contentWithIds, 'utf-8')

  // Index blocks in database
  indexBlocks(noteDate, contentWithIds)
}

/**
 * Index all blocks from content into the database
 */
function indexBlocks(noteDate: string, content: string): void {
  // Clear existing blocks for this note
  deleteBlocksForNote(noteDate)

  // Parse blocks
  const { allBlocks } = parseBlocks(content)

  // Collect block IDs for embedding queue
  const blockIds: string[] = []

  // Insert each block
  for (const block of allBlocks) {
    upsertBlock(
      block.id,
      noteDate,
      block.content,
      block.parent?.id || null,
      block.indentLevel,
      block.line
    )

    // Parse tags from block content and index them
    const { tags } = parseNote(block.content)
    for (const tag of tags) {
      addBlockTag(block.id, tag)
    }

    blockIds.push(block.id)
  }

  // Queue blocks for embedding (non-blocking)
  if (blockIds.length > 0) {
    queueBlocksForEmbedding(blockIds)
  }
}

/**
 * Check if a note exists for a specific date
 */
export async function noteExists(date: Date): Promise<boolean> {
  const filePath = getNotePath(date)
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * List all note dates in the notes directory
 * @returns Array of Dates for which notes exist, sorted newest first
 */
export async function listAllNotes(): Promise<Date[]> {
  const notesDir = getNotesDirectory()

  try {
    const files = await fs.readdir(notesDir)
    const dates: Date[] = []

    for (const file of files) {
      const date = parseDateFromFileName(file)
      if (date) {
        dates.push(date)
      }
    }

    // Sort by date, newest first
    dates.sort((a, b) => b.getTime() - a.getTime())
    return dates
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw error
  }
}

/**
 * Delete a note for a specific date
 */
export async function deleteNote(date: Date): Promise<void> {
  const filePath = getNotePath(date)
  try {
    await fs.unlink(filePath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
}

/**
 * Update a specific line in a note
 * @param date The date of the note
 * @param lineNumber 1-based line number
 * @param newContent The new content for that line
 */
export async function updateNoteLine(date: Date, lineNumber: number, newContent: string): Promise<void> {
  const content = await readNote(date)
  if (content === null) {
    throw new Error(`Note for ${formatDateForFileName(date)} does not exist`)
  }

  const lines = content.split('\n')
  if (lineNumber < 1 || lineNumber > lines.length) {
    throw new Error(`Line ${lineNumber} is out of range (1-${lines.length})`)
  }

  lines[lineNumber - 1] = newContent
  await writeNote(date, lines.join('\n'))
}

// ============================================================================
// Pages (Tag Pages) File Operations
// ============================================================================

/**
 * Get the pages directory path where tag pages are stored
 */
export function getPagesDirectory(): string {
  return path.join(getChynotesDirectory(), PAGES_SUBDIR)
}

/**
 * Ensure the pages directory exists
 */
export async function ensurePagesDirectory(): Promise<void> {
  const pagesDir = getPagesDirectory()
  if (!existsSync(pagesDir)) {
    await fs.mkdir(pagesDir, { recursive: true })
  }
}

/**
 * Ensure the pages directory exists (sync version)
 */
export function ensurePagesDirectorySync(): void {
  const pagesDir = getPagesDirectory()
  if (!existsSync(pagesDir)) {
    mkdirSync(pagesDir, { recursive: true })
  }
}

/**
 * Get the file path for a page
 * Handles hierarchical pages like "project/website" -> "pages/project/website.md"
 */
export function getPagePath(name: string): string {
  // Normalize the name (lowercase, no leading/trailing slashes)
  const normalizedName = name.toLowerCase().replace(/^\/+|\/+$/g, '')
  return path.join(getPagesDirectory(), `${normalizedName}.md`)
}

/**
 * Read a page's content
 * @returns The page content, or null if the file doesn't exist
 */
export async function readPage(name: string): Promise<string | null> {
  const filePath = getPagePath(name)

  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return content
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw error
  }
}

/**
 * Write (or overwrite) a page
 * Creates parent directories if needed for hierarchical pages
 */
export async function writePage(name: string, content: string): Promise<void> {
  await ensurePagesDirectory()
  const filePath = getPagePath(name)

  // Ensure parent directory exists for hierarchical pages
  const dir = path.dirname(filePath)
  if (!existsSync(dir)) {
    await fs.mkdir(dir, { recursive: true })
  }

  await fs.writeFile(filePath, content, 'utf-8')
}

/**
 * Check if a page file exists
 */
export async function pageFileExists(name: string): Promise<boolean> {
  const filePath = getPagePath(name)
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Create an empty page if it doesn't exist
 * Returns true if created, false if already exists
 */
export async function createPageIfNotExists(name: string): Promise<boolean> {
  const exists = await pageFileExists(name)
  if (exists) {
    return false
  }

  // Create empty page with just a header
  const initialContent = `# ${name}\n\n`
  await writePage(name, initialContent)
  return true
}

/**
 * List all pages in the pages directory
 * @returns Array of page names (without .md extension)
 */
export async function listAllPages(): Promise<string[]> {
  const pagesDir = getPagesDirectory()

  try {
    const pages: string[] = []

    async function scanDir(dir: string, prefix: string = ''): Promise<void> {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          // Recursively scan subdirectories for hierarchical pages
          await scanDir(fullPath, prefix ? `${prefix}/${entry.name}` : entry.name)
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          // Extract page name without .md extension
          const pageName = entry.name.slice(0, -3)
          pages.push(prefix ? `${prefix}/${pageName}` : pageName)
        }
      }
    }

    await scanDir(pagesDir)
    pages.sort()
    return pages
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw error
  }
}

/**
 * Delete a page file
 */
export async function deletePageFile(name: string): Promise<void> {
  const filePath = getPagePath(name)
  try {
    await fs.unlink(filePath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
}
