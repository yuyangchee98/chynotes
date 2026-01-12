"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateImageDescription = generateImageDescription;
exports.checkVisionModelAvailable = checkVisionModelAvailable;
const database_1 = require("./database");
/**
 * Ollama API endpoint (default)
 */
const DEFAULT_OLLAMA_ENDPOINT = 'http://localhost:11434';
const DEFAULT_VISION_MODEL = 'qwen3-vl:8b';
/**
 * Generate a brief description for an image using a vision model
 * Used for auto-generating alt text when images are dropped/pasted
 *
 * @param imageBase64 Base64-encoded image data (without data URL prefix)
 * @returns A brief description suitable for alt text / filename, or empty string on failure
 */
async function generateImageDescription(imageBase64) {
    const endpoint = (0, database_1.getSetting)('ollamaEndpoint') || DEFAULT_OLLAMA_ENDPOINT;
    const model = (0, database_1.getSetting)('visionModel') || DEFAULT_VISION_MODEL;
    try {
        const response = await fetch(`${endpoint}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                prompt: 'Describe this image in 3-5 words suitable for an image filename or alt text. Be concise and descriptive. Output ONLY the description, nothing else.',
                images: [imageBase64],
                stream: false,
                options: {
                    temperature: 0.3,
                    num_predict: 50,
                },
            }),
        });
        if (!response.ok) {
            console.error(`Vision API error: ${response.status}`);
            return '';
        }
        const data = (await response.json());
        const description = data.response?.trim() || '';
        // Clean up the description - remove quotes, periods, extra spaces
        return cleanDescription(description);
    }
    catch (err) {
        console.error('Vision model error:', err);
        return '';
    }
}
/**
 * Clean up an AI-generated description for use as alt text
 */
function cleanDescription(description) {
    return description
        // Remove surrounding quotes
        .replace(/^["']|["']$/g, '')
        // Remove trailing punctuation
        .replace(/[.!?,;:]+$/, '')
        // Replace multiple spaces with single space
        .replace(/\s+/g, ' ')
        // Trim
        .trim()
        // Limit length
        .slice(0, 100);
}
/**
 * Check if a vision model is available
 */
async function checkVisionModelAvailable() {
    const endpoint = (0, database_1.getSetting)('ollamaEndpoint') || DEFAULT_OLLAMA_ENDPOINT;
    const model = (0, database_1.getSetting)('visionModel') || DEFAULT_VISION_MODEL;
    try {
        const response = await fetch(`${endpoint}/api/tags`);
        if (!response.ok) {
            return { available: false, model, error: `HTTP ${response.status}` };
        }
        const data = (await response.json());
        const models = data.models?.map((m) => m.name) || [];
        // Check if our vision model is in the list
        const hasModel = models.some((m) => m === model || m.startsWith(`${model}:`));
        if (!hasModel) {
            return {
                available: false,
                model,
                error: `Model "${model}" not found. Run: ollama pull ${model}`,
            };
        }
        return { available: true, model };
    }
    catch (err) {
        return { available: false, model, error: err.message };
    }
}
