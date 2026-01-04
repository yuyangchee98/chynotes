/**
 * Block Parser
 *
 * Parses markdown bullet content into a tree of blocks with stable IDs.
 * Each block has a unique §id§ suffix that persists across edits.
 */

import { randomBytes } from 'crypto'

// Block ID pattern: §alphanumeric with - and _§ (base64url characters)
const BLOCK_ID_PATTERN = /§([a-z0-9_-]+)§\s*$/

// Bullet line pattern: optional indent + "- " + content
const BULLET_PATTERN = /^(\s*)-\s+(.*)$/

export interface Block {
  id: string              // Unique block identifier
  content: string         // Text content (without §id§)
  rawContent: string      // Original line content (with §id§ if present)
  indentLevel: number     // 0 = root, 1 = first indent, etc.
  children: Block[]       // Nested child blocks
  line: number            // 1-based line number
  parent: Block | null    // Parent block reference
}

export interface ParsedBlocks {
  blocks: Block[]         // Top-level blocks (forest)
  allBlocks: Block[]      // Flat list of all blocks
  blockMap: Map<string, Block>  // Quick lookup by ID
}

/**
 * Generate a new block ID (8 chars, hex - only 0-9 and a-f)
 * Uses Node's built-in crypto module - no external dependencies
 */
export function generateBlockId(): string {
  return randomBytes(4).toString('hex')
}

/**
 * Extract block ID from line content, if present
 */
export function extractBlockId(content: string): { id: string | null; contentWithoutId: string } {
  const match = content.match(BLOCK_ID_PATTERN)
  if (match) {
    return {
      id: match[1],
      contentWithoutId: content.replace(BLOCK_ID_PATTERN, '').trimEnd()
    }
  }
  return { id: null, contentWithoutId: content }
}

/**
 * Add block ID to content
 */
export function addBlockId(content: string, id: string): string {
  // Remove any existing ID first
  const { contentWithoutId } = extractBlockId(content)
  return `${contentWithoutId} §${id}§`
}

/**
 * Parse markdown content into block tree
 */
export function parseBlocks(content: string): ParsedBlocks {
  const lines = content.split('\n')
  const blocks: Block[] = []
  const allBlocks: Block[] = []
  const blockMap = new Map<string, Block>()

  // Stack to track parent blocks at each indent level
  const stack: Block[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNumber = i + 1

    const bulletMatch = line.match(BULLET_PATTERN)
    if (!bulletMatch) {
      // Non-bullet line - skip for now
      // TODO: Handle continuation lines (content under a bullet)
      continue
    }

    const [, indent, bulletContent] = bulletMatch
    const indentLevel = Math.floor(indent.length / 2) // 2 spaces per level

    // Extract or generate ID
    const { id: existingId, contentWithoutId } = extractBlockId(bulletContent)
    const id = existingId || generateBlockId()

    const block: Block = {
      id,
      content: contentWithoutId,
      rawContent: line,
      indentLevel,
      children: [],
      line: lineNumber,
      parent: null
    }

    // Find parent based on indent level
    while (stack.length > 0 && stack[stack.length - 1].indentLevel >= indentLevel) {
      stack.pop()
    }

    if (stack.length > 0) {
      const parent = stack[stack.length - 1]
      block.parent = parent
      parent.children.push(block)
    } else {
      blocks.push(block)
    }

    stack.push(block)
    allBlocks.push(block)
    blockMap.set(id, block)
  }

  return { blocks, allBlocks, blockMap }
}

/**
 * Serialize blocks back to markdown with IDs
 */
export function serializeBlocks(content: string): string {
  const lines = content.split('\n')
  const result: string[] = []

  for (const line of lines) {
    const bulletMatch = line.match(BULLET_PATTERN)

    if (bulletMatch) {
      const [, indent, bulletContent] = bulletMatch
      const { id: existingId, contentWithoutId } = extractBlockId(bulletContent)

      // Generate ID if missing
      const id = existingId || generateBlockId()

      // Reconstruct line with ID
      result.push(`${indent}- ${contentWithoutId} §${id}§`)
    } else {
      // Keep non-bullet lines as-is
      result.push(line)
    }
  }

  return result.join('\n')
}

/**
 * Check if content has any blocks without IDs
 */
export function hasBlocksWithoutIds(content: string): boolean {
  const lines = content.split('\n')

  for (const line of lines) {
    const bulletMatch = line.match(BULLET_PATTERN)
    if (bulletMatch) {
      const [, , bulletContent] = bulletMatch
      const { id } = extractBlockId(bulletContent)
      if (!id) return true
    }
  }

  return false
}

/**
 * Get block by ID from content
 */
export function getBlockById(content: string, blockId: string): Block | null {
  const { blockMap } = parseBlocks(content)
  return blockMap.get(blockId) || null
}
