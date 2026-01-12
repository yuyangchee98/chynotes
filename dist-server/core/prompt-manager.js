"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPromptForTag = getPromptForTag;
exports.setPromptForTag = setPromptForTag;
exports.hasCustomPrompt = hasCustomPrompt;
const database_1 = require("./database");
/**
 * Fallback prompt for tags without a custom prompt
 * Used for future AI directive features
 */
const FALLBACK_PROMPT = `Display all notes with this tag in a clean, organized way.
- Group by date
- Make it easy to scan and read
- Highlight any action items or important information`;
/**
 * Get the prompt for a tag
 * Returns custom prompt if set, or fallback
 */
function getPromptForTag(tagName) {
    (0, database_1.initDatabase)();
    const tag = (0, database_1.getTagByName)(tagName.toLowerCase());
    // Return custom prompt if set
    if (tag?.prompt) {
        return tag.prompt;
    }
    return FALLBACK_PROMPT;
}
/**
 * Set a custom prompt for a tag
 */
function setPromptForTag(tagName, prompt) {
    (0, database_1.initDatabase)();
    const tag = (0, database_1.getOrCreateTag)(tagName.toLowerCase());
    (0, database_1.updateTagPrompt)(tag.id, prompt);
}
/**
 * Check if a tag has a custom prompt
 */
function hasCustomPrompt(tagName) {
    (0, database_1.initDatabase)();
    const tag = (0, database_1.getTagByName)(tagName.toLowerCase());
    return !!tag?.prompt;
}
