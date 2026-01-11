/**
 * Frequency Index for Phase 2 Tag Suggestions
 *
 * Tracks untagged terms that appear repeatedly across notes:
 * - Proper nouns (capitalized words not at line start)
 * - Multi-word proper nouns ("New York", "Code Review")
 *
 * Used to suggest tags for terms that appear in multiple notes
 * but haven't been tagged yet.
 */

import {
  upsertTermFrequency,
  clearTermFrequency,
  getTermFrequency,
  getFrequentTerms,
  TermFrequency,
  getTagByName
} from './database'
import { listAllNotes, readNote, formatDateForFileName } from './file-manager'

// ============================================================================
// Types
// ============================================================================

interface TermOccurrence {
  term: string           // normalized: "sarah"
  originalForm: string   // "Sarah"
  noteDate: string       // "2025-01-03"
}

interface TermAggregation {
  term: string
  originalForms: Set<string>
  notes: Set<string>
  totalCount: number
}

// ============================================================================
// Text Extraction
// ============================================================================

/**
 * Check if a position is inside [[tag]] brackets
 */
function isInsideTag(text: string, start: number, end: number): boolean {
  const tagPattern = /\[\[[\w\-\/]+\]\]/g
  let match

  while ((match = tagPattern.exec(text)) !== null) {
    const tagStart = match.index
    const tagEnd = match.index + match[0].length
    if (start < tagEnd && end > tagStart) {
      return true
    }
  }
  return false
}

/**
 * Check if word is at the start of a line (after bullet/whitespace)
 */
function isAtLineStart(line: string, wordStart: number): boolean {
  // Get text before the word
  const before = line.substring(0, wordStart)
  // Check if it's only whitespace and bullet markers
  return /^[\s\-\*\d\.]*$/.test(before)
}

/**
 * Extract proper nouns from a line of text
 * Returns words that are capitalized but not at line start
 */
function extractProperNouns(line: string, noteDate: string): TermOccurrence[] {
  const occurrences: TermOccurrence[] = []

  // Match capitalized words (not all caps, has lowercase)
  const wordPattern = /[A-Z][a-z]+/g
  let match

  while ((match = wordPattern.exec(line)) !== null) {
    const word = match[0]
    const start = match.index

    // Skip if at line start (could be grammar capitalization)
    if (isAtLineStart(line, start)) continue

    // Skip if inside [[tag]]
    if (isInsideTag(line, start, start + word.length)) continue

    // Skip common words that are often capitalized incorrectly
    const skipWords = new Set(['I', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
      'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'])
    if (skipWords.has(word)) continue

    // Skip very short words
    if (word.length < 3) continue

    occurrences.push({
      term: word.toLowerCase(),
      originalForm: word,
      noteDate
    })
  }

  return occurrences
}

/**
 * Extract multi-word proper nouns (e.g., "New York", "Code Review")
 * Only capitalized sequences
 */
function extractProperNounPhrases(line: string, noteDate: string): TermOccurrence[] {
  const occurrences: TermOccurrence[] = []

  // Match 2-3 capitalized word sequences
  const phrasePattern = /[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}/g
  let match

  while ((match = phrasePattern.exec(line)) !== null) {
    const phrase = match[0]
    const start = match.index

    // Skip if at line start
    if (isAtLineStart(line, start)) continue

    // Skip if inside [[tag]]
    if (isInsideTag(line, start, start + phrase.length)) continue

    // Convert to tag format: "New York" -> "new-york"
    const normalized = phrase.toLowerCase().replace(/\s+/g, '-')

    occurrences.push({
      term: normalized,
      originalForm: phrase,
      noteDate
    })
  }

  return occurrences
}

/**
 * Extract all terms from a note's content
 */
function extractTermsFromNote(content: string, noteDate: string): TermOccurrence[] {
  const lines = content.split('\n')
  const occurrences: TermOccurrence[] = []

  for (const line of lines) {
    // Extract single proper nouns
    occurrences.push(...extractProperNouns(line, noteDate))

    // Extract multi-word proper nouns
    occurrences.push(...extractProperNounPhrases(line, noteDate))
  }

  return occurrences
}

// ============================================================================
// Index Building
// ============================================================================

/**
 * Aggregate occurrences into term frequency data
 */
function aggregateOccurrences(occurrences: TermOccurrence[]): Map<string, TermAggregation> {
  const aggregations = new Map<string, TermAggregation>()

  for (const occ of occurrences) {
    let agg = aggregations.get(occ.term)
    if (!agg) {
      agg = {
        term: occ.term,
        originalForms: new Set(),
        notes: new Set(),
        totalCount: 0
      }
      aggregations.set(occ.term, agg)
    }

    agg.originalForms.add(occ.originalForm)
    agg.notes.add(occ.noteDate)
    agg.totalCount++
  }

  return aggregations
}

