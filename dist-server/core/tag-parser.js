"use strict";
/**
 * Tag Parser
 *
 * Tags use wiki-link syntax only: [[todo]], [[project/website]], [[person/sarah]]
 * Hashtags (#) are reserved for markdown headings.
 *
 * Tags are normalized to lowercase canonical form.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLineForTags = parseLineForTags;
exports.parseNote = parseNote;
// Wiki-link pattern: [[word]] or [[word/subword]]
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
    // Find wiki-links
    let match;
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
