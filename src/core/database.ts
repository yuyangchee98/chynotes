import Database from 'better-sqlite3'
import path from 'path'
import { getChynotesDirectory } from './file-manager'
import { runMigrations } from './migrations'
import type { DocumentType, SnapshotRecord, BlockRecord } from './types'

// Re-export types for backwards compatibility
export type { DocumentType, SnapshotRecord, BlockRecord }

const DB_NAME = 'chynotes.db'

// Default embedding dimension (mxbai-embed-large uses 1024)
export const EMBEDDING_DIMENSION = 1024

let db: Database.Database | null = null
let vecExtensionLoaded = false

/**
 * Get the path to the sqlite-vec native extension.
 * In development, use the node_modules path directly.
 * In production (packaged app), use the unpacked resources path.
 *
 * Note: sqlite-vec-darwin-arm64 is nested inside sqlite-vec/node_modules/
 */
function getSqliteVecPath(): string {
  const platform = process.platform === 'win32' ? 'windows' : process.platform
  const arch = process.arch
  const ext = process.platform === 'win32' ? 'dll' : process.platform === 'darwin' ? 'dylib' : 'so'
  const packageName = `sqlite-vec-${platform}-${arch}`
  const filename = `vec0.${ext}`

  // Check if we're running in a packaged Electron app
  // In packaged apps, __dirname will be inside app.asar
  const isPackaged = __dirname.includes('app.asar')

  if (isPackaged) {
    // In packaged app, use the unpacked path
    // app.asar -> app.asar.unpacked
    // The native package is nested: sqlite-vec/node_modules/sqlite-vec-darwin-arm64/
    const unpackedPath = __dirname.replace('app.asar', 'app.asar.unpacked')
    return path.join(unpackedPath, '..', '..', 'node_modules', 'sqlite-vec', 'node_modules', packageName, filename)
  } else {
    // In development, the package might be at top level or nested
    const topLevel = path.join(__dirname, '..', '..', 'node_modules', packageName, filename)
    const nested = path.join(__dirname, '..', '..', 'node_modules', 'sqlite-vec', 'node_modules', packageName, filename)
    // Try nested first (more common with npm), then top level
    try {
      require('fs').accessSync(nested)
      return nested
    } catch {
      return topLevel
    }
  }
}

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

  // Load sqlite-vec extension for vector search
  if (!vecExtensionLoaded) {
    const vecPath = getSqliteVecPath()
    db.loadExtension(vecPath)
    vecExtensionLoaded = true
  }

  // Create tables
  createTables(db)

  // Create vector tables (separate because virtual tables need extension loaded first)
  createVectorTables(db)

  // Run any pending migrations
  runMigrations(db)

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

    -- Pages metadata (tag pages stored as markdown files)
    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      file_hash TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );

    -- Document snapshots for viewing evolution of thought
    -- document_type: 'note' for daily notes, 'page' for tag pages
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY,
      note_date TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      content_hash TEXT NOT NULL,
      document_type TEXT NOT NULL DEFAULT 'note'
    );

    -- Blocks table for block-based structure
    CREATE TABLE IF NOT EXISTS blocks (
      id TEXT PRIMARY KEY,
      note_date TEXT NOT NULL,
      content TEXT NOT NULL,
      parent_id TEXT,
      indent_level INTEGER DEFAULT 0,
      line_number INTEGER,
      updated_at INTEGER,
      embedded_at INTEGER,
      FOREIGN KEY (parent_id) REFERENCES blocks(id) ON DELETE SET NULL
    );

    -- Block tags (which tags appear in which blocks)
    CREATE TABLE IF NOT EXISTS block_tags (
      id INTEGER PRIMARY KEY,
      block_id TEXT NOT NULL,
      tag_name TEXT NOT NULL,
      FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE,
      UNIQUE(block_id, tag_name)
    );

    -- Term frequency for Phase 2 tag suggestions
    -- Tracks untagged terms that appear across multiple notes
    CREATE TABLE IF NOT EXISTS term_frequency (
      id INTEGER PRIMARY KEY,
      term TEXT UNIQUE NOT NULL,
      original_forms TEXT NOT NULL,  -- JSON array of original forms ["Sarah", "SARAH"]
      note_count INTEGER NOT NULL DEFAULT 0,
      total_count INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL,  -- JSON array of note dates
      updated_at INTEGER
    );

    -- Create indexes for faster queries
    CREATE INDEX IF NOT EXISTS idx_notes_date ON notes(date);
    CREATE INDEX IF NOT EXISTS idx_tag_name ON tags(name);
    CREATE INDEX IF NOT EXISTS idx_occurrence_tag ON tag_occurrences(tag_id);
    CREATE INDEX IF NOT EXISTS idx_occurrence_note ON tag_occurrences(note_id);
    CREATE INDEX IF NOT EXISTS idx_cache_tag ON cache(tag_id);
    CREATE INDEX IF NOT EXISTS idx_pages_name ON pages(name);
    CREATE INDEX IF NOT EXISTS idx_snapshots_note_date ON snapshots(note_date);
    CREATE INDEX IF NOT EXISTS idx_snapshots_created_at ON snapshots(note_date, created_at);
    CREATE INDEX IF NOT EXISTS idx_snapshots_document_type ON snapshots(document_type);
    CREATE INDEX IF NOT EXISTS idx_blocks_note_date ON blocks(note_date);
    CREATE INDEX IF NOT EXISTS idx_blocks_parent ON blocks(parent_id);
    CREATE INDEX IF NOT EXISTS idx_block_tags_block ON block_tags(block_id);
    CREATE INDEX IF NOT EXISTS idx_block_tags_tag ON block_tags(tag_name);
    CREATE INDEX IF NOT EXISTS idx_term_frequency_term ON term_frequency(term);
    CREATE INDEX IF NOT EXISTS idx_term_frequency_note_count ON term_frequency(note_count);
  `)

  // Migration: Add embedded_at column if it doesn't exist (for existing databases)
  const columns = database.pragma('table_info(blocks)') as { name: string }[]
  const hasEmbeddedAt = columns.some(col => col.name === 'embedded_at')
  if (!hasEmbeddedAt) {
    database.exec('ALTER TABLE blocks ADD COLUMN embedded_at INTEGER')
  }
}

/**
 * Create vector search tables (requires sqlite-vec extension to be loaded)
 */
function createVectorTables(database: Database.Database): void {
  // Check if vec_blocks virtual table already exists
  const tableExists = database.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='vec_blocks'
  `).get()

  if (!tableExists) {
    // Create virtual table for vector search
    // Using cosine distance metric for semantic similarity
    database.exec(`
      CREATE VIRTUAL TABLE vec_blocks USING vec0(
        block_id TEXT PRIMARY KEY,
        embedding float[${EMBEDDING_DIMENSION}] distance_metric=cosine
      )
    `)
  }
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

  // Use INSERT OR IGNORE to atomically handle concurrent creates.
  // This avoids the race where two threads both see the tag doesn't exist
  // and both try to insert, causing a UNIQUE constraint violation.
  db.prepare(`
    INSERT OR IGNORE INTO tags (name, created_at)
    VALUES (?, ?)
  `).run(name, now)

  // Tag is guaranteed to exist now - fetch it
  return db.prepare('SELECT * FROM tags WHERE name = ?').get(name) as TagRecord
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

