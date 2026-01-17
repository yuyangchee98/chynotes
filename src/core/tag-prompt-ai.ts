import { getBlocksWithTagAndChildren, BlockWithChildren } from './database'
import { getSetting } from './database'

const DEFAULT_OLLAMA_ENDPOINT = 'http://localhost:11434'
const DEFAULT_MODEL = 'llama3.2'

const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant analyzing notes from a personal knowledge base.
The user has collected notes tagged with a specific topic. Your job is to analyze these notes and respond according to the user's prompt.

Be concise, insightful, and helpful. Format your response in markdown.`

/**
 * Remove block ID markers from content (e.g., §abc123§)
 */
function cleanContent(content: string): string {
  return content.replace(/\s*§[a-z0-9]+§\s*$/g, '').trim()
}

/**
 * Recursively format a block and its children as indented text
 */
function formatBlockWithChildren(block: BlockWithChildren, indent: number = 0): string {
  const prefix = '  '.repeat(indent)
  const cleanedContent = cleanContent(block.content)
  let result = `${prefix}- ${cleanedContent}\n`

  for (const child of block.children) {
    result += formatBlockWithChildren(child, indent + 1)
  }

  return result
}

/**
 * Build the full prompt for the AI
 */
function buildPrompt(
  tagName: string,
  blocks: BlockWithChildren[],
  userPrompt: string
): string {
  // Group by date for cleaner presentation
  const groupedBlocks: Record<string, BlockWithChildren[]> = {}
  for (const block of blocks) {
    if (!groupedBlocks[block.note_date]) {
      groupedBlocks[block.note_date] = []
    }
    groupedBlocks[block.note_date].push(block)
  }

  let notesText = ''
  for (const [date, dateBlocks] of Object.entries(groupedBlocks).sort((a, b) => b[0].localeCompare(a[0]))) {
    notesText += `\n## ${date}\n`
    for (const block of dateBlocks) {
      notesText += formatBlockWithChildren(block, 0)
    }
  }

  // Count total entries including children
  const countBlocks = (b: BlockWithChildren): number => {
    return 1 + b.children.reduce((sum, child) => sum + countBlocks(child), 0)
  }
  const totalEntries = blocks.reduce((sum, b) => sum + countBlocks(b), 0)

  return `${DEFAULT_SYSTEM_PROMPT}

---

TAG: [[${tagName}]]

USER'S REQUEST:
${userPrompt}

---

NOTES (${totalEntries} entries):
${notesText}

---

Please respond to the user's request based on the notes above.`
}

export interface StreamCallbacks {
  onToken: (token: string) => void
  onComplete: (fullResponse: string) => void
  onError: (error: Error) => void
}

/**
 * Run a tag prompt with streaming response
 */
export async function runTagPromptStreaming(
  tagName: string,
  promptText: string,
  callbacks: StreamCallbacks
): Promise<void> {
  const endpoint = getSetting('ollamaEndpoint') || DEFAULT_OLLAMA_ENDPOINT
  const model = getSetting('ollamaModel') || DEFAULT_MODEL

  // Get all blocks with this tag, including their children
  const blocks = getBlocksWithTagAndChildren(tagName.toLowerCase())

  if (blocks.length === 0) {
    callbacks.onComplete('No notes found with this tag yet.')
    return
  }

  const fullPrompt = buildPrompt(tagName, blocks, promptText)

  // Log the full prompt for debugging
  console.log('\n========== TAG PROMPT AI REQUEST ==========')
  console.log('Tag:', tagName)
  console.log('Blocks count:', blocks.length)
  console.log('Model:', model)
  console.log('Endpoint:', endpoint)
  console.log('\n--- FULL PROMPT ---')
  console.log(fullPrompt)
  console.log('========== END PROMPT ==========\n')

  try {
    const response = await fetch(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt: fullPrompt,
        stream: true,
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

    if (!response.body) {
      throw new Error('No response body')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let fullResponse = ''

    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      const chunk = decoder.decode(value, { stream: true })

      // Ollama streams newline-delimited JSON
      const lines = chunk.split('\n').filter(line => line.trim())

      for (const line of lines) {
        try {
          const data = JSON.parse(line) as { response?: string; done?: boolean }

          if (data.response) {
            fullResponse += data.response
            callbacks.onToken(data.response)
          }
        } catch {
          // Ignore parse errors for incomplete JSON
        }
      }
    }

    callbacks.onComplete(fullResponse)
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error(String(err)))
  }
}

/**
 * Run a tag prompt and return full response (non-streaming)
 */
export async function runTagPrompt(tagName: string, promptText: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let result = ''

    runTagPromptStreaming(tagName, promptText, {
      onToken: () => {},
      onComplete: (response) => {
        result = response
        resolve(result)
      },
      onError: (error) => {
        reject(error)
      },
    })
  })
}
