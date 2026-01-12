import * as fs from 'fs/promises'
import * as path from 'path'
import { existsSync } from 'fs'
import {
  getNotesDirectory,
  getPagesDirectory,
  ensureNotesDirectory,
  ensurePagesDirectory,
} from './file-manager'

// ============================================================================
// Types
// ============================================================================

export interface ObsidianFile {
  relativePath: string
  absolutePath: string
  name: string
  size: number
  modifiedAt: Date
  isDailyNote: boolean
  date: string | null
  hasContent: boolean
}

export interface VaultAnalysis {
  vaultPath: string
  dailyNotes: ObsidianFile[]
  pagesWithContent: ObsidianFile[]
  emptyPages: ObsidianFile[]
  dailyNoteFormat: string
  totalFiles: number
  warnings: string[]
}

export interface ImportOptions {
  overwriteExisting: boolean
  normalizeTags: boolean
}

export interface ImportResult {
  dailyNotesImported: number
  dailyNotesSkipped: number
  pagesImported: number
  pagesSkipped: number
  errors: Array<{ file: string; error: string }>
  summary: string
}

// ============================================================================
// Utility Functions
// ============================================================================

const DATE_PATTERNS = [
  { regex: /^(\d{4})-(\d{2})-(\d{2})$/, format: 'YYYY-MM-DD', parse: (m: RegExpMatchArray) => `${m[1]}-${m[2]}-${m[3]}` },
  { regex: /^(\d{2})-(\d{2})-(\d{4})$/, format: 'DD-MM-YYYY', parse: (m: RegExpMatchArray) => `${m[3]}-${m[2]}-${m[1]}` },
  { regex: /^(\d{2})\.(\d{2})\.(\d{4})$/, format: 'DD.MM.YYYY', parse: (m: RegExpMatchArray) => `${m[3]}-${m[2]}-${m[1]}` },
  { regex: /^(\d{4})\.(\d{2})\.(\d{2})$/, format: 'YYYY.MM.DD', parse: (m: RegExpMatchArray) => `${m[1]}-${m[2]}-${m[3]}` },
]

function parseDateFromName(name: string): { date: string; format: string } | null {
  for (const pattern of DATE_PATTERNS) {
    const match = name.match(pattern.regex)
    if (match) {
      return {
        date: pattern.parse(match),
        format: pattern.format,
      }
    }
  }
  return null
}

function normalizeTagName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-/]/g, '')
}

function normalizeWikiLinks(content: string): string {
  return content.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, (_match, linkText) => {
    const normalized = normalizeTagName(linkText)
    return `[[${normalized}]]`
  })
}

function isObsidianConfig(relativePath: string): boolean {
  return relativePath.startsWith('.obsidian') || relativePath.startsWith('.obsidian/')
}

// ============================================================================
// Core Functions
// ============================================================================

export async function analyzeVault(vaultPath: string): Promise<VaultAnalysis> {
  const warnings: string[] = []
  const files: ObsidianFile[] = []

  if (!existsSync(vaultPath)) {
    throw new Error(`Vault path does not exist: ${vaultPath}`)
  }

  const obsidianConfigPath = path.join(vaultPath, '.obsidian')
  if (!existsSync(obsidianConfigPath)) {
    warnings.push('No .obsidian folder found - this may not be an Obsidian vault')
  }

  async function scanDir(dir: string, prefix: string = ''): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name

      if (isObsidianConfig(relativePath)) {
        continue
      }

      if (entry.isDirectory()) {
        await scanDir(fullPath, relativePath)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const stats = await fs.stat(fullPath)
        const nameWithoutExt = entry.name.slice(0, -3)
        const dateInfo = parseDateFromName(nameWithoutExt)

        files.push({
          relativePath,
          absolutePath: fullPath,
          name: nameWithoutExt,
          size: stats.size,
          modifiedAt: stats.mtime,
          isDailyNote: dateInfo !== null,
          date: dateInfo?.date || null,
          hasContent: stats.size > 0,
        })
      }
    }
  }

  await scanDir(vaultPath)

  const dailyNotes = files.filter(f => f.isDailyNote)
  const pages = files.filter(f => !f.isDailyNote)
  const pagesWithContent = pages.filter(f => f.hasContent)
  const emptyPages = pages.filter(f => !f.hasContent)

  const formatCounts: Record<string, number> = {}
  for (const file of dailyNotes) {
    for (const pattern of DATE_PATTERNS) {
      if (pattern.regex.test(file.name)) {
        formatCounts[pattern.format] = (formatCounts[pattern.format] || 0) + 1
        break
      }
    }
  }
  const dailyNoteFormat = Object.entries(formatCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'YYYY-MM-DD'

  return {
    vaultPath,
    dailyNotes,
    pagesWithContent,
    emptyPages,
    dailyNoteFormat,
    totalFiles: files.length,
    warnings,
  }
}

export async function importVault(
  vaultPath: string,
  options: ImportOptions
): Promise<ImportResult> {
  const analysis = await analyzeVault(vaultPath)
  const result: ImportResult = {
    dailyNotesImported: 0,
    dailyNotesSkipped: 0,
    pagesImported: 0,
    pagesSkipped: 0,
    errors: [],
    summary: '',
  }

  await ensureNotesDirectory()
  await ensurePagesDirectory()

  const notesDir = getNotesDirectory()
  const pagesDir = getPagesDirectory()

  // Import daily notes
  for (const file of analysis.dailyNotes) {
    try {
      const targetPath = path.join(notesDir, `${file.date}.md`)
      const exists = existsSync(targetPath)

      if (exists && !options.overwriteExisting) {
        result.dailyNotesSkipped++
        continue
      }

      let content = await fs.readFile(file.absolutePath, 'utf-8')

      if (options.normalizeTags) {
        content = normalizeWikiLinks(content)
      }

      await fs.writeFile(targetPath, content, 'utf-8')
      result.dailyNotesImported++
    } catch (error) {
      result.errors.push({
        file: file.relativePath,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Import pages with content
  for (const file of analysis.pagesWithContent) {
    try {
      const pageName = normalizeTagName(file.name)
      const targetPath = path.join(pagesDir, `${pageName}.md`)
      const exists = existsSync(targetPath)

      if (exists && !options.overwriteExisting) {
        result.pagesSkipped++
        continue
      }

      let content = await fs.readFile(file.absolutePath, 'utf-8')

      if (options.normalizeTags) {
        content = normalizeWikiLinks(content)
      }

      // Ensure parent directory exists for hierarchical pages
      const dir = path.dirname(targetPath)
      if (!existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true })
      }

      await fs.writeFile(targetPath, content, 'utf-8')
      result.pagesImported++
    } catch (error) {
      result.errors.push({
        file: file.relativePath,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Build summary
  const parts: string[] = []
  if (result.dailyNotesImported > 0) {
    parts.push(`${result.dailyNotesImported} daily notes imported`)
  }
  if (result.dailyNotesSkipped > 0) {
    parts.push(`${result.dailyNotesSkipped} daily notes skipped`)
  }
  if (result.pagesImported > 0) {
    parts.push(`${result.pagesImported} pages imported`)
  }
  if (result.pagesSkipped > 0) {
    parts.push(`${result.pagesSkipped} pages skipped`)
  }
  if (result.errors.length > 0) {
    parts.push(`${result.errors.length} errors`)
  }
  result.summary = parts.join(', ') || 'Nothing to import'

  return result
}
