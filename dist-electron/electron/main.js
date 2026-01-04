"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const file_manager_1 = require("../core/file-manager");
/**
 * Parse YYYY-MM-DD string as local date
 */
function parseLocalDate(dateStr) {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        const [, year, month, day] = match;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    // Fallback for ISO strings (though we shouldn't receive these anymore)
    return new Date(dateStr);
}
const database_1 = require("../core/database");
const index_manager_1 = require("../core/index-manager");
const code_generator_1 = require("../core/code-generator");
const prompt_manager_1 = require("../core/prompt-manager");
const database_2 = require("../core/database");
// Ensure notes directory exists on startup
(0, file_manager_1.ensureNotesDirectorySync)();
// Initialize database
(0, database_1.initDatabase)();
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 15, y: 15 },
    });
    // In development, load from Vite dev server
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5188');
        mainWindow.webContents.openDevTools();
    }
    else {
        // In production, load the built files
        mainWindow.loadFile(path_1.default.join(__dirname, '../../dist/index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
// IPC handlers for file operations
electron_1.ipcMain.handle('read-note', async (_event, dateStr) => {
    const date = parseLocalDate(dateStr);
    return await (0, file_manager_1.readNote)(date);
});
electron_1.ipcMain.handle('write-note', async (_event, dateStr, content) => {
    const date = parseLocalDate(dateStr);
    await (0, file_manager_1.writeNote)(date, content);
    // Re-index this note after writing
    await (0, index_manager_1.indexNote)(date);
});
electron_1.ipcMain.handle('list-notes', async () => {
    const dates = await (0, file_manager_1.listAllNotes)();
    return dates.map(d => (0, file_manager_1.formatDateForFileName)(d));
});
electron_1.ipcMain.handle('ensure-notes-directory', async () => {
    (0, file_manager_1.ensureNotesDirectorySync)();
});
// Tag-related IPC handlers
electron_1.ipcMain.handle('reindex-all', async () => {
    return await (0, index_manager_1.reindexAll)();
});
electron_1.ipcMain.handle('get-all-tags', () => {
    return (0, index_manager_1.getAllTagsWithCounts)();
});
electron_1.ipcMain.handle('get-tag-occurrences', (_event, tagName) => {
    return (0, index_manager_1.getTagOccurrences)(tagName);
});
electron_1.ipcMain.handle('search-tags', (_event, query) => {
    return (0, index_manager_1.searchTags)(query);
});
electron_1.ipcMain.handle('get-tag-tree', () => {
    return (0, index_manager_1.buildTagTree)();
});
// AI/Code generation IPC handlers
electron_1.ipcMain.handle('generate-tag-page', async (_event, tagName) => {
    return await (0, code_generator_1.generateTagPageCode)(tagName);
});
electron_1.ipcMain.handle('check-ollama', async () => {
    return await (0, code_generator_1.checkOllamaConnection)();
});
electron_1.ipcMain.handle('list-ollama-models', async () => {
    return await (0, code_generator_1.listOllamaModels)();
});
electron_1.ipcMain.handle('get-tag-prompt', (_event, tagName) => {
    return (0, prompt_manager_1.getPromptForTag)(tagName);
});
electron_1.ipcMain.handle('set-tag-prompt', (_event, tagName, prompt) => {
    (0, prompt_manager_1.setPromptForTag)(tagName, prompt);
});
electron_1.ipcMain.handle('get-cached-code', (_event, tagName) => {
    return (0, database_2.getCachedCodeByTagName)(tagName.toLowerCase());
});
electron_1.ipcMain.handle('update-note-line', async (_event, dateStr, lineNumber, newContent) => {
    const date = parseLocalDate(dateStr);
    await (0, file_manager_1.updateNoteLine)(date, lineNumber, newContent);
    // Re-index the note after updating
    await (0, index_manager_1.indexNote)(date);
});
// Settings IPC handlers
electron_1.ipcMain.handle('get-setting', (_event, key) => {
    return (0, database_2.getSetting)(key);
});
electron_1.ipcMain.handle('set-setting', (_event, key, value) => {
    (0, database_2.setSetting)(key, value);
});
// Snapshot IPC handlers
electron_1.ipcMain.handle('save-snapshot', (_event, noteDate, content) => {
    return (0, database_2.saveSnapshot)(noteDate, content);
});
electron_1.ipcMain.handle('get-snapshots', (_event, noteDate) => {
    return (0, database_2.getSnapshotsForNote)(noteDate);
});
electron_1.ipcMain.handle('get-snapshot', (_event, id) => {
    return (0, database_2.getSnapshot)(id);
});
electron_1.app.whenReady().then(async () => {
    // Initial index of all notes
    await (0, index_manager_1.reindexAll)();
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('will-quit', () => {
    (0, database_1.closeDatabase)();
});
