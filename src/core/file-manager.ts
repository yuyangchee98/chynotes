import * as fs from 'fs/promises'
import * as path from 'path'
import { existsSync, mkdirSync } from 'fs'
import { homedir } from 'os'

const NOTES_DIR_NAME = '.chynotes'
const NOTES_SUBDIR = 'notes'

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
 */
export async function writeNote(date: Date, content: string): Promise<void> {
  await ensureNotesDirectory()
  const filePath = getNotePath(date)
  await fs.writeFile(filePath, content, 'utf-8')
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
