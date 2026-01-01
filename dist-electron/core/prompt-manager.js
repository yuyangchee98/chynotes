"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPromptForTag = getPromptForTag;
exports.setPromptForTag = setPromptForTag;
exports.hasCustomPrompt = hasCustomPrompt;
exports.getDefaultPrompt = getDefaultPrompt;
exports.listDefaultPrompts = listDefaultPrompts;
const database_1 = require("./database");
/**
 * Default prompts for common tags
 */
const DEFAULT_PROMPTS = {
    todo: `Show all items as an interactive checklist.
- Display incomplete items first, grouped by date
- Each item should have a checkbox
- Show the date each item was created
- Allow checking items off`,
    done: `Show completed items in reverse chronological order.
- Group by date
- Show a summary count at the top`,
};
/**
 * Fallback prompt for tags without a custom prompt
 */
const FALLBACK_PROMPT = `Display all notes with this tag in a clean, organized way.
- Group by date
- Make it easy to scan and read
- Highlight any action items or important information`;
/**
 * Get the prompt for a tag
 * Returns custom prompt if set, default prompt if available, or fallback
 */
function getPromptForTag(tagName) {
    (0, database_1.initDatabase)();
    const tag = (0, database_1.getTagByName)(tagName.toLowerCase());
    // Return custom prompt if set
    if (tag?.prompt) {
        return tag.prompt;
    }
    // Check for default prompt
    const lowerName = tagName.toLowerCase();
    if (DEFAULT_PROMPTS[lowerName]) {
        return DEFAULT_PROMPTS[lowerName];
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
 * Check if a tag has a custom prompt (not using default)
 */
function hasCustomPrompt(tagName) {
    (0, database_1.initDatabase)();
    const tag = (0, database_1.getTagByName)(tagName.toLowerCase());
    return !!tag?.prompt;
}
/**
 * Get the default prompt for a tag type (for showing in UI)
 */
function getDefaultPrompt(tagName) {
    return DEFAULT_PROMPTS[tagName.toLowerCase()] || null;
}
/**
 * List all available default prompt templates
 */
function listDefaultPrompts() {
    return { ...DEFAULT_PROMPTS };
}
