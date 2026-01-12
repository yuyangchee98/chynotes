"use strict";
/**
 * Block Parser
 *
 * Parses markdown bullet content into a tree of blocks with stable IDs.
 * Each block has a unique §id§ suffix that persists across edits.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBlockId = generateBlockId;
exports.extractBlockId = extractBlockId;
exports.addBlockId = addBlockId;
exports.parseBlocks = parseBlocks;
exports.serializeBlocks = serializeBlocks;
exports.hasBlocksWithoutIds = hasBlocksWithoutIds;
exports.getBlockById = getBlockById;
const crypto_1 = require("crypto");
// Block ID pattern: §alphanumeric with - and _§ (base64url characters)
const BLOCK_ID_PATTERN = /§([a-z0-9_-]+)§\s*$/;
// Bullet line pattern: optional indent + "- " + content
const BULLET_PATTERN = /^(\s*)-\s+(.*)$/;
/**
 * Generate a new block ID (8 chars, hex - only 0-9 and a-f)
 * Uses Node's built-in crypto module - no external dependencies
 */
function generateBlockId() {
    return (0, crypto_1.randomBytes)(4).toString('hex');
}
/**
 * Extract block ID from line content, if present
 */
function extractBlockId(content) {
    const match = content.match(BLOCK_ID_PATTERN);
    if (match) {
        return {
            id: match[1],
            contentWithoutId: content.replace(BLOCK_ID_PATTERN, '').trimEnd()
        };
    }
    return { id: null, contentWithoutId: content };
}
/**
 * Add block ID to content
 */
function addBlockId(content, id) {
    // Remove any existing ID first
    const { contentWithoutId } = extractBlockId(content);
    return `${contentWithoutId} §${id}§`;
}
/**
 * Parse markdown content into block tree
 */
function parseBlocks(content) {
    const lines = content.split('\n');
    const blocks = [];
    const allBlocks = [];
    const blockMap = new Map();
    // Stack to track parent blocks at each indent level
    const stack = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNumber = i + 1;
        const bulletMatch = line.match(BULLET_PATTERN);
        if (!bulletMatch) {
            // Non-bullet line - skip for now
            // TODO: Handle continuation lines (content under a bullet)
            continue;
        }
        const [, indent, bulletContent] = bulletMatch;
        const indentLevel = Math.floor(indent.length / 2); // 2 spaces per level
        // Extract or generate ID
        const { id: existingId, contentWithoutId } = extractBlockId(bulletContent);
        const id = existingId || generateBlockId();
        const block = {
            id,
            content: contentWithoutId,
            rawContent: line,
            indentLevel,
            children: [],
            line: lineNumber,
            parent: null
        };
        // Find parent based on indent level
        while (stack.length > 0 && stack[stack.length - 1].indentLevel >= indentLevel) {
            stack.pop();
        }
        if (stack.length > 0) {
            const parent = stack[stack.length - 1];
            block.parent = parent;
            parent.children.push(block);
        }
        else {
            blocks.push(block);
        }
        stack.push(block);
        allBlocks.push(block);
        blockMap.set(id, block);
    }
    return { blocks, allBlocks, blockMap };
}
/**
 * Serialize blocks back to markdown with IDs
 */
function serializeBlocks(content) {
    const lines = content.split('\n');
    const result = [];
    for (const line of lines) {
        const bulletMatch = line.match(BULLET_PATTERN);
        if (bulletMatch) {
            const [, indent, bulletContent] = bulletMatch;
            const { id: existingId, contentWithoutId } = extractBlockId(bulletContent);
            // Generate ID if missing
            const id = existingId || generateBlockId();
            // Reconstruct line with ID
            result.push(`${indent}- ${contentWithoutId} §${id}§`);
        }
        else {
            // Keep non-bullet lines as-is
            result.push(line);
        }
    }
    return result.join('\n');
}
/**
 * Check if content has any blocks without IDs
 */
function hasBlocksWithoutIds(content) {
    const lines = content.split('\n');
    for (const line of lines) {
        const bulletMatch = line.match(BULLET_PATTERN);
        if (bulletMatch) {
            const [, , bulletContent] = bulletMatch;
            const { id } = extractBlockId(bulletContent);
            if (!id)
                return true;
        }
    }
    return false;
}
/**
 * Get block by ID from content
 */
function getBlockById(content, blockId) {
    const { blockMap } = parseBlocks(content);
    return blockMap.get(blockId) || null;
}
