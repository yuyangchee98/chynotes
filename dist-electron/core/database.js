"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMBEDDING_DIMENSION = void 0;
exports.getDatabasePath = getDatabasePath;
exports.initDatabase = initDatabase;
exports.getDatabase = getDatabase;
exports.closeDatabase = closeDatabase;
exports.upsertNote = upsertNote;
exports.getNoteByDate = getNoteByDate;
exports.deleteNote = deleteNote;
exports.getOrCreateTag = getOrCreateTag;
exports.getTagByName = getTagByName;
exports.getAllTags = getAllTags;
exports.updateTagPrompt = updateTagPrompt;
exports.deleteTag = deleteTag;
exports.addTagOccurrence = addTagOccurrence;
exports.deleteOccurrencesForNote = deleteOccurrencesForNote;
exports.getOccurrencesForTag = getOccurrencesForTag;
exports.getTagsWithCounts = getTagsWithCounts;
exports.getCachedCode = getCachedCode;
exports.setCachedCode = setCachedCode;
exports.getCachedCodeByTagName = getCachedCodeByTagName;
exports.getSetting = getSetting;
exports.setSetting = setSetting;
exports.deleteSetting = deleteSetting;
exports.saveSnapshot = saveSnapshot;
exports.getSnapshotsForNote = getSnapshotsForNote;
exports.getSnapshot = getSnapshot;
exports.pruneSnapshots = pruneSnapshots;
exports.getSnapshotCount = getSnapshotCount;
exports.pruneSnapshotsByAge = pruneSnapshotsByAge;
exports.autoCleanupSnapshots = autoCleanupSnapshots;
exports.upsertPage = upsertPage;
exports.getPageByName = getPageByName;
exports.getAllPages = getAllPages;
exports.deletePage = deletePage;
exports.pageExists = pageExists;
exports.upsertBlock = upsertBlock;
exports.getBlockById = getBlockById;
exports.getBlockWithChildren = getBlockWithChildren;
exports.getBlocksForNote = getBlocksForNote;
exports.deleteBlocksForNote = deleteBlocksForNote;
exports.addBlockTag = addBlockTag;
exports.getBlocksWithTag = getBlocksWithTag;
exports.getBlocksWithTagAndChildren = getBlocksWithTagAndChildren;
exports.deleteBlockTags = deleteBlockTags;
exports.getBlockTags = getBlockTags;
exports.upsertBlockEmbedding = upsertBlockEmbedding;
exports.getBlockEmbedding = getBlockEmbedding;
exports.getBlockEmbeddings = getBlockEmbeddings;
exports.findSimilarBlocksKNN = findSimilarBlocksKNN;
exports.deleteBlockEmbedding = deleteBlockEmbedding;
exports.getEmbeddedBlockCount = getEmbeddedBlockCount;
exports.getTotalBlockCount = getTotalBlockCount;
exports.getBlocksNeedingEmbedding = getBlocksNeedingEmbedding;
exports.getTermFrequency = getTermFrequency;
exports.getFrequentTerms = getFrequentTerms;
exports.upsertTermFrequency = upsertTermFrequency;
exports.deleteTermFrequency = deleteTermFrequency;
exports.clearTermFrequency = clearTermFrequency;
exports.getTagCooccurrences = getTagCooccurrences;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const sqliteVec = __importStar(require("sqlite-vec"));
const path_1 = __importDefault(require("path"));
const file_manager_1 = require("./file-manager");
const DB_NAME = 'chynotes.db';
// Default embedding dimension (mxbai-embed-large uses 1024)
exports.EMBEDDING_DIMENSION = 1024;
let db = null;
let vecExtensionLoaded = false;
/**
 * Get the database file path
 */
function getDatabasePath() {
    return path_1.default.join((0, file_manager_1.getChynotesDirectory)(), DB_NAME);
}
/**
 * Initialize the database connection and create tables if needed
 */
