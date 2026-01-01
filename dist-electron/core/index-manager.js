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
exports.indexNote = indexNote;
exports.reindexAll = reindexAll;
exports.incrementalIndex = incrementalIndex;
exports.getAllTagsWithCounts = getAllTagsWithCounts;
exports.getTagOccurrences = getTagOccurrences;
exports.searchTags = searchTags;
exports.buildTagTree = buildTagTree;
const crypto = __importStar(require("crypto"));
const file_manager_1 = require("./file-manager");
const database_1 = require("./database");
const tag_parser_1 = require("./tag-parser");
const prompt_manager_1 = require("./prompt-manager");
/**
 * Compute a hash of content for change detection
 */
function computeHash(content) {
    return crypto.createHash('md5').update(content).digest('hex');
}
/**
 * Index a single note file
 * Returns true if the note was updated, false if unchanged
 */
async function indexNote(date) {
    const dateStr = (0, file_manager_1.formatDateForFileName)(date);
    const content = await (0, file_manager_1.readNote)(date);
    if (content === null) {
        // Note was deleted, remove from index
        const existingNote = (0, database_1.getNoteByDate)(dateStr);
        if (existingNote) {
            (0, database_1.deleteOccurrencesForNote)(existingNote.id);
            (0, database_1.deleteNote)(dateStr);
        }
        return true;
    }
    const hash = computeHash(content);
    const existingNote = (0, database_1.getNoteByDate)(dateStr);
    // Skip if content hasn't changed
    if (existingNote && existingNote.file_hash === hash) {
        return false;
    }
    // Upsert note record
    const noteRecord = (0, database_1.upsertNote)(dateStr, hash);
    // Clear old occurrences for this note
    (0, database_1.deleteOccurrencesForNote)(noteRecord.id);
    // Parse and index tags
    const { occurrences } = (0, tag_parser_1.parseNote)(content);
    for (const occurrence of occurrences) {
        const tagRecord = (0, database_1.getOrCreateTag)(occurrence.tag);
        (0, database_1.addTagOccurrence)(tagRecord.id, noteRecord.id, occurrence.line, occurrence.context);
    }
    return true;
}
/**
 * Full reindex of all notes
 * Returns the number of notes indexed
 */
async function reindexAll() {
    (0, database_1.initDatabase)();
    const dates = await (0, file_manager_1.listAllNotes)();
    let count = 0;
    for (const date of dates) {
        await indexNote(date);
        count++;
    }
    return count;
}
/**
 * Incremental index - only update changed files
 * Returns the number of notes that were updated
 */
async function incrementalIndex() {
    (0, database_1.initDatabase)();
    const dates = await (0, file_manager_1.listAllNotes)();
    let updatedCount = 0;
    for (const date of dates) {
        const wasUpdated = await indexNote(date);
        if (wasUpdated) {
            updatedCount++;
        }
    }
    return updatedCount;
}
/**
 * Get all tags with their occurrence counts
 */
function getAllTagsWithCounts() {
    (0, database_1.initDatabase)();
    return (0, database_1.getTagsWithCounts)();
}
/**
 * Get all occurrences of a specific tag
 */
function getTagOccurrences(tagName) {
    (0, database_1.initDatabase)();
    return (0, database_1.getOccurrencesForTag)(tagName.toLowerCase());
}
/**
 * Search tags by prefix (for autocomplete)
 */
function searchTags(query) {
    const allTags = getAllTagsWithCounts();
    const lowerQuery = query.toLowerCase();
    return allTags.filter(tag => tag.name.toLowerCase().includes(lowerQuery));
}
function buildTagTree() {
    const tags = getAllTagsWithCounts();
    const rootNodes = [];
    const nodeMap = new Map();
    // Get predefined tags and add them with 0 count if not already present
    const defaultPrompts = (0, prompt_manager_1.listDefaultPrompts)();
    const existingTagNames = new Set(tags.map(t => t.name));
    for (const tagName of Object.keys(defaultPrompts)) {
        if (!existingTagNames.has(tagName)) {
            tags.push({
                id: -1, // placeholder
                name: tagName,
                prompt: defaultPrompts[tagName],
                count: 0,
            });
        }
    }
    // Sort tags so parents come before children
    tags.sort((a, b) => a.name.localeCompare(b.name));
    for (const tag of tags) {
        const parts = tag.name.split('/');
        const displayName = parts[parts.length - 1];
        const node = {
            name: tag.name,
            displayName,
            count: tag.count,
            prompt: tag.prompt,
            children: [],
        };
        nodeMap.set(tag.name, node);
        if (parts.length === 1) {
            // Top-level tag
            rootNodes.push(node);
        }
        else {
            // Child tag - find parent
            const parentName = parts.slice(0, -1).join('/');
            const parent = nodeMap.get(parentName);
            if (parent) {
                parent.children.push(node);
            }
            else {
                // Parent doesn't exist as a tag, add as root
                rootNodes.push(node);
            }
        }
    }
    return rootNodes;
}
