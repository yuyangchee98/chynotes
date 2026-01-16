"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('api', {
    // Note operations
    readNote: (dateISO) => {
        return electron_1.ipcRenderer.invoke('read-note', dateISO);
    },
    writeNote: (dateISO, content) => {
        return electron_1.ipcRenderer.invoke('write-note', dateISO, content);
    },
    listNotes: () => {
        return electron_1.ipcRenderer.invoke('list-notes');
    },
    ensureNotesDirectory: () => {
        return electron_1.ipcRenderer.invoke('ensure-notes-directory');
    },
    // Page operations
    readPage: (name) => {
        return electron_1.ipcRenderer.invoke('read-page', name);
    },
    writePage: (name, content) => {
        return electron_1.ipcRenderer.invoke('write-page', name, content);
    },
    pageExists: (name) => {
        return electron_1.ipcRenderer.invoke('page-exists', name);
    },
    createPage: (name) => {
        return electron_1.ipcRenderer.invoke('create-page', name);
    },
    listPages: () => {
        return electron_1.ipcRenderer.invoke('list-pages');
    },
    // Tag operations
    reindexAll: () => {
        return electron_1.ipcRenderer.invoke('reindex-all');
    },
    getAllTags: () => {
        return electron_1.ipcRenderer.invoke('get-all-tags');
    },
    getTagOccurrences: (tagName) => {
        return electron_1.ipcRenderer.invoke('get-tag-occurrences', tagName);
    },
    searchTags: (query) => {
        return electron_1.ipcRenderer.invoke('search-tags', query);
    },
    getTagTree: () => {
        return electron_1.ipcRenderer.invoke('get-tag-tree');
    },
    getTagCooccurrences: () => {
        return electron_1.ipcRenderer.invoke('get-tag-cooccurrences');
    },
    getSemanticTagConnections: () => {
        return electron_1.ipcRenderer.invoke('get-semantic-tag-connections');
    },
    // AI/Code generation operations
    generateTagPage: (tagName) => {
        return electron_1.ipcRenderer.invoke('generate-tag-page', tagName);
    },
    checkOllama: () => {
        return electron_1.ipcRenderer.invoke('check-ollama');
    },
    listOllamaModels: () => {
        return electron_1.ipcRenderer.invoke('list-ollama-models');
    },
    getTagPrompt: (tagName) => {
        return electron_1.ipcRenderer.invoke('get-tag-prompt', tagName);
    },
    setTagPrompt: (tagName, prompt) => {
        return electron_1.ipcRenderer.invoke('set-tag-prompt', tagName, prompt);
    },
    getCachedCode: (tagName) => {
        return electron_1.ipcRenderer.invoke('get-cached-code', tagName);
    },
    updateNoteLine: (dateStr, lineNumber, newContent) => {
        return electron_1.ipcRenderer.invoke('update-note-line', dateStr, lineNumber, newContent);
    },
    // Settings operations
    getSetting: (key) => {
        return electron_1.ipcRenderer.invoke('get-setting', key);
    },
    setSetting: (key, value) => {
        return electron_1.ipcRenderer.invoke('set-setting', key, value);
    },
    // Snapshot operations
    saveSnapshot: (noteDate, content, documentType = 'note') => {
        return electron_1.ipcRenderer.invoke('save-snapshot', noteDate, content, documentType);
    },
    getSnapshots: (noteDate, documentType = 'note') => {
        return electron_1.ipcRenderer.invoke('get-snapshots', noteDate, documentType);
    },
    getSnapshot: (id) => {
        return electron_1.ipcRenderer.invoke('get-snapshot', id);
    },
    getSnapshotCount: () => {
        return electron_1.ipcRenderer.invoke('get-snapshot-count');
    },
    pruneSnapshotsByAge: (retentionDays) => {
        return electron_1.ipcRenderer.invoke('prune-snapshots-by-age', retentionDays);
    },
    // Embedding operations
    findSemanticSimilar: (tagName, limit) => {
        return electron_1.ipcRenderer.invoke('find-semantic-similar', tagName, limit);
    },
    getEmbeddingStats: () => {
        return electron_1.ipcRenderer.invoke('get-embedding-stats');
    },
    rebuildEmbeddings: () => {
        return electron_1.ipcRenderer.invoke('rebuild-embeddings');
    },
    setEmbeddingEnabled: (enabled) => {
        return electron_1.ipcRenderer.invoke('set-embedding-enabled', enabled);
    },
    checkEmbeddingModel: () => {
        return electron_1.ipcRenderer.invoke('check-embedding-model');
    },
    listEmbeddingModels: () => {
        return electron_1.ipcRenderer.invoke('list-embedding-models');
    },
    // Block operations
    getBlockById: (id) => {
        return electron_1.ipcRenderer.invoke('get-block-by-id', id);
    },
    getBlockWithChildren: (id) => {
        return electron_1.ipcRenderer.invoke('get-block-with-children', id);
    },
    // Tag suggestion operations
    getTagSuggestions: (text, currentNoteDate) => {
        return electron_1.ipcRenderer.invoke('get-tag-suggestions', text, currentNoteDate);
    },
    // Retroactive tagging
    retroactiveTag: (term, tag, notes) => {
        return electron_1.ipcRenderer.invoke('retroactive-tag', term, tag, notes);
    },
    // System status
    getSystemStatus: () => {
        return electron_1.ipcRenderer.invoke('get-system-status');
    },
    // Asset operations
    saveAsset: (buffer, originalName, dateStr) => {
        // Convert Uint8Array to regular array for IPC serialization
        return electron_1.ipcRenderer.invoke('save-asset', Array.from(buffer), originalName, dateStr);
    },
    resolveAssetPath: (relativePath) => {
        return electron_1.ipcRenderer.invoke('resolve-asset-path', relativePath);
    },
    isImageFile: (filename) => {
        return electron_1.ipcRenderer.invoke('is-image-file', filename);
    },
    generateImageDescription: (imageBase64) => {
        return electron_1.ipcRenderer.invoke('generate-image-description', imageBase64);
    },
    // Obsidian import operations
    selectFolderDialog: () => {
        return electron_1.ipcRenderer.invoke('select-folder-dialog');
    },
    analyzeObsidianVault: (vaultPath) => {
        return electron_1.ipcRenderer.invoke('analyze-obsidian-vault', vaultPath);
    },
    importObsidianVault: (vaultPath, options) => {
        return electron_1.ipcRenderer.invoke('import-obsidian-vault', vaultPath, options);
    },
    // Remote access server operations
    startServer: (port) => {
        return electron_1.ipcRenderer.invoke('start-server', port);
    },
    stopServer: () => {
        return electron_1.ipcRenderer.invoke('stop-server');
    },
    getServerStatus: () => {
        return electron_1.ipcRenderer.invoke('get-server-status');
    },
    // Tag prompt operations (custom AI prompts per tag)
    getTagPrompts: (tagName) => {
        return electron_1.ipcRenderer.invoke('get-tag-prompts', tagName);
    },
    createTagPrompt: (tagName, name, prompt) => {
        return electron_1.ipcRenderer.invoke('create-tag-prompt', tagName, name, prompt);
    },
    updateTagPrompt: (id, name, prompt) => {
        return electron_1.ipcRenderer.invoke('update-tag-prompt', id, name, prompt);
    },
    deleteTagPrompt: (id) => {
        return electron_1.ipcRenderer.invoke('delete-tag-prompt', id);
    },
    runTagPromptStreaming: (tagName, promptId, promptText, onToken, onComplete, onError) => {
        // Generate unique channel for this stream
        const streamId = `tag-prompt-stream-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const tokenHandler = (_event, token) => {
            onToken(token);
        };
        const completeHandler = (_event, response) => {
            cleanup();
            onComplete(response);
        };
        const errorHandler = (_event, error) => {
            cleanup();
            onError(error);
        };
        const cleanup = () => {
            electron_1.ipcRenderer.removeListener(`${streamId}-token`, tokenHandler);
            electron_1.ipcRenderer.removeListener(`${streamId}-complete`, completeHandler);
            electron_1.ipcRenderer.removeListener(`${streamId}-error`, errorHandler);
        };
        electron_1.ipcRenderer.on(`${streamId}-token`, tokenHandler);
        electron_1.ipcRenderer.on(`${streamId}-complete`, completeHandler);
        electron_1.ipcRenderer.on(`${streamId}-error`, errorHandler);
        // Start the stream
        electron_1.ipcRenderer.invoke('run-tag-prompt-streaming', tagName, promptId, promptText, streamId);
        // Return cleanup function
        return cleanup;
    },
});