function initDatabase() {
    if (db)
        return db;
    const dbPath = getDatabasePath();
    db = new better_sqlite3_1.default(dbPath);
    // Enable WAL mode for better concurrent performance
    db.pragma('journal_mode = WAL');
    // Load sqlite-vec extension for vector search
    if (!vecExtensionLoaded) {
        sqliteVec.load(db);
        vecExtensionLoaded = true;
    }
    // Create tables
    createTables(db);
    // Create vector tables (separate because virtual tables need extension loaded first)
    createVectorTables(db);
    return db;
}
/**
 * Get the database instance (must call initDatabase first)
 */
function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}
/**
 * Close the database connection
 */
function closeDatabase() {
    if (db) {
        db.close();
        db = null;
    }
}
/**
 * Create all required tables
 */
function createTables(database) {
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
  `);
    // Migration: Add embedded_at column if it doesn't exist (for existing databases)
    const columns = database.pragma('table_info(blocks)');
    const hasEmbeddedAt = columns.some(col => col.name === 'embedded_at');
    if (!hasEmbeddedAt) {
        database.exec('ALTER TABLE blocks ADD COLUMN embedded_at INTEGER');
    }
}
/**
 * Create vector search tables (requires sqlite-vec extension to be loaded)
 */
function createVectorTables(database) {
    // Check if vec_blocks virtual table already exists
    const tableExists = database.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='vec_blocks'
  `).get();
    if (!tableExists) {
        // Create virtual table for vector search
        // Using cosine distance metric for semantic similarity
        database.exec(`
      CREATE VIRTUAL TABLE vec_blocks USING vec0(
        block_id TEXT PRIMARY KEY,
        embedding float[${exports.EMBEDDING_DIMENSION}] distance_metric=cosine
      )
    `);
    }
}
function upsertNote(date, fileHash) {
    const db = getDatabase();
    const now = Date.now();
    const stmt = db.prepare(`
    INSERT INTO notes (date, file_hash, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      file_hash = excluded.file_hash,
      updated_at = excluded.updated_at
    RETURNING *
  `);
    return stmt.get(date, fileHash, now);
}
function getNoteByDate(date) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM notes WHERE date = ?');
    return stmt.get(date);
}
function deleteNote(date) {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM notes WHERE date = ?');
    stmt.run(date);
}
function getOrCreateTag(name) {
    const db = getDatabase();
    const now = Date.now();
    // Use INSERT OR IGNORE to atomically handle concurrent creates.
    // This avoids the race where two threads both see the tag doesn't exist
    // and both try to insert, causing a UNIQUE constraint violation.
    db.prepare(`
    INSERT OR IGNORE INTO tags (name, created_at)
    VALUES (?, ?)
  `).run(name, now);
    // Tag is guaranteed to exist now - fetch it
    return db.prepare('SELECT * FROM tags WHERE name = ?').get(name);
}
function getTagByName(name) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM tags WHERE name = ?');
    return stmt.get(name);
}
function getAllTags() {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM tags ORDER BY name');
    return stmt.all();
}
function updateTagPrompt(tagId, prompt) {
    const db = getDatabase();
    const stmt = db.prepare('UPDATE tags SET prompt = ? WHERE id = ?');
    stmt.run(prompt, tagId);
}
function deleteTag(tagId) {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM tags WHERE id = ?');
    stmt.run(tagId);
}
function addTagOccurrence(tagId, noteId, line, content) {
    const db = getDatabase();
    const stmt = db.prepare(`
    INSERT OR REPLACE INTO tag_occurrences (tag_id, note_id, line, content)
    VALUES (?, ?, ?, ?)
  `);
    stmt.run(tagId, noteId, line, content);
}
function deleteOccurrencesForNote(noteId) {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM tag_occurrences WHERE note_id = ?');
    stmt.run(noteId);
}
function getOccurrencesForTag(tagName) {
    const db = getDatabase();
    const stmt = db.prepare(`
    SELECT t.name as tag_name, n.date, o.line, o.content
    FROM tag_occurrences o
    JOIN tags t ON o.tag_id = t.id
    JOIN notes n ON o.note_id = n.id
    WHERE t.name = ?
    ORDER BY n.date DESC, o.line ASC
  `);
    return stmt.all(tagName);
}
function getTagsWithCounts() {
    const db = getDatabase();
    const stmt = db.prepare(`
    SELECT t.id, t.name, t.prompt, COUNT(o.id) as count
    FROM tags t
    LEFT JOIN tag_occurrences o ON t.id = o.tag_id
    GROUP BY t.id
    HAVING COUNT(o.id) > 0
    ORDER BY t.name
  `);
    return stmt.all();
}
function getCachedCode(tagId, contentHash) {
    const db = getDatabase();
    const stmt = db.prepare(`
    SELECT generated_code FROM cache
    WHERE tag_id = ? AND content_hash = ?
  `);
    const result = stmt.get(tagId, contentHash);
    return result?.generated_code ?? null;
}
function setCachedCode(tagId, contentHash, code) {
    const db = getDatabase();
    const now = Date.now();
    // Delete old cache entries for this tag
    db.prepare('DELETE FROM cache WHERE tag_id = ?').run(tagId);
    // Insert new cache entry
    const stmt = db.prepare(`
    INSERT INTO cache (tag_id, content_hash, generated_code, created_at)
    VALUES (?, ?, ?, ?)
  `);
    stmt.run(tagId, contentHash, code, now);
}
function getCachedCodeByTagName(tagName) {
    const db = getDatabase();
    const stmt = db.prepare(`
    SELECT c.generated_code FROM cache c
    JOIN tags t ON c.tag_id = t.id
    WHERE t.name = ?
    ORDER BY c.created_at DESC
    LIMIT 1
  `);
    const result = stmt.get(tagName);
    return result?.generated_code ?? null;
}
// ============================================================================
// Settings Table Operations
// ============================================================================
function getSetting(key) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    const result = stmt.get(key);
    return result?.value ?? null;
}
function setSetting(key, value) {
    const db = getDatabase();
    const stmt = db.prepare(`
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
    stmt.run(key, value);
}
function deleteSetting(key) {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM settings WHERE key = ?');
    stmt.run(key);
}
// ============================================================================
// Snapshots Table Operations
// ============================================================================
/**
 * Simple hash function for content comparison
 */
function hashContent(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
}
/**
 * Save a snapshot if content has changed since last snapshot
 * Returns the new snapshot record, or null if skipped (no change)
 */
function saveSnapshot(noteDate, content, documentType = 'note') {
    const db = getDatabase();
    const contentHash = hashContent(content);
    const now = Date.now();
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
  `);
    const result = stmt.get(noteDate, content, now, contentHash, documentType, noteDate, documentType, contentHash);
    return result ?? null;
}
/**
 * Get all snapshots for a document, ordered by creation time (newest first)
 */
