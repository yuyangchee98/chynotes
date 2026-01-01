"use strict";
/**
 * Tag Parser
 *
 * Supports dual syntax for tags:
 * - Hashtags: #todo, #project/website, #person/sarah
 * - Wiki-links: [[todo]], [[project/website]], [[person/sarah]]
 *
 * Both syntaxes are normalized to the same canonical form (without prefix).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLineForTags = parseLineForTags;
exports.parseNote = parseNote;
exports.extractTags = extractTags;
exports.isValidTagName = isValidTagName;
exports.normalizeTagName = normalizeTagName;
exports.getParentTag = getParentTag;
exports.getAncestorTags = getAncestorTags;
exports.isChildOf = isChildOf;
exports.getTagDisplayName = getTagDisplayName;
// Regex patterns for both syntaxes
// Hashtag: #word or #word/subword (supports letters, numbers, underscores, hyphens, slashes)
const HASHTAG_PATTERN = /#([\w\-]+(?:\/[\w\-]+)*)/g;
// Wiki-link: [[word]] or [[word/subword]]
const WIKILINK_PATTERN = /\[\[([\w\-]+(?:\/[\w\-]+)*)\]\]/g;
// Checkbox patterns for implicit todo/done
const UNCHECKED_CHECKBOX = /^\s*-\s*\[ \]/;
const CHECKED_CHECKBOX = /^\s*-\s*\[[xX]\]/;
/**
 * Parse a single line of text for tags
 */
function parseLineForTags(line, lineNumber) {
    const occurrences = [];
    // Check for markdown checkboxes (implicit todo/done)
    if (UNCHECKED_CHECKBOX.test(line)) {
        occurrences.push({
            tag: 'todo',
            line: lineNumber,
            column: 0,
            raw: '- [ ]',
            context: line,
        });
    }
    else if (CHECKED_CHECKBOX.test(line)) {
        occurrences.push({
            tag: 'done',
            line: lineNumber,
            column: 0,
            raw: '- [x]',
            context: line,
        });
    }
    // Find hashtags
    let match;
    const hashtagRegex = new RegExp(HASHTAG_PATTERN.source, 'g');
    while ((match = hashtagRegex.exec(line)) !== null) {
        occurrences.push({
            tag: match[1].toLowerCase(),
            line: lineNumber,
            column: match.index,
            raw: match[0],
            context: line,
        });
    }
    // Find wiki-links
    const wikilinkRegex = new RegExp(WIKILINK_PATTERN.source, 'g');
    while ((match = wikilinkRegex.exec(line)) !== null) {
        occurrences.push({
            tag: match[1].toLowerCase(),
            line: lineNumber,
            column: match.index,
            raw: match[0],
            context: line,
        });
    }
    return occurrences;
}
/**
 * Parse an entire note for all tag occurrences
 */
function parseNote(content) {
    const lines = content.split('\n');
    const occurrences = [];
    const tags = new Set();
    for (let i = 0; i < lines.length; i++) {
        const lineOccurrences = parseLineForTags(lines[i], i + 1); // 1-based line numbers
        for (const occurrence of lineOccurrences) {
            occurrences.push(occurrence);
            tags.add(occurrence.tag);
        }
    }
    return { occurrences, tags };
}
/**
 * Extract just the unique tags from content (quick scan)
 */
function extractTags(content) {
    const { tags } = parseNote(content);
    return Array.from(tags).sort();
}
/**
 * Check if a string is a valid tag name
 */
function isValidTagName(name) {
    const pattern = /^[\w\-]+(?:\/[\w\-]+)*$/;
    return pattern.test(name);
}
/**
 * Normalize a tag name (lowercase, trim)
 */
function normalizeTagName(name) {
    return name.toLowerCase().trim();
}
/**
 * Get the parent tag for hierarchical tags
 * e.g., "project/website" -> "project"
 * Returns null for top-level tags
 */
function getParentTag(tag) {
    const lastSlash = tag.lastIndexOf('/');
    if (lastSlash === -1)
        return null;
    return tag.substring(0, lastSlash);
}
/**
 * Get all ancestor tags for a hierarchical tag
 * e.g., "project/website/frontend" -> ["project", "project/website"]
 */
function getAncestorTags(tag) {
    const parts = tag.split('/');
    const ancestors = [];
    for (let i = 1; i < parts.length; i++) {
        ancestors.push(parts.slice(0, i).join('/'));
    }
    return ancestors;
}
/**
 * Check if a tag is a child of another tag
 */
function isChildOf(child, parent) {
    return child.startsWith(parent + '/');
}
/**
 * Get the display name for a tag (last segment)
 * e.g., "project/website" -> "website"
 */
function getTagDisplayName(tag) {
    const lastSlash = tag.lastIndexOf('/');
    if (lastSlash === -1)
        return tag;
    return tag.substring(lastSlash + 1);
}
