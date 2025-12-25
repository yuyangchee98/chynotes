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
    // Settings operations
    getSetting: (key) => {
        return electron_1.ipcRenderer.invoke('get-setting', key);
    },
    setSetting: (key, value) => {
        return electron_1.ipcRenderer.invoke('set-setting', key, value);
    },
});