function getSnapshotsForNote(noteDate, documentType = 'note') {
    const db = getDatabase();
    const stmt = db.prepare(`
    SELECT * FROM snapshots
    WHERE note_date = ? AND document_type = ?
    ORDER BY created_at DESC
  `);
    return stmt.all(noteDate, documentType);
}
/**
 * Get a specific snapshot by ID
 */
function getSnapshot(id) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM snapshots WHERE id = ?');
    return stmt.get(id) || null;
}
/**
 * Delete old snapshots, keeping only the most recent N
 */
function pruneSnapshots(noteDate, keepCount, documentType = 'note') {
    const db = getDatabase();
    db.prepare(`
    DELETE FROM snapshots
    WHERE note_date = ? AND document_type = ?
    AND id NOT IN (
      SELECT id FROM snapshots
      WHERE note_date = ? AND document_type = ?
      ORDER BY created_at DESC
      LIMIT ?
    )
  `).run(noteDate, documentType, noteDate, documentType, keepCount);
}
/**
 * Get total count of all snapshots in the database
 */
function getSnapshotCount() {
    const db = getDatabase();
    const result = db.prepare('SELECT COUNT(*) as count FROM snapshots').get();
    return result.count;
}
/**
 * Delete snapshots older than the specified number of days
 * Returns the number of deleted snapshots
 */