export function getCachedCodeByTagName(tagName: string): string | null {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT c.generated_code FROM cache c
    JOIN tags t ON c.tag_id = t.id
    WHERE t.name = ?
    ORDER BY c.created_at DESC
    LIMIT 1
  `)
  const result = stmt.get(tagName) as { generated_code: string } | undefined
  return result?.generated_code ?? null
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

// ============================================================================
// Snapshots Table Operations
// ============================================================================

/**
 * Simple hash function for content comparison
 */
function hashContent(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash.toString(16)
}

/**
 * Save a snapshot if content has changed since last snapshot
 * Returns the new snapshot record, or null if skipped (no change)
 */
export function saveSnapshot(
  noteDate: string,
  content: string,
  documentType: DocumentType = 'note'
): SnapshotRecord | null {
  const db = getDatabase()
  const contentHash = hashContent(content)
  const now = Date.now()

  // Atomic insert-if-changed: only inserts if the hash differs from the most recent snapshot.
  // This avoids the race where two concurrent calls both see "changed" and both insert.
  const stmt = db.prepare(`
    INSERT INTO snapshots (note_date, content, created_at, content_hash, document_type)
    SELECT ?, ?, ?, ?, ?
    WHERE NOT EXISTS (
      SELECT 1 FROM snapshots
      WHERE note_date = ? AND document_type = ? AND content_hash = ?
      ORDER BY created_at DESC
      LIMIT 1
    )
    RETURNING *
  `)

  const result = stmt.get(
    noteDate, content, now, contentHash, documentType,
    noteDate, documentType, contentHash
  ) as SnapshotRecord | undefined

  return result ?? null
}

/**
 * Get all snapshots for a document, ordered by creation time (newest first)
 */
export function getSnapshotsForNote(
  noteDate: string,
  documentType: DocumentType = 'note'
): SnapshotRecord[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT * FROM snapshots
    WHERE note_date = ? AND document_type = ?
    ORDER BY created_at DESC
  `)
  return stmt.all(noteDate, documentType) as SnapshotRecord[]
}

