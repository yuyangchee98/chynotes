import * as crypto from 'crypto'
import { getOccurrencesForTag, TagOccurrenceWithDetails } from './database'
import { getPromptForTag } from './prompt-manager'
import { getCachedCode, setCachedCode, getOrCreateTag } from './database'
import { getSetting } from './database'

/**
 * Ollama API endpoint (default)
 */
const DEFAULT_OLLAMA_ENDPOINT = 'http://localhost:11434'
const DEFAULT_MODEL = 'llama3.2'

/**
 * System prompt for code generation
 */
const SYSTEM_PROMPT = `You are a code generator for a notes app called chynotes. Your job is to generate a React component that displays notes data based on a user's prompt.

IMPORTANT RULES:
1. Output ONLY the React component code - no markdown, no explanations, no code fences
2. The component must be a default export: export default function TagView({ notes, onUpdateLine }) { ... }
3. Use only inline Tailwind CSS classes for styling
4. The component receives:
   - "notes" prop: array of objects with { date: string, line: number, content: string }
   - "onUpdateLine" prop: function(date, line, newContent) to update a line in the note
5. Make the component interactive where appropriate (checkboxes, expandable sections, etc.)
6. Use React hooks (useState, useMemo) if needed - they are available
7. Keep it simple and focused on the user's request
8. Use clean, modern UI patterns similar to Notion or Obsidian

The onUpdateLine callback allows you to modify the source note. For example, to toggle a checkbox:
  onUpdateLine(note.date, note.line, note.content.replace('[ ]', '[x]'))

Example component structure:
export default function TagView({ notes, onUpdateLine }) {
  const [state, setState] = useState(initialValue);

  return (
    <div className="space-y-4">
      {notes.map((note, i) => (
        <div key={i} className="p-3 bg-gray-50 rounded-lg">
          <p>{note.content}</p>
          <span className="text-sm text-gray-500">{note.date}</span>
        </div>
      ))}
    </div>
  );
}`

/**
 * Build the full prompt for the AI
 */
function buildPrompt(tagName: string, occurrences: TagOccurrenceWithDetails[], userPrompt: string): string {
  const notesData = occurrences.map(occ => ({
    date: occ.date,
    line: occ.line,
    content: occ.content,
  }))

  return `${SYSTEM_PROMPT}

TAG: #${tagName}

USER'S REQUEST:
${userPrompt}

NOTES DATA (${occurrences.length} items):
${JSON.stringify(notesData, null, 2)}

Generate a React component that fulfills the user's request. Output ONLY the component code, nothing else.`
}

/**
 * Compute hash for cache key
 */
function computeCacheHash(tagName: string, occurrences: TagOccurrenceWithDetails[], prompt: string): string {
  const data = JSON.stringify({ tagName, occurrences, prompt })
  return crypto.createHash('md5').update(data).digest('hex')
}

/**
 * Call Ollama API to generate code
 */
async function callOllama(prompt: string): Promise<string> {
  const endpoint = getSetting('ollamaEndpoint') || DEFAULT_OLLAMA_ENDPOINT
  const model = getSetting('ollamaModel') || DEFAULT_MODEL

  const response = await fetch(`${endpoint}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        temperature: 0.7,
        num_predict: 2048,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Ollama API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json() as { response?: string }
  return data.response || ''
}

/**
 * Clean up the generated code
 * Remove markdown code fences if present, extract just the component
 */
function cleanGeneratedCode(code: string): string {
  let cleaned = code.trim()

  // Remove markdown code fences
  if (cleaned.startsWith('```')) {
    const lines = cleaned.split('\n')
    // Remove first line (```jsx or ```typescript etc)
    lines.shift()
    // Remove last line if it's just ```
    if (lines[lines.length - 1]?.trim() === '```') {
      lines.pop()
    }
    cleaned = lines.join('\n')
  }

  // Ensure it has a default export
  if (!cleaned.includes('export default')) {
    // Try to find function declaration and add export
    cleaned = cleaned.replace(
      /^function\s+(\w+)/m,
      'export default function $1'
    )
  }

  return cleaned.trim()
}

/**
 * Generate code for a tag page
 * Uses cache if available and content hasn't changed
 */
export async function generateTagPageCode(tagName: string): Promise<string> {
  // Get occurrences for this tag
  const occurrences = getOccurrencesForTag(tagName)

  if (occurrences.length === 0) {
    return `export default function TagView({ notes }) {
  return (
    <div className="text-gray-500 text-center py-8">
      No notes found with this tag.
    </div>
  );
}`
  }

  // Get the prompt for this tag
  const userPrompt = getPromptForTag(tagName)

  // Check cache
  const cacheHash = computeCacheHash(tagName, occurrences, userPrompt)
  const tag = getOrCreateTag(tagName)
  const cachedCode = getCachedCode(tag.id, cacheHash)

  if (cachedCode) {
    return cachedCode
  }

  // Generate new code
  const fullPrompt = buildPrompt(tagName, occurrences, userPrompt)
  const rawCode = await callOllama(fullPrompt)
  const cleanedCode = cleanGeneratedCode(rawCode)

  // Cache the result
  setCachedCode(tag.id, cacheHash, cleanedCode)

  return cleanedCode
}

/**
 * Check if Ollama is available
 */
export async function checkOllamaConnection(): Promise<{ ok: boolean; error?: string; models?: string[] }> {
  const endpoint = getSetting('ollamaEndpoint') || DEFAULT_OLLAMA_ENDPOINT

  try {
    const response = await fetch(`${endpoint}/api/tags`)

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` }
    }

    const data = await response.json() as { models?: { name: string }[] }
    const models = data.models?.map((m) => m.name) || []

    return { ok: true, models }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

/**
 * List available Ollama models
 */
export async function listOllamaModels(): Promise<string[]> {
  const result = await checkOllamaConnection()
  return result.models || []
}