function pruneSnapshotsByAge(retentionDays) {
    const db = getDatabase();
    const cutoffTimestamp = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    const result = db.prepare(`
    DELETE FROM snapshots
    WHERE created_at < ?
  `).run(cutoffTimestamp);
    return result.changes;
}
/**
 * Automatically cleanup snapshots based on user settings
 * Called on app startup. Returns number of deleted snapshots.
 */
function autoCleanupSnapshots() {
    const autoCleanup = getSetting('snapshotAutoCleanup');
    // Only cleanup if explicitly enabled
    if (autoCleanup !== 'true') {
        return 0;
    }
    const retentionDays = getSetting('snapshotRetentionDays');
    const days = retentionDays ? parseInt(retentionDays) : 0;
    // 0 means unlimited retention
    if (days <= 0) {
        return 0;
    }
    return pruneSnapshotsByAge(days);
}
/**
 * Create or update a page record
 */
function upsertPage(name, fileHash = null) {
    const db = getDatabase();
    const now = Date.now();
    const stmt = db.prepare(`
    INSERT INTO pages (name, file_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      file_hash = excluded.file_hash,
      updated_at = excluded.updated_at
    RETURNING *
  `);
    return stmt.get(name, fileHash, now, now);
}
/**
 * Get a page by name
 */
function getPageByName(name) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM pages WHERE name = ?');
    return stmt.get(name);
}
/**
 * Get all pages
 */
function getAllPages() {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM pages ORDER BY name');
    return stmt.all();
}
/**
 * Delete a page
 */
function deletePage(name) {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM pages WHERE name = ?');
    stmt.run(name);
}
/**
 * Check if a page exists
 */
function pageExists(name) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT 1 FROM pages WHERE name = ?');
    return stmt.get(name) !== undefined;
}
// ============================================================================
// Blocks Table Operations
// ============================================================================
/**
 * Upsert a block (insert or update)
 */
