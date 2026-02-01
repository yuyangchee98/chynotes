"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQueueStatus = getQueueStatus;
exports.setStatusCallback = setStatusCallback;
exports.queueBlockForEmbedding = queueBlockForEmbedding;
exports.queueBlocksForEmbedding = queueBlocksForEmbedding;
exports.setEmbeddingEnabled = setEmbeddingEnabled;
exports.isEmbeddingEnabled = isEmbeddingEnabled;
exports.clearQueue = clearQueue;
exports.getQueueLength = getQueueLength;
exports.rebuildAllEmbeddings = rebuildAllEmbeddings;
exports.processBacklogOnStartup = processBacklogOnStartup;
const database_1 = require("./database");
const embeddings_1 = require("./embeddings");
const system_status_1 = require("./system-status");
/**
 * Queue of block IDs waiting to be embedded.
 * Using Set for O(1) lookup and automatic duplicate prevention.
 */
const embeddingQueue = new Set();
/**
 * Whether the queue processor is currently running
 */
let isProcessing = false;
/**
 * Whether embedding is enabled (Ollama available)
 */
let embeddingEnabled = true;
let statusCallback = null;
let lastError = null;
let processedCount = 0;
/**
 * Get current queue status
 */
function getQueueStatus() {
    return {
        queueLength: embeddingQueue.size,
        isProcessing,
        lastError,
        processedCount,
    };
}
/**
 * Set callback for status updates
 */
function setStatusCallback(callback) {
    statusCallback = callback;
}
/**
 * Notify status change
 */
function notifyStatus() {
    if (statusCallback) {
        statusCallback(getQueueStatus());
    }
    // Also update unified system status
    const msg = embeddingQueue.size > 0 ? `Embedding ${embeddingQueue.size} blocks...` : null;
    (0, system_status_1.setEmbeddingsStatus)(isProcessing, embeddingQueue.size, msg);
}
/**
 * Add a block ID to the embedding queue
 * Duplicates are automatically ignored by Set
 */
function queueBlockForEmbedding(blockId) {
    if (!embeddingEnabled)
        return;
    const sizeBefore = embeddingQueue.size;
    embeddingQueue.add(blockId);
    if (embeddingQueue.size > sizeBefore) {
        notifyStatus();
    }
    // Start processing if not already running
    processQueue();
}
/**
 * Add multiple block IDs to the queue
 */
function queueBlocksForEmbedding(blockIds) {
    if (!embeddingEnabled)
        return;
    for (const blockId of blockIds) {
        embeddingQueue.add(blockId);
    }
    notifyStatus();
    processQueue();
}
/**
 * Process the embedding queue
 * Runs asynchronously, one block at a time
 */
async function processQueue() {
    if (isProcessing || embeddingQueue.size === 0 || !embeddingEnabled) {
        return;
    }
    isProcessing = true;
    notifyStatus();
    while (embeddingQueue.size > 0 && embeddingEnabled) {
        // Get first item from Set and remove it
        const blockId = embeddingQueue.values().next().value;
        embeddingQueue.delete(blockId);
        notifyStatus();
        try {
            await embedSingleBlock(blockId);
            processedCount++;
            lastError = null;
        }
        catch (err) {
            lastError = err.message;
            console.error(`Failed to embed block ${blockId}:`, err);
            // If we get too many errors, pause embedding
            if (lastError.includes('connection refused') || lastError.includes('ECONNREFUSED')) {
                console.warn('Ollama appears to be unavailable, pausing embedding');
                embeddingEnabled = false;
                break;
            }
        }
        notifyStatus();
    }
    isProcessing = false;
    notifyStatus();
}
/**
 * Embed a single block
 */
async function embedSingleBlock(blockId) {
    const block = (0, database_1.getBlockById)(blockId);
    if (!block) {
        return; // Block was deleted
    }
    // Skip very short content
    const content = block.content.trim();
    if (content.length < 10) {
        return;
    }
    // Generate embedding
    const embedding = await (0, embeddings_1.generateEmbedding)(content);
    // Store in database
    (0, database_1.upsertBlockEmbedding)(blockId, embedding);
}
/**
 * Enable or disable embedding
 */
function setEmbeddingEnabled(enabled) {
    embeddingEnabled = enabled;
    if (enabled) {
        processQueue();
    }
    notifyStatus();
}
/**
 * Check if embedding is enabled
 */
function isEmbeddingEnabled() {
    return embeddingEnabled;
}
/**
 * Clear the queue
 */
function clearQueue() {
    embeddingQueue.clear();
    notifyStatus();
}
/**
 * Get queue length
 */
function getQueueLength() {
    return embeddingQueue.size;
}
/**
 * Rebuild all embeddings
 * Queues all blocks that need embedding
 */
async function rebuildAllEmbeddings() {
    const blocks = (0, database_1.getBlocksNeedingEmbedding)(10000);
    queueBlocksForEmbedding(blocks.map((b) => b.id));
}
/**
 * Process any blocks that need embedding on startup
 */
function processBacklogOnStartup() {
    const blocks = (0, database_1.getBlocksNeedingEmbedding)(100);
    if (blocks.length > 0) {
        queueBlocksForEmbedding(blocks.map((b) => b.id));
    }
}