/**
 * Get a specific snapshot by ID
 */
export function getSnapshot(id: number): SnapshotRecord | null {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM snapshots WHERE id = ?')
  return (stmt.get(id) as SnapshotRecord) || null
}

/**
 * Delete old snapshots, keeping only the most recent N
 */
export function pruneSnapshots(
  noteDate: string,
  keepCount: number,
  documentType: DocumentType = 'note'
): void {
  const db = getDatabase()
  db.prepare(`
    DELETE FROM snapshots
    WHERE note_date = ? AND document_type = ?
    AND id NOT IN (
      SELECT id FROM snapshots
      WHERE note_date = ? AND document_type = ?
      ORDER BY created_at DESC
      LIMIT ?
    )
  `).run(noteDate, documentType, noteDate, documentType, keepCount)
}

/**
 * Get total count of all snapshots in the database
 */
export function getSnapshotCount(): number {
  const db = getDatabase()
  const result = db.prepare('SELECT COUNT(*) as count FROM snapshots').get() as { count: number }
  return result.count
}

/**
 * Delete snapshots older than the specified number of days
 * Returns the number of deleted snapshots
 */
export function pruneSnapshotsByAge(retentionDays: number): number {
  const db = getDatabase()
  const cutoffTimestamp = Date.now() - (retentionDays * 24 * 60 * 60 * 1000)

  const result = db.prepare(`
    DELETE FROM snapshots
    WHERE created_at < ?
  `).run(cutoffTimestamp)

  return result.changes
}

/**
 * Automatically cleanup snapshots based on user settings
 * Called on app startup. Returns number of deleted snapshots.
 */
export function autoCleanupSnapshots(): number {
  const autoCleanup = getSetting('snapshotAutoCleanup')

  // Only cleanup if explicitly enabled
  if (autoCleanup !== 'true') {
    return 0
  }

  const retentionDays = getSetting('snapshotRetentionDays')
  const days = retentionDays ? parseInt(retentionDays) : 0

  // 0 means unlimited retention
  if (days <= 0) {
    return 0
  }

  return pruneSnapshotsByAge(days)
}

// ============================================================================
// Pages Table Operations
// ============================================================================

export interface PageRecord {
  id: number
  name: string
  file_hash: string | null
  created_at: number
  updated_at: number
}

/**
 * Create or update a page record
 */
export function upsertPage(name: string, fileHash: string | null = null): PageRecord {
  const db = getDatabase()
  const now = Date.now()

  const stmt = db.prepare(`
    INSERT INTO pages (name, file_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      file_hash = excluded.file_hash,
      updated_at = excluded.updated_at
    RETURNING *
  `)

  return stmt.get(name, fileHash, now, now) as PageRecord
}

/**
 * Get a page by name
 */
export function getPageByName(name: string): PageRecord | undefined {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM pages WHERE name = ?')
  return stmt.get(name) as PageRecord | undefined
}

/**
 * Get all pages
 */
export function getAllPages(): PageRecord[] {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM pages ORDER BY name')
  return stmt.all() as PageRecord[]
}

/**
 * Delete a page
 */
export function deletePage(name: string): void {
  const db = getDatabase()
  const stmt = db.prepare('DELETE FROM pages WHERE name = ?')
  stmt.run(name)
}

/**
 * Check if a page exists
 */
export function pageExists(name: string): boolean {
  const db = getDatabase()
  const stmt = db.prepare('SELECT 1 FROM pages WHERE name = ?')
  return stmt.get(name) !== undefined
}

// ============================================================================
// Blocks Table Operations
// ============================================================================

/**
 * Upsert a block (insert or update)
 */
