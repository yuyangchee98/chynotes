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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChynotesDirectory = getChynotesDirectory;
exports.getNotesDirectory = getNotesDirectory;
exports.ensureNotesDirectory = ensureNotesDirectory;
exports.ensureNotesDirectorySync = ensureNotesDirectorySync;
exports.formatDateForFileName = formatDateForFileName;
exports.getDateFileName = getDateFileName;
exports.getNotePath = getNotePath;
exports.getTodayFileName = getTodayFileName;
exports.parseDateFromFileName = parseDateFromFileName;
exports.readNote = readNote;
exports.writeNote = writeNote;
exports.noteExists = noteExists;
exports.listAllNotes = listAllNotes;
exports.deleteNote = deleteNote;
exports.updateNoteLine = updateNoteLine;
exports.getPagesDirectory = getPagesDirectory;
exports.ensurePagesDirectory = ensurePagesDirectory;
exports.ensurePagesDirectorySync = ensurePagesDirectorySync;
exports.getPagePath = getPagePath;
exports.readPage = readPage;
exports.writePage = writePage;
exports.pageFileExists = pageFileExists;
exports.createPageIfNotExists = createPageIfNotExists;
exports.listAllPages = listAllPages;
exports.deletePageFile = deletePageFile;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const fs_1 = require("fs");
const os_1 = require("os");
const block_parser_1 = require("./block-parser");
const tag_parser_1 = require("./tag-parser");
const database_1 = require("./database");
const NOTES_DIR_NAME = '.chynotes';
const NOTES_SUBDIR = 'notes';
const PAGES_SUBDIR = 'pages';
/**
 * Get the base chynotes directory path
 */
function getChynotesDirectory() {
    return path.join((0, os_1.homedir)(), NOTES_DIR_NAME);
}
/**
 * Get the notes directory path where daily notes are stored
 */
function getNotesDirectory() {
    return path.join(getChynotesDirectory(), NOTES_SUBDIR);
}
/**
 * Ensure the notes directory exists, creating it if necessary
 */
async function ensureNotesDirectory() {
    const notesDir = getNotesDirectory();
    if (!(0, fs_1.existsSync)(notesDir)) {
        await fs.mkdir(notesDir, { recursive: true });
    }
}
/**
 * Ensure the notes directory exists (sync version for initialization)
 */
function ensureNotesDirectorySync() {
    const notesDir = getNotesDirectory();
    if (!(0, fs_1.existsSync)(notesDir)) {
        (0, fs_1.mkdirSync)(notesDir, { recursive: true });
    }
}
/**
 * Format a date as YYYY-MM-DD for file naming
 */
function formatDateForFileName(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
/**
 * Get the file name for a specific date (e.g., "2025-01-16.md")
 */
function getDateFileName(date) {
    return `${formatDateForFileName(date)}.md`;
}
/**
 * Get the full file path for a specific date's note
 */
function getNotePath(date) {
    return path.join(getNotesDirectory(), getDateFileName(date));
}
/**
 * Get today's note file name
 */
function getTodayFileName() {
    return getDateFileName(new Date());
}
/**
 * Parse a date string from a file name (e.g., "2025-01-16.md" -> Date)
 */
function parseDateFromFileName(fileName) {
    const match = fileName.match(/^(\d{4})-(\d{2})-(\d{2})\.md$/);
    if (!match)
        return null;
    const [, year, month, day] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}
/**
 * Read a note for a specific date
 * @returns The note content, or null if the file doesn't exist
 */
async function readNote(date) {
    const filePath = getNotePath(date);
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return content;
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            return null;
        }
        throw error;
    }
}
/**
 * Write (or overwrite) a note for a specific date
 * If content is empty, deletes the file instead
 * Automatically adds block IDs to any blocks without them
 */
async function writeNote(date, content) {
    const noteDate = formatDateForFileName(date);
    if (content === '') {
        await deleteNote(date);
        // Also clean up blocks in database
        (0, database_1.deleteBlocksForNote)(noteDate);
        return;
    }
    // Inject block IDs into any blocks that don't have them
    const contentWithIds = (0, block_parser_1.serializeBlocks)(content);
    await ensureNotesDirectory();
    const filePath = getNotePath(date);
    await fs.writeFile(filePath, contentWithIds, 'utf-8');
    // Index blocks in database
    indexBlocks(noteDate, contentWithIds);
}
/**
 * Index all blocks from content into the database
 */
function indexBlocks(noteDate, content) {
    // Clear existing blocks for this note
    (0, database_1.deleteBlocksForNote)(noteDate);
    // Parse blocks
    const { allBlocks } = (0, block_parser_1.parseBlocks)(content);
    // Insert each block
    for (const block of allBlocks) {
        (0, database_1.upsertBlock)(block.id, noteDate, block.content, block.parent?.id || null, block.indentLevel, block.line);
        // Parse tags from block content and index them
        const { tags } = (0, tag_parser_1.parseNote)(block.content);
        for (const tag of tags) {
            (0, database_1.addBlockTag)(block.id, tag);
        }
    }
}
/**
 * Check if a note exists for a specific date
 */
