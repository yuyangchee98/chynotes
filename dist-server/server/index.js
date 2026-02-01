"use strict";
/**
 * Chynotes HTTP Server
 *
 * Exposes all core functionality as REST API endpoints.
 * This allows web/mobile clients to access notes stored on this machine.
 *
 * Default port: 60008
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = createServer;
const node_server_1 = require("@hono/node-server");
const hono_1 = require("hono");
const cors_1 = require("hono/cors");
const fs = __importStar(require("fs/promises"));
const path_1 = __importDefault(require("path"));
// Core imports
const file_manager_1 = require("../core/file-manager");
const vision_1 = require("../core/vision");
const database_1 = require("../core/database");
const index_manager_1 = require("../core/index-manager");
const code_generator_1 = require("../core/code-generator");
const prompt_manager_1 = require("../core/prompt-manager");
const database_2 = require("../core/database");
const embeddings_1 = require("../core/embeddings");
const embedding_queue_1 = require("../core/embedding-queue");
const tag_suggester_1 = require("../core/tag-suggester");
const frequency_index_1 = require("../core/frequency-index");
const system_status_1 = require("../core/system-status");
// ============================================================================
// Helpers
// ============================================================================
function parseLocalDate(dateStr) {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        const [, year, month, day] = match;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    return new Date(dateStr);
}
// ============================================================================
// Server Setup
// ============================================================================
const DEFAULT_PORT = 60008;
async function createServer() {
    // Initialize filesystem and database
    (0, file_manager_1.ensureNotesDirectorySync)();
    (0, file_manager_1.ensurePagesDirectorySync)();
    (0, database_1.initDatabase)();
    const app = new hono_1.Hono();
    // CORS for cross-origin requests (phone accessing mac)
    app.use('*', (0, cors_1.cors)({
        origin: '*',
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
    }));
    // ============================================================================
    // Note Routes
    // ============================================================================
    app.get('/api/notes', async (c) => {
        const dates = await (0, file_manager_1.listAllNotes)();
        return c.json(dates.map(d => (0, file_manager_1.formatDateForFileName)(d)));
    });
    app.get('/api/notes/:date', async (c) => {
        const dateStr = c.req.param('date');
        const date = parseLocalDate(dateStr);
        const content = await (0, file_manager_1.readNote)(date);
        return c.json({ content });
    });
    app.put('/api/notes/:date', async (c) => {
        const dateStr = c.req.param('date');
        const date = parseLocalDate(dateStr);
        const { content } = await c.req.json();
        await (0, file_manager_1.writeNote)(date, content);
        await (0, index_manager_1.indexNote)(date);
        (0, frequency_index_1.updateFrequencyIndexForNote)((0, file_manager_1.formatDateForFileName)(date), content);
        return c.json({ success: true });
    });
    app.patch('/api/notes/:date/line/:lineNumber', async (c) => {
        const dateStr = c.req.param('date');
        const lineNumber = parseInt(c.req.param('lineNumber'));
        const date = parseLocalDate(dateStr);
        const { content } = await c.req.json();
        await (0, file_manager_1.updateNoteLine)(date, lineNumber, content);
        await (0, index_manager_1.indexNote)(date);
        return c.json({ success: true });
    });
    // ============================================================================
    // Page Routes
    // ============================================================================
    app.get('/api/pages', async (c) => {
        const pages = await (0, file_manager_1.listAllPages)();
        return c.json(pages);
    });
    app.get('/api/pages/:name{.+}', async (c) => {
        const name = c.req.param('name');
        const content = await (0, file_manager_1.readPage)(name);
        return c.json({ content });
    });
    app.put('/api/pages/:name{.+}', async (c) => {
        const name = c.req.param('name');
        const { content } = await c.req.json();
        await (0, file_manager_1.writePage)(name, content);
        (0, database_2.upsertPage)(name);
        return c.json({ success: true });
    });
    app.get('/api/pages/:name{.+}/exists', async (c) => {
        const name = c.req.param('name');
        const exists = await (0, file_manager_1.pageFileExists)(name);
        return c.json({ exists });
    });
    app.post('/api/pages/:name{.+}', async (c) => {
        const name = c.req.param('name');
        const created = await (0, file_manager_1.createPageIfNotExists)(name);
        if (created) {
            (0, database_2.upsertPage)(name);
        }
        return c.json({ created });
    });
    // ============================================================================
    // Tag Routes
    // ============================================================================
    app.post('/api/reindex', async (c) => {
        const result = await (0, index_manager_1.reindexAll)();
        await (0, frequency_index_1.buildFrequencyIndex)();
        return c.json({ count: result });
    });
    app.get('/api/tags', async (c) => {
        const tags = (0, index_manager_1.getAllTagsWithCounts)();
        return c.json(tags);
    });
    app.get('/api/tags/search', async (c) => {
        const query = c.req.query('q') || '';
        const tags = (0, index_manager_1.searchTags)(query);
        return c.json(tags);
    });
    app.get('/api/tags/tree', async (c) => {
        const tree = (0, index_manager_1.buildTagTree)();
        return c.json(tree);
    });
    app.get('/api/tags/cooccurrences', async (c) => {
        const cooccurrences = (0, database_2.getTagCooccurrences)();
        return c.json(cooccurrences);
    });
    app.get('/api/tags/semantic-connections', async (c) => {
        const cooccurrences = (0, database_2.getTagCooccurrences)();
        const cooccurrencePairs = new Set();
        for (const co of cooccurrences) {
            const [t1, t2] = co.tag1 < co.tag2 ? [co.tag1, co.tag2] : [co.tag2, co.tag1];
            cooccurrencePairs.add(`${t1}|${t2}`);
        }
        const connections = (0, embeddings_1.getSemanticTagConnections)(cooccurrencePairs);
        return c.json(connections);
    });
    app.get('/api/tags/:name/occurrences', async (c) => {
        const tagName = c.req.param('name');
        const occurrences = (0, index_manager_1.getTagOccurrences)(tagName);
        return c.json(occurrences);
    });
    app.get('/api/tags/:name/prompt', async (c) => {
        const tagName = c.req.param('name');
        const prompt = (0, prompt_manager_1.getPromptForTag)(tagName);
        return c.json({ prompt });
    });
    app.put('/api/tags/:name/prompt', async (c) => {
        const tagName = c.req.param('name');
        const { prompt } = await c.req.json();
        (0, prompt_manager_1.setPromptForTag)(tagName, prompt);
        return c.json({ success: true });
    });
    // ============================================================================
    // AI/Code Generation Routes
    // ============================================================================
    app.post('/api/tags/:name/generate', async (c) => {
        const tagName = c.req.param('name');
        const code = await (0, code_generator_1.generateTagPageCode)(tagName);
        return c.json({ code });
    });
    app.get('/api/tags/:name/cached-code', async (c) => {
        const tagName = c.req.param('name');
        const code = (0, database_2.getCachedCodeByTagName)(tagName.toLowerCase());
        return c.json({ code });
    });
    app.get('/api/ollama/status', async (c) => {
        const status = await (0, code_generator_1.checkOllamaConnection)();
        return c.json(status);
    });
    app.get('/api/ollama/models', async (c) => {
        const models = await (0, code_generator_1.listOllamaModels)();
        return c.json(models);
    });
    // ============================================================================
    // Settings Routes
    // ============================================================================
    app.get('/api/settings/:key', async (c) => {
        const key = c.req.param('key');
        const value = (0, database_2.getSetting)(key);
        return c.json({ value });
    });
    app.put('/api/settings/:key', async (c) => {
        const key = c.req.param('key');
        const { value } = await c.req.json();
        (0, database_2.setSetting)(key, value);
        return c.json({ success: true });
    });
    // ============================================================================
    // Snapshot Routes
    // ============================================================================
    app.post('/api/snapshots', async (c) => {
        const { noteDate, content, documentType = 'note' } = await c.req.json();
        const snapshot = (0, database_2.saveSnapshot)(noteDate, content, documentType);
        return c.json({ snapshot });
    });
    app.get('/api/snapshots/:noteDate', async (c) => {
        const noteDate = c.req.param('noteDate');
        const documentType = (c.req.query('type') || 'note');
        const snapshots = (0, database_2.getSnapshotsForNote)(noteDate, documentType);
        return c.json(snapshots);
    });
    app.get('/api/snapshots/by-id/:id', async (c) => {
        const id = parseInt(c.req.param('id'));
        const snapshot = (0, database_2.getSnapshot)(id);
        return c.json({ snapshot });
    });
    app.get('/api/snapshots/count', async (c) => {
        const count = (0, database_2.getSnapshotCount)();
        return c.json({ count });
    });
    app.delete('/api/snapshots/prune', async (c) => {
        const { retentionDays } = await c.req.json();
        const deleted = (0, database_2.pruneSnapshotsByAge)(retentionDays);
        return c.json({ deleted });
    });
    // ============================================================================
    // Embedding Routes
    // ============================================================================
    app.get('/api/embeddings/similar/:tagName', async (c) => {
        const tagName = c.req.param('tagName');
        const limit = parseInt(c.req.query('limit') || '20');
        const results = await (0, embeddings_1.findSemanticallySimilar)(tagName, limit);
        return c.json(results);
    });
    app.get('/api/embeddings/stats', async (c) => {
        return c.json({
            embeddedBlocks: (0, database_2.getEmbeddedBlockCount)(),
            totalBlocks: (0, database_2.getTotalBlockCount)(),
            queueStatus: (0, embedding_queue_1.getQueueStatus)(),
            enabled: (0, embedding_queue_1.isEmbeddingEnabled)(),
        });
    });
    app.post('/api/embeddings/rebuild', async (c) => {
        await (0, embedding_queue_1.rebuildAllEmbeddings)();
        return c.json((0, embedding_queue_1.getQueueStatus)());
    });
    app.put('/api/embeddings/enabled', async (c) => {
        const { enabled } = await c.req.json();
        (0, embedding_queue_1.setEmbeddingEnabled)(enabled);
        return c.json({ enabled: (0, embedding_queue_1.isEmbeddingEnabled)() });
    });
    app.get('/api/embeddings/model/status', async (c) => {
        const status = await (0, embeddings_1.checkEmbeddingModelAvailable)();
        return c.json(status);
    });
    app.get('/api/embeddings/models', async (c) => {
        const models = await (0, embeddings_1.listEmbeddingModels)();
        return c.json(models);
    });
    // ============================================================================
    // Block Routes
    // ============================================================================
    app.get('/api/blocks/:id', async (c) => {
        const id = c.req.param('id');
        const block = (0, database_2.getBlockById)(id);
        return c.json({ block });
    });
    app.get('/api/blocks/:id/children', async (c) => {
        const id = c.req.param('id');
        const blocks = (0, database_2.getBlockWithChildren)(id);
        return c.json(blocks);
    });
    // ============================================================================
    // Tag Suggestions Routes
    // ============================================================================
    app.post('/api/suggestions', async (c) => {
        const { text, currentNoteDate } = await c.req.json();
        const suggestions = await (0, tag_suggester_1.getSuggestionsForBlockAsync)(text, currentNoteDate);
        return c.json(suggestions);
    });
    app.post('/api/retroactive-tag', async (c) => {
        const { term, tag, notes } = await c.req.json();
        let modifiedCount = 0;
        for (const noteDate of notes) {
            const modified = await (0, file_manager_1.replaceTermWithTag)(noteDate, term, tag);
            if (modified) {
                const [year, month, day] = noteDate.split('-').map(Number);
                const date = new Date(year, month - 1, day);
                await (0, index_manager_1.indexNote)(date);
                const content = await (0, file_manager_1.readNote)(date);
                if (content) {
                    (0, frequency_index_1.updateFrequencyIndexForNote)(noteDate, content);
                }
                modifiedCount++;
            }
        }
        return c.json({ modifiedCount });
    });
    // ============================================================================
    // System Status Route
    // ============================================================================
    app.get('/api/system/status', async (c) => {
        return c.json((0, system_status_1.getSystemStatus)());
    });
    // ============================================================================
    // Asset Routes
    // ============================================================================
    app.post('/api/assets', async (c) => {
        const { buffer, originalName, dateStr } = await c.req.json();
        // Buffer comes as array, convert to Uint8Array
        const uint8Buffer = new Uint8Array(buffer);
        const result = await (0, file_manager_1.saveAsset)(uint8Buffer, originalName, dateStr);
        return c.json(result);
    });
    app.get('/api/assets/resolve', async (c) => {
        const relativePath = c.req.query('path') || '';
        const absolutePath = (0, file_manager_1.resolveAssetPath)(relativePath);
        return c.json({ absolutePath });
    });
    app.get('/api/assets/is-image', async (c) => {
        const filename = c.req.query('filename') || '';
        return c.json({ isImage: (0, file_manager_1.isImageFile)(filename) });
    });
    app.post('/api/assets/describe', async (c) => {
        const { imageBase64 } = await c.req.json();
        const description = await (0, vision_1.generateImageDescription)(imageBase64);
        return c.json({ description });
    });
    // Serve actual asset files
    app.get('/assets/*', async (c) => {
        const assetPath = c.req.path.replace('/assets/', '');
        const fullPath = path_1.default.join((0, file_manager_1.getAssetsDirectory)(), assetPath);
        try {
            const file = await fs.readFile(fullPath);
            const ext = path_1.default.extname(fullPath).toLowerCase();
            const contentType = {
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.svg': 'image/svg+xml',
            }[ext] || 'application/octet-stream';
            return new Response(file, {
                headers: { 'Content-Type': contentType }
            });
        }
        catch {
            return c.notFound();
        }
    });
    // ============================================================================
    // Health Check
    // ============================================================================
    app.get('/api/health', async (c) => {
        return c.json({ status: 'ok', timestamp: Date.now() });
    });
    return app;
}
// ============================================================================
// Main Entry Point
// ============================================================================
async function main() {
    const port = parseInt(process.env.CHYNOTES_PORT || String(DEFAULT_PORT));
    console.log('🚀 Starting Chynotes server...');
    // Initialize
    const app = await createServer();
    // Initial indexing
    (0, system_status_1.setIndexingStatus)(true, 'Indexing notes...');
    await (0, index_manager_1.reindexAll)();
    (0, system_status_1.setIndexingStatus)(false);
    (0, system_status_1.setFrequencyIndexStatus)(true, 'Building frequency index...');
    await (0, frequency_index_1.buildFrequencyIndex)();
    (0, system_status_1.setFrequencyIndexStatus)(false);
    (0, database_2.autoCleanupSnapshots)();
    (0, embedding_queue_1.processBacklogOnStartup)();
    (0, system_status_1.setSystemReady)(true);
    // Start server
    (0, node_server_1.serve)({
        fetch: app.fetch,
        port,
    }, (info) => {
        console.log(`✅ Chynotes server running on http://localhost:${info.port}`);
        console.log(`   Access from other devices via Tailscale`);
    });
}
// Handle shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    (0, database_1.closeDatabase)();
    process.exit(0);
});
process.on('SIGTERM', () => {
    (0, database_1.closeDatabase)();
    process.exit(0);
});
// Only run if this is the main module (executed directly, not imported)
// Check if this file is being run directly via node
const isMainModule = require.main === module;
if (isMainModule) {
    main().catch((err) => {
        console.error('Failed to start server:', err);
        process.exit(1);
    });
}