export function upsertBlock(
  id: string,
  noteDate: string,
  content: string,
  parentId: string | null,
  indentLevel: number,
  lineNumber: number
): void {
  const db = getDatabase()
  const now = Date.now()

  db.prepare(`
    INSERT INTO blocks (id, note_date, content, parent_id, indent_level, line_number, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      note_date = excluded.note_date,
      content = excluded.content,
      parent_id = excluded.parent_id,
      indent_level = excluded.indent_level,
      line_number = excluded.line_number,
      updated_at = excluded.updated_at
  `).run(id, noteDate, content, parentId, indentLevel, lineNumber, now)
}

/**
 * Get a block by ID
 */
export function getBlockById(id: string): BlockRecord | null {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM blocks WHERE id = ?')
  return (stmt.get(id) as BlockRecord) || null
}

/**
 * Get a block with all its children (based on indent level)
 */
export function getBlockWithChildren(id: string): BlockRecord[] {
  const parent = getBlockById(id)
  if (!parent) return []

  // Get all blocks from the same note, ordered by line number
  const allBlocks = getBlocksForNote(parent.note_date)

  // Find the parent block and collect children
  const result: BlockRecord[] = [parent]
  const parentIndex = allBlocks.findIndex(b => b.id === id)
  if (parentIndex === -1) return result

  const parentIndent = parent.indent_level

  // Collect all following blocks with higher indent (children)
  for (let i = parentIndex + 1; i < allBlocks.length; i++) {
    const block = allBlocks[i]
    if (block.indent_level <= parentIndent) break // Same or less indent = sibling/parent
    result.push(block)
  }

  return result
}

/**
 * Get all blocks for a note date
 */
export function getBlocksForNote(noteDate: string): BlockRecord[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT * FROM blocks
    WHERE note_date = ?
    ORDER BY line_number ASC
  `)
  return stmt.all(noteDate) as BlockRecord[]
}

/**
 * Delete all blocks for a note
 */
export function deleteBlocksForNote(noteDate: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM blocks WHERE note_date = ?').run(noteDate)
}

/**
 * Add a tag to a block
 */
export function addBlockTag(blockId: string, tagName: string): void {
  const db = getDatabase()
  db.prepare(`
    INSERT OR IGNORE INTO block_tags (block_id, tag_name)
    VALUES (?, ?)
  `).run(blockId, tagName.toLowerCase())
}

/**
 * Get all blocks containing a specific tag
 */
export function getBlocksWithTag(tagName: string): BlockRecord[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT b.* FROM blocks b
    JOIN block_tags bt ON b.id = bt.block_id
    WHERE bt.tag_name = ?
    ORDER BY b.note_date DESC, b.line_number ASC
  `)
  return stmt.all(tagName.toLowerCase()) as BlockRecord[]
}

/**
 * Block with nested children for tree display
 */
export interface BlockWithChildren extends BlockRecord {
  children: BlockWithChildren[]
}

/**
 * Get all children of a block (recursive)
 */
function getChildBlocks(db: ReturnType<typeof getDatabase>, parentId: string, noteDate: string): BlockWithChildren[] {
  const stmt = db.prepare(`
    SELECT * FROM blocks
    WHERE parent_id = ? AND note_date = ?
    ORDER BY line_number ASC
  `)
  const children = stmt.all(parentId, noteDate) as BlockRecord[]

  return children.map(child => ({
    ...child,
    children: getChildBlocks(db, child.id, noteDate)
  }))
}

/**
 * Get all blocks containing a specific tag, with their children
 */
export function getBlocksWithTagAndChildren(tagName: string): BlockWithChildren[] {
  const db = getDatabase()
  const blocks = getBlocksWithTag(tagName)

  return blocks.map(block => ({
    ...block,
    children: getChildBlocks(db, block.id, block.note_date)
  }))
}

/**
 * Delete all tags for a block
 */
export function deleteBlockTags(blockId: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM block_tags WHERE block_id = ?').run(blockId)
}

/**
 * Get all tags for a specific block
 */
export function getBlockTags(blockId: string): string[] {
  const db = getDatabase()
  const rows = db.prepare('SELECT tag_name FROM block_tags WHERE block_id = ?').all(blockId) as { tag_name: string }[]
  return rows.map(r => r.tag_name)
}

// ============================================================================
// Vector Embeddings Operations
// ============================================================================

export interface VecBlockRecord {
  block_id: string
  distance: number
}

/**
 * Insert or update a block's embedding
 */
