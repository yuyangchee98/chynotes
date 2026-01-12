"use strict";
/**
 * Keyboard shortcuts configuration and management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SHORTCUTS = void 0;
exports.formatKeyBinding = formatKeyBinding;
exports.matchesBinding = matchesBinding;
exports.getBinding = getBinding;
exports.loadCustomBindings = loadCustomBindings;
exports.saveCustomBindings = saveCustomBindings;
// Default keyboard shortcuts
exports.DEFAULT_SHORTCUTS = [
    // Navigation
    {
        action: 'openSearch',
        label: 'Open Search',
        category: 'navigation',
        defaultBinding: { key: 'k', ctrl: true, meta: true },
    },
    {
        action: 'goToToday',
        label: 'Go to Today',
        category: 'navigation',
        defaultBinding: { key: 'g', ctrl: true, meta: true },
    },
    // Formatting
    {
        action: 'bold',
        label: 'Bold',
        category: 'formatting',
        defaultBinding: { key: 'b', ctrl: true, meta: true },
    },
    {
        action: 'italic',
        label: 'Italic',
        category: 'formatting',
        defaultBinding: { key: 'i', ctrl: true, meta: true },
    },
    {
        action: 'strikethrough',
        label: 'Strikethrough',
        category: 'formatting',
        defaultBinding: { key: 's', ctrl: true, meta: true, shift: true },
    },
];
/**
 * Format a key binding for display
 */
function formatKeyBinding(binding) {
    const parts = [];
    if (binding.ctrl && binding.meta) {
        parts.push('⌘/Ctrl');
    }
    else if (binding.meta) {
        parts.push('⌘');
    }
    else if (binding.ctrl) {
        parts.push('Ctrl');
    }
    if (binding.shift)
        parts.push('Shift');
    if (binding.alt)
        parts.push('Alt');
    parts.push(binding.key.toUpperCase());
    return parts.join('+');
}
/**
 * Check if a keyboard event matches a binding
 */
function matchesBinding(event, binding) {
    // Check modifiers
    const ctrlMatch = binding.ctrl ? (!!event.ctrlKey || !!event.metaKey) : !event.ctrlKey;
    const metaMatch = binding.meta ? (!!event.metaKey || !!event.ctrlKey) : !event.metaKey;
    const shiftMatch = binding.shift ? !!event.shiftKey : !event.shiftKey;
    const altMatch = binding.alt ? !!event.altKey : !event.altKey;
    // Check key
    const keyMatch = event.key.toLowerCase() === binding.key.toLowerCase();
    return !!(keyMatch && ctrlMatch && metaMatch && shiftMatch && altMatch);
}
/**
 * Get a keyboard binding from settings, falling back to default
 */
function getBinding(action, customBindings) {
    if (customBindings[action]) {
        return customBindings[action];
    }
    const defaultConfig = exports.DEFAULT_SHORTCUTS.find(s => s.action === action);
    return defaultConfig?.defaultBinding || { key: '' };
}
/**
 * Load custom keyboard bindings from settings string
 */
function loadCustomBindings(settingsJson) {
    if (!settingsJson)
        return {};
    try {
        return JSON.parse(settingsJson);
    }
    catch {
        return {};
    }
}
/**
 * Save custom keyboard bindings to settings string
 */
function saveCustomBindings(bindings) {
    return JSON.stringify(bindings);
}
