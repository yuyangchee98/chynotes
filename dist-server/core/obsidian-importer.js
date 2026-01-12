"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeVault = analyzeVault;
exports.importVault = importVault;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const fs_1 = require("fs");
const file_manager_1 = require("./file-manager");
// ============================================================================
// Utility Functions
// ============================================================================
const DATE_PATTERNS = [
    { regex: /^(\d{4})-(\d{2})-(\d{2})$/, format: 'YYYY-MM-DD', parse: (m) => `${m[1]}-${m[2]}-${m[3]}` },
    { regex: /^(\d{2})-(\d{2})-(\d{4})$/, format: 'DD-MM-YYYY', parse: (m) => `${m[3]}-${m[2]}-${m[1]}` },
    { regex: /^(\d{2})\.(\d{2})\.(\d{4})$/, format: 'DD.MM.YYYY', parse: (m) => `${m[3]}-${m[2]}-${m[1]}` },
    { regex: /^(\d{4})\.(\d{2})\.(\d{2})$/, format: 'YYYY.MM.DD', parse: (m) => `${m[1]}-${m[2]}-${m[3]}` },
];
function parseDateFromName(name) {
    for (const pattern of DATE_PATTERNS) {
        const match = name.match(pattern.regex);
        if (match) {
            return {
                date: pattern.parse(match),
                format: pattern.format,
            };
        }
    }
    return null;
}
function normalizeTagName(name) {
    return name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-/]/g, '');
}
function normalizeWikiLinks(content) {
    return content.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, (_match, linkText) => {
        const normalized = normalizeTagName(linkText);
        return `[[${normalized}]]`;
    });
}
function isObsidianConfig(relativePath) {
    return relativePath.startsWith('.obsidian') || relativePath.startsWith('.obsidian/');
}
// ============================================================================
// Core Functions
// ============================================================================
async function analyzeVault(vaultPath) {
    const warnings = [];
    const files = [];
    if (!(0, fs_1.existsSync)(vaultPath)) {
        throw new Error(`Vault path does not exist: ${vaultPath}`);
    }
    const obsidianConfigPath = path.join(vaultPath, '.obsidian');
    if (!(0, fs_1.existsSync)(obsidianConfigPath)) {
        warnings.push('No .obsidian folder found - this may not be an Obsidian vault');
    }
    async function scanDir(dir, prefix = '') {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (isObsidianConfig(relativePath)) {
                continue;
            }
            if (entry.isDirectory()) {
                await scanDir(fullPath, relativePath);
            }
            else if (entry.isFile() && entry.name.endsWith('.md')) {
                const stats = await fs.stat(fullPath);
                const nameWithoutExt = entry.name.slice(0, -3);
                const dateInfo = parseDateFromName(nameWithoutExt);
                files.push({
                    relativePath,
                    absolutePath: fullPath,
                    name: nameWithoutExt,
                    size: stats.size,
                    modifiedAt: stats.mtime,
                    isDailyNote: dateInfo !== null,
                    date: dateInfo?.date || null,
                    hasContent: stats.size > 0,
                });
            }
        }
    }
    await scanDir(vaultPath);
    const dailyNotes = files.filter(f => f.isDailyNote);
    const pages = files.filter(f => !f.isDailyNote);
    const pagesWithContent = pages.filter(f => f.hasContent);
    const emptyPages = pages.filter(f => !f.hasContent);
    const formatCounts = {};
    for (const file of dailyNotes) {
        for (const pattern of DATE_PATTERNS) {
            if (pattern.regex.test(file.name)) {
                formatCounts[pattern.format] = (formatCounts[pattern.format] || 0) + 1;
                break;
            }
        }
    }
    const dailyNoteFormat = Object.entries(formatCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'YYYY-MM-DD';
    return {
        vaultPath,
        dailyNotes,
        pagesWithContent,
        emptyPages,
        dailyNoteFormat,
        totalFiles: files.length,
        warnings,
    };
}
async function importVault(vaultPath, options) {
    const analysis = await analyzeVault(vaultPath);
    const result = {
        dailyNotesImported: 0,
        dailyNotesSkipped: 0,
        pagesImported: 0,
        pagesSkipped: 0,
        errors: [],
        summary: '',
    };
    await (0, file_manager_1.ensureNotesDirectory)();
    await (0, file_manager_1.ensurePagesDirectory)();
    const notesDir = (0, file_manager_1.getNotesDirectory)();
    const pagesDir = (0, file_manager_1.getPagesDirectory)();
    // Import daily notes
    for (const file of analysis.dailyNotes) {
        try {
            const targetPath = path.join(notesDir, `${file.date}.md`);
            const exists = (0, fs_1.existsSync)(targetPath);
            if (exists && !options.overwriteExisting) {
                result.dailyNotesSkipped++;
                continue;
            }
            let content = await fs.readFile(file.absolutePath, 'utf-8');
            if (options.normalizeTags) {
                content = normalizeWikiLinks(content);
            }
            await fs.writeFile(targetPath, content, 'utf-8');
            result.dailyNotesImported++;
        }
        catch (error) {
            result.errors.push({
                file: file.relativePath,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    // Import pages with content
    for (const file of analysis.pagesWithContent) {
        try {
            const pageName = normalizeTagName(file.name);
            const targetPath = path.join(pagesDir, `${pageName}.md`);
            const exists = (0, fs_1.existsSync)(targetPath);
            if (exists && !options.overwriteExisting) {
                result.pagesSkipped++;
                continue;
            }
            let content = await fs.readFile(file.absolutePath, 'utf-8');
            if (options.normalizeTags) {
                content = normalizeWikiLinks(content);
            }
            // Ensure parent directory exists for hierarchical pages
            const dir = path.dirname(targetPath);
            if (!(0, fs_1.existsSync)(dir)) {
                await fs.mkdir(dir, { recursive: true });
            }
            await fs.writeFile(targetPath, content, 'utf-8');
            result.pagesImported++;
        }
        catch (error) {
            result.errors.push({
                file: file.relativePath,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    // Build summary
    const parts = [];
    if (result.dailyNotesImported > 0) {
        parts.push(`${result.dailyNotesImported} daily notes imported`);
    }
    if (result.dailyNotesSkipped > 0) {
        parts.push(`${result.dailyNotesSkipped} daily notes skipped`);
    }
    if (result.pagesImported > 0) {
        parts.push(`${result.pagesImported} pages imported`);
    }
    if (result.pagesSkipped > 0) {
        parts.push(`${result.pagesSkipped} pages skipped`);
    }
    if (result.errors.length > 0) {
        parts.push(`${result.errors.length} errors`);
    }
    result.summary = parts.join(', ') || 'Nothing to import';
    return result;
}