export function upsertBlockEmbedding(blockId: string, embedding: Float32Array): void {
  const db = getDatabase()

  // Delete existing embedding for this block (if any)
  db.prepare('DELETE FROM vec_blocks WHERE block_id = ?').run(blockId)

  // Insert new embedding
  db.prepare(`
    INSERT INTO vec_blocks(block_id, embedding)
    VALUES (?, ?)
  `).run(blockId, embedding)

  // Mark block as embedded
  db.prepare('UPDATE blocks SET embedded_at = ? WHERE id = ?')
    .run(Date.now(), blockId)
}

/**
 * Get embedding for a specific block
 */
export function getBlockEmbedding(blockId: string): Float32Array | null {
  const db = getDatabase()
  const result = db.prepare(`
    SELECT embedding FROM vec_blocks WHERE block_id = ?
  `).get(blockId) as { embedding: Buffer } | undefined

  if (!result) return null

  // Convert Buffer to Float32Array
  return new Float32Array(result.embedding.buffer, result.embedding.byteOffset, result.embedding.byteLength / 4)
}

/**
 * Get embeddings for multiple blocks
 */
export function getBlockEmbeddings(blockIds: string[]): Map<string, Float32Array> {
  const db = getDatabase()
  const result = new Map<string, Float32Array>()

  if (blockIds.length === 0) return result

  const placeholders = blockIds.map(() => '?').join(',')
  const rows = db.prepare(`
    SELECT block_id, embedding FROM vec_blocks
    WHERE block_id IN (${placeholders})
  `).all(...blockIds) as { block_id: string; embedding: Buffer }[]

  for (const row of rows) {
    const arr = new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4)
    result.set(row.block_id, arr)
  }

  return result
}

/**
 * Find blocks similar to a query embedding using KNN
 */
export function findSimilarBlocksKNN(queryEmbedding: Float32Array, limit: number = 20): VecBlockRecord[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT block_id, distance
    FROM vec_blocks
    WHERE embedding MATCH ?
      AND k = ?
  `).all(queryEmbedding, limit) as VecBlockRecord[]
}

/**
 * Delete embedding for a block
 */
export function deleteBlockEmbedding(blockId: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM vec_blocks WHERE block_id = ?').run(blockId)
  db.prepare('UPDATE blocks SET embedded_at = NULL WHERE id = ?').run(blockId)
}

/**
 * Get count of blocks that have embeddings
 */
export function getEmbeddedBlockCount(): number {
  const db = getDatabase()
  const result = db.prepare('SELECT COUNT(*) as count FROM vec_blocks').get() as { count: number }
  return result.count
}

/**
 * Get count of all blocks
 */
export function getTotalBlockCount(): number {
  const db = getDatabase()
  const result = db.prepare('SELECT COUNT(*) as count FROM blocks').get() as { count: number }
  return result.count
}

/**
 * Get blocks that need embedding (no embedded_at or content changed)
 */
export function getBlocksNeedingEmbedding(limit: number = 100): BlockRecord[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM blocks
    WHERE embedded_at IS NULL
       OR embedded_at < updated_at
    ORDER BY updated_at DESC
    LIMIT ?
  `).all(limit) as BlockRecord[]
}

// ============================================================================
// Term Frequency Table Operations (Phase 2 Tag Suggestions)
// ============================================================================

export interface TermFrequencyRecord {
  id: number
  term: string
  original_forms: string  // JSON array
  note_count: number
  total_count: number
  notes: string  // JSON array
  updated_at: number
}

export interface TermFrequency {
  term: string
  originalForms: string[]
  noteCount: number
  totalCount: number
  notes: string[]
}

/**
 * Get term frequency by normalized term
 */
export function getTermFrequency(term: string): TermFrequency | null {
  const db = getDatabase()
  const record = db.prepare('SELECT * FROM term_frequency WHERE term = ?')
    .get(term) as TermFrequencyRecord | undefined

  if (!record) return null

  return {
    term: record.term,
    originalForms: JSON.parse(record.original_forms),
    noteCount: record.note_count,
    totalCount: record.total_count,
    notes: JSON.parse(record.notes)
  }
}

/**
 * Get all terms with noteCount >= minNoteCount
 */
export function getFrequentTerms(minNoteCount: number = 2): TermFrequency[] {
  const db = getDatabase()
  const records = db.prepare(`
    SELECT * FROM term_frequency
    WHERE note_count >= ?
    ORDER BY note_count DESC, total_count DESC
  `).all(minNoteCount) as TermFrequencyRecord[]

  return records.map(record => ({
    term: record.term,
    originalForms: JSON.parse(record.original_forms),
    noteCount: record.note_count,
    totalCount: record.total_count,
    notes: JSON.parse(record.notes)
  }))
}

