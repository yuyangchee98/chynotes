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
});
