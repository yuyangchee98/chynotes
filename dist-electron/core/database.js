"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
exports.upsertBlock = upsertBlock;
exports.getBlockById = getBlockById;
exports.getBlocksForNote = getBlocksForNote;
exports.deleteBlocksForNote = deleteBlocksForNote;
exports.addBlockTag = addBlockTag;
exports.getBlocksWithTag = getBlocksWithTag;
exports.getBlocksWithTagAndChildren = getBlocksWithTagAndChildren;
exports.deleteBlockTags = deleteBlockTags;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const file_manager_1 = require("./file-manager");
const DB_NAME = 'chynotes.db';
let db = null;
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
    // Create tables
    createTables(db);
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

    -- Document snapshots for viewing evolution of thought
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY,
      note_date TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      content_hash TEXT NOT NULL
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

    -- Create indexes for faster queries
    CREATE INDEX IF NOT EXISTS idx_notes_date ON notes(date);
    CREATE INDEX IF NOT EXISTS idx_tag_name ON tags(name);
    CREATE INDEX IF NOT EXISTS idx_occurrence_tag ON tag_occurrences(tag_id);
    CREATE INDEX IF NOT EXISTS idx_occurrence_note ON tag_occurrences(note_id);
    CREATE INDEX IF NOT EXISTS idx_cache_tag ON cache(tag_id);
    CREATE INDEX IF NOT EXISTS idx_snapshots_note_date ON snapshots(note_date);
    CREATE INDEX IF NOT EXISTS idx_snapshots_created_at ON snapshots(note_date, created_at);
    CREATE INDEX IF NOT EXISTS idx_blocks_note_date ON blocks(note_date);
    CREATE INDEX IF NOT EXISTS idx_blocks_parent ON blocks(parent_id);
    CREATE INDEX IF NOT EXISTS idx_block_tags_block ON block_tags(block_id);
    CREATE INDEX IF NOT EXISTS idx_block_tags_tag ON block_tags(tag_name);
  `);
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
    // Try to get existing tag
    let tag = db.prepare('SELECT * FROM tags WHERE name = ?').get(name);
    if (!tag) {
        // Create new tag
        const stmt = db.prepare(`
      INSERT INTO tags (name, created_at)
      VALUES (?, ?)
      RETURNING *
    `);
        tag = stmt.get(name, now);
    }
    return tag;
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
function saveSnapshot(noteDate, content) {
    const db = getDatabase();
    const contentHash = hashContent(content);
    const now = Date.now();
    // Check if last snapshot has same content
    const lastSnapshot = db.prepare(`
    SELECT content_hash FROM snapshots
    WHERE note_date = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(noteDate);
    if (lastSnapshot?.content_hash === contentHash) {
        // Content unchanged, skip
        return null;
    }
    // Insert new snapshot
    const stmt = db.prepare(`
    INSERT INTO snapshots (note_date, content, created_at, content_hash)
    VALUES (?, ?, ?, ?)
    RETURNING *
  `);
    return stmt.get(noteDate, content, now, contentHash);
}
/**
 * Get all snapshots for a note, ordered by creation time (newest first)
 */
function getSnapshotsForNote(noteDate) {
    const db = getDatabase();
    const stmt = db.prepare(`
    SELECT * FROM snapshots
    WHERE note_date = ?
    ORDER BY created_at DESC
  `);
    return stmt.all(noteDate);
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
function pruneSnapshots(noteDate, keepCount) {
    const db = getDatabase();
    db.prepare(`
    DELETE FROM snapshots
    WHERE note_date = ?
    AND id NOT IN (
      SELECT id FROM snapshots
      WHERE note_date = ?
      ORDER BY created_at DESC
      LIMIT ?
    )
  `).run(noteDate, noteDate, keepCount);
}
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
    console.log(`[getChildBlocks] Looking for children of ${parentId} on ${noteDate}, found:`, children.length);
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