/**
 * Upsert term frequency data
 */
export function upsertTermFrequency(
  term: string,
  originalForms: string[],
  noteCount: number,
  totalCount: number,
  notes: string[]
): void {
  const db = getDatabase()
  const now = Date.now()

  db.prepare(`
    INSERT INTO term_frequency (term, original_forms, note_count, total_count, notes, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(term) DO UPDATE SET
      original_forms = excluded.original_forms,
      note_count = excluded.note_count,
      total_count = excluded.total_count,
      notes = excluded.notes,
      updated_at = excluded.updated_at
  `).run(term, JSON.stringify(originalForms), noteCount, totalCount, JSON.stringify(notes), now)
}

/**
 * Delete a term from frequency index
 */
export function deleteTermFrequency(term: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM term_frequency WHERE term = ?').run(term)
}

/**
 * Clear all term frequency data (for full rebuild)
 */
export function clearTermFrequency(): void {
  const db = getDatabase()
  db.prepare('DELETE FROM term_frequency').run()
}

// ============================================================================
// Tag Co-occurrence Operations (for Graph View)
// ============================================================================

export interface TagCooccurrence {
  tag1: string
  tag2: string
  weight: number
}

/**
 * Get all tag co-occurrences (tags appearing in the same block)
 * Returns pairs of tags with their co-occurrence count
 */
export function getTagCooccurrences(): TagCooccurrence[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT bt1.tag_name as tag1, bt2.tag_name as tag2, COUNT(*) as weight
    FROM block_tags bt1
    JOIN block_tags bt2 ON bt1.block_id = bt2.block_id
    WHERE bt1.tag_name < bt2.tag_name
    GROUP BY bt1.tag_name, bt2.tag_name
    ORDER BY weight DESC
  `).all() as TagCooccurrence[]
}

// ============================================================================
// Tag Prompts Operations (Custom AI prompts per tag)
// ============================================================================

export interface TagPromptRecord {
  id: number
  tag_id: number
  name: string
  prompt: string
  response: string | null
  updated_at: number | null
}

/**
 * Get all prompts for a tag
 */
export function getTagPrompts(tagName: string): TagPromptRecord[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT tp.* FROM tag_prompts tp
    JOIN tags t ON tp.tag_id = t.id
    WHERE t.name = ?
    ORDER BY tp.id ASC
  `).all(tagName.toLowerCase()) as TagPromptRecord[]
}

/**
 * Get a single prompt by ID
 */
export function getTagPromptById(id: number): TagPromptRecord | null {
  const db = getDatabase()
  return db.prepare('SELECT * FROM tag_prompts WHERE id = ?').get(id) as TagPromptRecord | null
}

/**
 * Create a new prompt for a tag
 */
export function createTagPrompt(tagName: string, name: string, prompt: string): TagPromptRecord {
  const db = getDatabase()
  const tag = getOrCreateTag(tagName.toLowerCase())
  const now = Date.now()

  const result = db.prepare(`
    INSERT INTO tag_prompts (tag_id, name, prompt, updated_at)
    VALUES (?, ?, ?, ?)
    RETURNING *
  `).get(tag.id, name, prompt, now) as TagPromptRecord

  return result
}

/**
 * Update an existing prompt
 */
export function updateTagPromptRecord(id: number, name: string, prompt: string): TagPromptRecord | null {
  const db = getDatabase()
  const now = Date.now()

  return db.prepare(`
    UPDATE tag_prompts
    SET name = ?, prompt = ?, updated_at = ?
    WHERE id = ?
    RETURNING *
  `).get(name, prompt, now, id) as TagPromptRecord | null
}

/**
 * Save AI response for a prompt
 */
export function saveTagPromptResponse(id: number, response: string): void {
  const db = getDatabase()
  const now = Date.now()

  db.prepare(`
    UPDATE tag_prompts
    SET response = ?, updated_at = ?
    WHERE id = ?
  `).run(response, now, id)
}

/**
 * Delete a prompt
 */
export function deleteTagPrompt(id: number): void {
  const db = getDatabase()
  db.prepare('DELETE FROM tag_prompts WHERE id = ?').run(id)
}
