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
    idea: `Group ideas by theme or topic.
- Look for connections between related ideas
- Show as cards or a mind-map style layout
- Highlight recurring themes`,
    meeting: `Create a timeline of meetings.
- Show key points and decisions from each meeting
- Highlight action items
- Group by project or person if applicable`,
    expense: `Show spending breakdown.
- Chart expenses by category if categories are mentioned
- List recent items with amounts
- Show running total`,
    goal: `Create a progress tracker.
- Show milestones and progress
- List related tasks
- Highlight blockers or next steps`,
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
    // Check for default prompt (check base tag name for hierarchical tags)
    const baseName = tagName.split('/')[0].toLowerCase();
    if (DEFAULT_PROMPTS[baseName]) {
        return DEFAULT_PROMPTS[baseName];
    }
    // Check if it's a person tag
    if (tagName.toLowerCase().startsWith('person/')) {
        return `Show all interactions with this person chronologically.
- Highlight commitments and action items
- Show context for each mention
- Summarize the relationship`;
    }
    // Check if it's a project tag
    if (tagName.toLowerCase().startsWith('project/')) {
        return `Create a project dashboard.
- Show timeline of activity
- List open items and blockers
- Summarize recent progress`;
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
    const baseName = tagName.split('/')[0].toLowerCase();
    return DEFAULT_PROMPTS[baseName] || null;
}
/**
 * List all available default prompt templates
 */
function listDefaultPrompts() {
    return { ...DEFAULT_PROMPTS };
}
