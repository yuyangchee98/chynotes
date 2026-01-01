import Database from 'better-sqlite3'
import path from 'path'
import { getChynotesDirectory } from './file-manager'

const DB_NAME = 'chynotes.db'

let db: Database.Database | null = null

/**
 * Get the database file path
 */
export function getDatabasePath(): string {
  return path.join(getChynotesDirectory(), DB_NAME)
}

/**
 * Initialize the database connection and create tables if needed
 */
export function initDatabase(): Database.Database {
  if (db) return db

  const dbPath = getDatabasePath()
  db = new Database(dbPath)

  // Enable WAL mode for better concurrent performance
  db.pragma('journal_mode = WAL')

  // Create tables
  createTables(db)

  return db
}

/**
 * Get the database instance (must call initDatabase first)
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

/**
 * Create all required tables
 */
function createTables(database: Database.Database): void {
  database.exec(`
    -- Notes metadata (content stays in markdown files)
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      file_hash TEXT,
      updated_at INTEGER
    );

    -- Canonical tag names
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      prompt TEXT,
      created_at INTEGER
    );

    -- Where tags appear in notes
    CREATE TABLE IF NOT EXISTS tag_occurrences (
      id INTEGER PRIMARY KEY,
      tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
      note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
      line INTEGER,
      content TEXT,
      UNIQUE(tag_id, note_id, line)
    );

    -- Generated code cache
    CREATE TABLE IF NOT EXISTS cache (
      id INTEGER PRIMARY KEY,
      tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
      content_hash TEXT,
      generated_code TEXT,
      created_at INTEGER
    );

    -- App settings
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    -- Create indexes for faster queries
    CREATE INDEX IF NOT EXISTS idx_notes_date ON notes(date);
    CREATE INDEX IF NOT EXISTS idx_tag_name ON tags(name);
    CREATE INDEX IF NOT EXISTS idx_occurrence_tag ON tag_occurrences(tag_id);
    CREATE INDEX IF NOT EXISTS idx_occurrence_note ON tag_occurrences(note_id);
    CREATE INDEX IF NOT EXISTS idx_cache_tag ON cache(tag_id);
  `)
}

// ============================================================================
// Notes Table Operations
// ============================================================================

export interface NoteRecord {
  id: number
  date: string
  file_hash: string | null
  updated_at: number
}

export function upsertNote(date: string, fileHash: string): NoteRecord {
  const db = getDatabase()
  const now = Date.now()

  const stmt = db.prepare(`
    INSERT INTO notes (date, file_hash, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      file_hash = excluded.file_hash,
      updated_at = excluded.updated_at
    RETURNING *
  `)

  return stmt.get(date, fileHash, now) as NoteRecord
}

export function getNoteByDate(date: string): NoteRecord | undefined {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM notes WHERE date = ?')
  return stmt.get(date) as NoteRecord | undefined
}

export function deleteNote(date: string): void {
  const db = getDatabase()
  const stmt = db.prepare('DELETE FROM notes WHERE date = ?')
  stmt.run(date)
}

// ============================================================================
// Tags Table Operations
// ============================================================================

export interface TagRecord {
  id: number
  name: string
  prompt: string | null
  created_at: number
}

export function getOrCreateTag(name: string): TagRecord {
  const db = getDatabase()
  const now = Date.now()

  // Try to get existing tag
  let tag = db.prepare('SELECT * FROM tags WHERE name = ?').get(name) as TagRecord | undefined

  if (!tag) {
    // Create new tag
    const stmt = db.prepare(`
      INSERT INTO tags (name, created_at)
      VALUES (?, ?)
      RETURNING *
    `)
    tag = stmt.get(name, now) as TagRecord
  }

  return tag
}

export function getTagByName(name: string): TagRecord | undefined {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM tags WHERE name = ?')
  return stmt.get(name) as TagRecord | undefined
}

export function getAllTags(): TagRecord[] {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM tags ORDER BY name')
  return stmt.all() as TagRecord[]
}

export function updateTagPrompt(tagId: number, prompt: string): void {
  const db = getDatabase()
  const stmt = db.prepare('UPDATE tags SET prompt = ? WHERE id = ?')
  stmt.run(prompt, tagId)
}

export function deleteTag(tagId: number): void {
  const db = getDatabase()
  const stmt = db.prepare('DELETE FROM tags WHERE id = ?')
  stmt.run(tagId)
}

// ============================================================================
// Tag Occurrences Table Operations
// ============================================================================

export interface TagOccurrenceRecord {
  id: number
  tag_id: number
  note_id: number
  line: number
  content: string
}

export function addTagOccurrence(
  tagId: number,
  noteId: number,
  line: number,
  content: string
): void {
  const db = getDatabase()
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO tag_occurrences (tag_id, note_id, line, content)
    VALUES (?, ?, ?, ?)
  `)
  stmt.run(tagId, noteId, line, content)
}

export function deleteOccurrencesForNote(noteId: number): void {
  const db = getDatabase()
  const stmt = db.prepare('DELETE FROM tag_occurrences WHERE note_id = ?')
  stmt.run(noteId)
}

export interface TagOccurrenceWithDetails {
  tag_name: string
  date: string
  line: number
  content: string
}

export function getOccurrencesForTag(tagName: string): TagOccurrenceWithDetails[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT t.name as tag_name, n.date, o.line, o.content
    FROM tag_occurrences o
    JOIN tags t ON o.tag_id = t.id
    JOIN notes n ON o.note_id = n.id
    WHERE t.name = ?
    ORDER BY n.date DESC, o.line ASC
  `)
  return stmt.all(tagName) as TagOccurrenceWithDetails[]
}

export interface TagWithCount {
  id: number
  name: string
  prompt: string | null
  count: number
}

export function getTagsWithCounts(): TagWithCount[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT t.id, t.name, t.prompt, COUNT(o.id) as count
    FROM tags t
    LEFT JOIN tag_occurrences o ON t.id = o.tag_id
    GROUP BY t.id
    HAVING COUNT(o.id) > 0
    ORDER BY t.name
  `)
  return stmt.all() as TagWithCount[]
}

// ============================================================================
// Cache Table Operations
// ============================================================================

export interface CacheRecord {
  id: number
  tag_id: number
  content_hash: string
  generated_code: string
  created_at: number
}

export function getCachedCode(tagId: number, contentHash: string): string | null {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT generated_code FROM cache
    WHERE tag_id = ? AND content_hash = ?
  `)
  const result = stmt.get(tagId, contentHash) as { generated_code: string } | undefined
  return result?.generated_code ?? null
}

export function setCachedCode(tagId: number, contentHash: string, code: string): void {
  const db = getDatabase()
  const now = Date.now()

  // Delete old cache entries for this tag
  db.prepare('DELETE FROM cache WHERE tag_id = ?').run(tagId)

  // Insert new cache entry
  const stmt = db.prepare(`
    INSERT INTO cache (tag_id, content_hash, generated_code, created_at)
    VALUES (?, ?, ?, ?)
  `)
  stmt.run(tagId, contentHash, code, now)
}

// ============================================================================
// Settings Table Operations
// ============================================================================

export function getSetting(key: string): string | null {
  const db = getDatabase()
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?')
  const result = stmt.get(key) as { value: string } | undefined
  return result?.value ?? null
}

export function setSetting(key: string, value: string): void {
  const db = getDatabase()
  const stmt = db.prepare(`
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `)
  stmt.run(key, value)
}

export function deleteSetting(key: string): void {
  const db = getDatabase()
  const stmt = db.prepare('DELETE FROM settings WHERE key = ?')
  stmt.run(key)
}