function upsertBlock(id, noteDate, content, parentId, indentLevel, lineNumber) {
    const db = getDatabase();
    const now = Date.now();
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
  `).run(id, noteDate, content, parentId, indentLevel, lineNumber, now);
}
/**
 * Get a block by ID
 */
function getBlockById(id) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM blocks WHERE id = ?');
    return stmt.get(id) || null;
}
/**
 * Get a block with all its children (based on indent level)
 */
function getBlockWithChildren(id) {
    const db = getDatabase();
    const parent = getBlockById(id);
    if (!parent)
        return [];
    // Get all blocks from the same note, ordered by line number
    const allBlocks = getBlocksForNote(parent.note_date);
    // Find the parent block and collect children
    const result = [parent];
    const parentIndex = allBlocks.findIndex(b => b.id === id);
    if (parentIndex === -1)
        return result;
    const parentIndent = parent.indent_level;
    // Collect all following blocks with higher indent (children)
    for (let i = parentIndex + 1; i < allBlocks.length; i++) {
        const block = allBlocks[i];
        if (block.indent_level <= parentIndent)
            break; // Same or less indent = sibling/parent
        result.push(block);
    }
    return result;
}
/**
 * Get all blocks for a note date
 */
function getBlocksForNote(noteDate) {
    const db = getDatabase();
    const stmt = db.prepare(`
    SELECT * FROM blocks
    WHERE note_date = ?
    ORDER BY line_number ASC
  `);
    return stmt.all(noteDate);
}
/**
 * Delete all blocks for a note
 */
function deleteBlocksForNote(noteDate) {
    const db = getDatabase();
    db.prepare('DELETE FROM blocks WHERE note_date = ?').run(noteDate);
}
/**
 * Add a tag to a block
 */
function addBlockTag(blockId, tagName) {
    const db = getDatabase();
    db.prepare(`
    INSERT OR IGNORE INTO block_tags (block_id, tag_name)
    VALUES (?, ?)
  `).run(blockId, tagName.toLowerCase());
}
/**
 * Get all blocks containing a specific tag
 */
function getBlocksWithTag(tagName) {
    const db = getDatabase();
    const stmt = db.prepare(`
    SELECT b.* FROM blocks b
    JOIN block_tags bt ON b.id = bt.block_id
    WHERE bt.tag_name = ?
    ORDER BY b.note_date DESC, b.line_number ASC
  `);
    return stmt.all(tagName.toLowerCase());
}
/**
 * Get all children of a block (recursive)
 */
function getChildBlocks(db, parentId, noteDate) {
    const stmt = db.prepare(`
    SELECT * FROM blocks
    WHERE parent_id = ? AND note_date = ?
    ORDER BY line_number ASC
  `);
    const children = stmt.all(parentId, noteDate);
    return children.map(child => ({
        ...child,
        children: getChildBlocks(db, child.id, noteDate)
    }));
}
/**
 * Get all blocks containing a specific tag, with their children
 */
function getBlocksWithTagAndChildren(tagName) {
    const db = getDatabase();
    const blocks = getBlocksWithTag(tagName);
    return blocks.map(block => ({
        ...block,
        children: getChildBlocks(db, block.id, block.note_date)
    }));
}
/**
 * Delete all tags for a block
 */
function deleteBlockTags(blockId) {
    const db = getDatabase();
    db.prepare('DELETE FROM block_tags WHERE block_id = ?').run(blockId);
}
/**
 * Get all tags for a specific block
 */
function getBlockTags(blockId) {
    const db = getDatabase();
    const rows = db.prepare('SELECT tag_name FROM block_tags WHERE block_id = ?').all(blockId);
    return rows.map(r => r.tag_name);
}
/**
 * Insert or update a block's embedding
 */
function upsertBlockEmbedding(blockId, embedding) {
    const db = getDatabase();
    // Delete existing embedding for this block (if any)
    db.prepare('DELETE FROM vec_blocks WHERE block_id = ?').run(blockId);
    // Insert new embedding
    db.prepare(`
    INSERT INTO vec_blocks(block_id, embedding)
    VALUES (?, ?)
  `).run(blockId, embedding);
    // Mark block as embedded
    db.prepare('UPDATE blocks SET embedded_at = ? WHERE id = ?')
        .run(Date.now(), blockId);
}
/**
 * Get embedding for a specific block
 */
function getBlockEmbedding(blockId) {
    const db = getDatabase();
    const result = db.prepare(`
    SELECT embedding FROM vec_blocks WHERE block_id = ?
  `).get(blockId);
    if (!result)
        return null;
    // Convert Buffer to Float32Array
    return new Float32Array(result.embedding.buffer, result.embedding.byteOffset, result.embedding.byteLength / 4);
}
/**
 * Get embeddings for multiple blocks
 */
function getBlockEmbeddings(blockIds) {
    const db = getDatabase();
    const result = new Map();
    if (blockIds.length === 0)
        return result;
    const placeholders = blockIds.map(() => '?').join(',');
    const rows = db.prepare(`
    SELECT block_id, embedding FROM vec_blocks
    WHERE block_id IN (${placeholders})
  `).all(...blockIds);
    for (const row of rows) {
        const arr = new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4);
        result.set(row.block_id, arr);
    }
    return result;
}
/**
 * Find blocks similar to a query embedding using KNN
 */
function findSimilarBlocksKNN(queryEmbedding, limit = 20) {
    const db = getDatabase();
    return db.prepare(`
    SELECT block_id, distance
    FROM vec_blocks
    WHERE embedding MATCH ?
      AND k = ?
  `).all(queryEmbedding, limit);
}
/**
 * Delete embedding for a block
 */
function deleteBlockEmbedding(blockId) {
    const db = getDatabase();
    db.prepare('DELETE FROM vec_blocks WHERE block_id = ?').run(blockId);
    db.prepare('UPDATE blocks SET embedded_at = NULL WHERE id = ?').run(blockId);
}
/**
 * Get count of blocks that have embeddings
 */
function getEmbeddedBlockCount() {
    const db = getDatabase();
    const result = db.prepare('SELECT COUNT(*) as count FROM vec_blocks').get();
    return result.count;
}
/**
 * Get count of all blocks
 */
function getTotalBlockCount() {
    const db = getDatabase();
    const result = db.prepare('SELECT COUNT(*) as count FROM blocks').get();
    return result.count;
}
/**
 * Get blocks that need embedding (no embedded_at or content changed)
 */
function getBlocksNeedingEmbedding(limit = 100) {
    const db = getDatabase();
    return db.prepare(`
    SELECT * FROM blocks
    WHERE embedded_at IS NULL
       OR embedded_at < updated_at
    ORDER BY updated_at DESC
    LIMIT ?
  `).all(limit);
}
/**
 * Get term frequency by normalized term
 */
function getTermFrequency(term) {
    const db = getDatabase();
    const record = db.prepare('SELECT * FROM term_frequency WHERE term = ?')
        .get(term);
    if (!record)
        return null;
    return {
        term: record.term,
        originalForms: JSON.parse(record.original_forms),
        noteCount: record.note_count,
        totalCount: record.total_count,
        notes: JSON.parse(record.notes)
    };
}
/**
 * Get all terms with noteCount >= minNoteCount
 */
function getFrequentTerms(minNoteCount = 2) {
    const db = getDatabase();
    const records = db.prepare(`
    SELECT * FROM term_frequency
    WHERE note_count >= ?
    ORDER BY note_count DESC, total_count DESC
  `).all(minNoteCount);
    return records.map(record => ({
        term: record.term,
        originalForms: JSON.parse(record.original_forms),
        noteCount: record.note_count,
        totalCount: record.total_count,
        notes: JSON.parse(record.notes)
    }));
}
/**
 * Upsert term frequency data
 */
function upsertTermFrequency(term, originalForms, noteCount, totalCount, notes) {
    const db = getDatabase();
    const now = Date.now();
    db.prepare(`
    INSERT INTO term_frequency (term, original_forms, note_count, total_count, notes, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(term) DO UPDATE SET
      original_forms = excluded.original_forms,
      note_count = excluded.note_count,
      total_count = excluded.total_count,
      notes = excluded.notes,
      updated_at = excluded.updated_at
  `).run(term, JSON.stringify(originalForms), noteCount, totalCount, JSON.stringify(notes), now);
}
/**
 * Delete a term from frequency index
 */
function deleteTermFrequency(term) {
    const db = getDatabase();
    db.prepare('DELETE FROM term_frequency WHERE term = ?').run(term);
}
/**
 * Clear all term frequency data (for full rebuild)
 */
function clearTermFrequency() {
    const db = getDatabase();
    db.prepare('DELETE FROM term_frequency').run();
}
/**
 * Get all tag co-occurrences (tags appearing in the same block)
 * Returns pairs of tags with their co-occurrence count
 */
function getTagCooccurrences() {
    const db = getDatabase();
    return db.prepare(`
    SELECT bt1.tag_name as tag1, bt2.tag_name as tag2, COUNT(*) as weight
    FROM block_tags bt1
    JOIN block_tags bt2 ON bt1.block_id = bt2.block_id
    WHERE bt1.tag_name < bt2.tag_name
    GROUP BY bt1.tag_name, bt2.tag_name
    ORDER BY weight DESC
  `).all();
}