async function noteExists(date) {
    const filePath = getNotePath(date);
    try {
        await fs.access(filePath);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * List all note dates in the notes directory
 * @returns Array of Dates for which notes exist, sorted newest first
 */
async function listAllNotes() {
    const notesDir = getNotesDirectory();
    try {
        const files = await fs.readdir(notesDir);
        const dates = [];
        for (const file of files) {
            const date = parseDateFromFileName(file);
            if (date) {
                dates.push(date);
            }
        }
        // Sort by date, newest first
        dates.sort((a, b) => b.getTime() - a.getTime());
        return dates;
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }
        throw error;
    }
}
/**
 * Delete a note for a specific date
 */
async function deleteNote(date) {
    const filePath = getNotePath(date);
    try {
        await fs.unlink(filePath);
    }
    catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }
    }
}
/**
 * Update a specific line in a note
 * @param date The date of the note
 * @param lineNumber 1-based line number
 * @param newContent The new content for that line
 */
async function updateNoteLine(date, lineNumber, newContent) {
    const content = await readNote(date);
    if (content === null) {
        throw new Error(`Note for ${formatDateForFileName(date)} does not exist`);
    }
    const lines = content.split('\n');
    if (lineNumber < 1 || lineNumber > lines.length) {
        throw new Error(`Line ${lineNumber} is out of range (1-${lines.length})`);
    }
    lines[lineNumber - 1] = newContent;
    await writeNote(date, lines.join('\n'));
}
// ============================================================================
// Pages (Tag Pages) File Operations
// ============================================================================
/**
 * Get the pages directory path where tag pages are stored
 */
function getPagesDirectory() {
    return path.join(getChynotesDirectory(), PAGES_SUBDIR);
}
/**
 * Ensure the pages directory exists
 */
async function ensurePagesDirectory() {
    const pagesDir = getPagesDirectory();
    if (!(0, fs_1.existsSync)(pagesDir)) {
        await fs.mkdir(pagesDir, { recursive: true });
    }
}
/**
 * Ensure the pages directory exists (sync version)
 */
function ensurePagesDirectorySync() {
    const pagesDir = getPagesDirectory();
    if (!(0, fs_1.existsSync)(pagesDir)) {
        (0, fs_1.mkdirSync)(pagesDir, { recursive: true });
    }
}
/**
 * Get the file path for a page
 * Handles hierarchical pages like "project/website" -> "pages/project/website.md"
 */
function getPagePath(name) {
    // Normalize the name (lowercase, no leading/trailing slashes)
    const normalizedName = name.toLowerCase().replace(/^\/+|\/+$/g, '');
    return path.join(getPagesDirectory(), `${normalizedName}.md`);
}
/**
 * Read a page's content
 * @returns The page content, or null if the file doesn't exist
 */
async function readPage(name) {
    const filePath = getPagePath(name);
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return content;
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            return null;
        }
        throw error;
    }
}
/**
 * Write (or overwrite) a page
 * Creates parent directories if needed for hierarchical pages
 */
async function writePage(name, content) {
    await ensurePagesDirectory();
    const filePath = getPagePath(name);
    // Ensure parent directory exists for hierarchical pages
    const dir = path.dirname(filePath);
    if (!(0, fs_1.existsSync)(dir)) {
        await fs.mkdir(dir, { recursive: true });
    }
    await fs.writeFile(filePath, content, 'utf-8');
}
/**
 * Check if a page file exists
 */
async function pageFileExists(name) {
    const filePath = getPagePath(name);
    try {
        await fs.access(filePath);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Create an empty page if it doesn't exist
 * Returns true if created, false if already exists
 */
async function createPageIfNotExists(name) {
    const exists = await pageFileExists(name);
    if (exists) {
        return false;
    }
    // Create empty page with just a header
    const initialContent = `# ${name}\n\n`;
    await writePage(name, initialContent);
    return true;
}
/**
 * List all pages in the pages directory
 * @returns Array of page names (without .md extension)
 */
async function listAllPages() {
    const pagesDir = getPagesDirectory();
    try {
        const pages = [];
        async function scanDir(dir, prefix = '') {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    // Recursively scan subdirectories for hierarchical pages
                    await scanDir(fullPath, prefix ? `${prefix}/${entry.name}` : entry.name);
                }
                else if (entry.isFile() && entry.name.endsWith('.md')) {
                    // Extract page name without .md extension
                    const pageName = entry.name.slice(0, -3);
                    pages.push(prefix ? `${prefix}/${pageName}` : pageName);
                }
            }
        }
        await scanDir(pagesDir);
        pages.sort();
        return pages;
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }
        throw error;
    }
}
/**
 * Delete a page file
 */
async function deletePageFile(name) {
    const filePath = getPagePath(name);
    try {
        await fs.unlink(filePath);
    }
    catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }
    }
}