/**
 * Build the complete frequency index from all notes
 * Called on app startup
 */
export async function buildFrequencyIndex(): Promise<void> {

  // Clear existing data
  clearTermFrequency()

  // Get all notes (returns Date[])
  const noteDateObjs = await listAllNotes()
  const allOccurrences: TermOccurrence[] = []

  for (const dateObj of noteDateObjs) {
    const noteDate = formatDateForFileName(dateObj)
    const content = await readNote(dateObj)
    if (content) {
      const occurrences = extractTermsFromNote(content, noteDate)
      allOccurrences.push(...occurrences)
    }
  }

  // Aggregate and filter
  const aggregations = aggregateOccurrences(allOccurrences)

  // Save to database (only terms appearing in 2+ notes)
  let savedCount = 0
  for (const agg of aggregations.values()) {
    if (agg.notes.size >= 2) {
      // Skip if this term is already an existing tag
      const existingTag = getTagByName(agg.term)
      if (existingTag) continue

      upsertTermFrequency(
        agg.term,
        Array.from(agg.originalForms),
        agg.notes.size,
        agg.totalCount,
        Array.from(agg.notes)
      )
      savedCount++
    }
  }
}

/**
 * Update frequency index for a single note (incremental update)
 * Called after saving a note
 */
export function updateFrequencyIndexForNote(noteDate: string, content: string): void {
  // Extract terms from this note
  const noteOccurrences = extractTermsFromNote(content, noteDate)

  // Get all existing frequency data
  const existingTerms = getFrequentTerms(1) // Get all, even with noteCount=1

  // Create a map for quick lookup
  const termMap = new Map<string, TermFrequency>()
  for (const tf of existingTerms) {
    termMap.set(tf.term, tf)
  }

  // Track which terms appear in this note
  const noteTerms = new Map<string, { originalForms: Set<string>, count: number }>()
  for (const occ of noteOccurrences) {
    let entry = noteTerms.get(occ.term)
    if (!entry) {
      entry = { originalForms: new Set(), count: 0 }
      noteTerms.set(occ.term, entry)
    }
    entry.originalForms.add(occ.originalForm)
    entry.count++
  }

  // Update existing terms
  for (const [term, existing] of termMap) {
    const noteEntry = noteTerms.get(term)
    const wasInNote = existing.notes.includes(noteDate)

    if (noteEntry && !wasInNote) {
      // Term now appears in this note (wasn't before)
      const newNotes = [...existing.notes, noteDate]
      const newForms = Array.from(new Set([...existing.originalForms, ...noteEntry.originalForms]))
      upsertTermFrequency(term, newForms, newNotes.length, existing.totalCount + noteEntry.count, newNotes)
    } else if (!noteEntry && wasInNote) {
      // Term no longer appears in this note
      const newNotes = existing.notes.filter(n => n !== noteDate)
      if (newNotes.length === 0) {
        // No longer appears anywhere - but we keep it for potential future use
        // Could delete here if we want stricter cleanup
      } else {
        upsertTermFrequency(term, existing.originalForms, newNotes.length, existing.totalCount, newNotes)
      }
    } else if (noteEntry && wasInNote) {
      // Term still in note, might have different count/forms
      const newForms = Array.from(new Set([...existing.originalForms, ...noteEntry.originalForms]))
      upsertTermFrequency(term, newForms, existing.noteCount, existing.totalCount, existing.notes)
    }
  }

  // Add new terms (not in existing index)
  for (const [term, entry] of noteTerms) {
    if (!termMap.has(term)) {
      // Skip if this term is already an existing tag
      const existingTag = getTagByName(term)
      if (existingTag) continue

      // New term, add with noteCount=1
      upsertTermFrequency(term, Array.from(entry.originalForms), 1, entry.count, [noteDate])
    }
  }
}

// ============================================================================
// Query Functions (used by tag-suggester)
// ============================================================================

/**
 * Get frequency data for a specific term
 */
export function queryTermFrequency(term: string): TermFrequency | null {
  return getTermFrequency(term.toLowerCase())
}

/**
 * Get all frequent terms (noteCount >= 2)
 */
export function queryFrequentTerms(): TermFrequency[] {
  return getFrequentTerms(2)
}

/**
 * Check if a term appears frequently (in 2+ notes)
 */
export function isFrequentTerm(term: string): boolean {
  const freq = getTermFrequency(term.toLowerCase())
  return freq !== null && freq.noteCount >= 2
}
