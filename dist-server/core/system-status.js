"use strict";
/**
 * Unified system status tracking for background processes
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSystemStatus = getSystemStatus;
exports.setSystemStatusCallback = setSystemStatusCallback;
exports.setIndexingStatus = setIndexingStatus;
exports.setFrequencyIndexStatus = setFrequencyIndexStatus;
exports.setEmbeddingsStatus = setEmbeddingsStatus;
exports.setSystemReady = setSystemReady;
exports.isProcessing = isProcessing;
let status = {
    indexing: { isActive: false, message: null },
    frequencyIndex: { isActive: false, message: null },
    embeddings: { isActive: false, queueLength: 0, message: null },
    ready: false,
    lastActivityAt: null,
};
let statusCallback = null;
/**
 * Get current system status
 */
function getSystemStatus() {
    return { ...status };
}
/**
 * Set callback for status updates (used by IPC to push to renderer)
 */
function setSystemStatusCallback(callback) {
    statusCallback = callback;
}
function notifyChange() {
    if (statusCallback) {
        statusCallback(getSystemStatus());
    }
}
/**
 * Update indexing status
 */
function setIndexingStatus(isActive, message = null) {
    const wasActive = status.indexing.isActive;
    status.indexing = { isActive, message };
    if (wasActive && !isActive) {
        status.lastActivityAt = Date.now();
    }
    notifyChange();
}
/**
 * Update frequency index status
 */
function setFrequencyIndexStatus(isActive, message = null) {
    const wasActive = status.frequencyIndex.isActive;
    status.frequencyIndex = { isActive, message };
    if (wasActive && !isActive) {
        status.lastActivityAt = Date.now();
    }
    notifyChange();
}
/**
 * Update embeddings status
 */
function setEmbeddingsStatus(isActive, queueLength, message = null) {
    const wasActive = status.embeddings.isActive;
    status.embeddings = { isActive, queueLength, message };
    if (wasActive && !isActive) {
        status.lastActivityAt = Date.now();
    }
    notifyChange();
}
/**
 * Mark system as ready (all startup tasks complete)
 */
function setSystemReady(ready) {
    status.ready = ready;
    notifyChange();
}
/**
 * Check if any background process is active
 */
function isProcessing() {
    return status.indexing.isActive ||
        status.frequencyIndex.isActive ||
        status.embeddings.isActive;
}
