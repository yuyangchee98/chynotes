import { getBlocksWithTagAndChildren, BlockWithChildren } from './database'
import { getSetting } from './database'

const DEFAULT_OLLAMA_ENDPOINT = 'http://localhost:11434'
const DEFAULT_MODEL = 'llama3.2'

const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant analyzing notes from a personal knowledge base.
The user has collected notes tagged with a specific topic. Your job is to analyze these notes and respond according to the user's prompt.

Be concise, insightful, and helpful. Format your response in markdown.`

/**
 * Build the full prompt for the AI
 */
function buildPrompt(
  tagName: string,
  occurrences: TagOccurrenceWithDetails[],
  userPrompt: string
): string {
  const notesData = occurrences.map(occ => ({
    date: occ.date,
    content: occ.content,
  }))

  // Group by date for cleaner presentation
  const groupedNotes: Record<string, string[]> = {}
  for (const note of notesData) {
    if (!groupedNotes[note.date]) {
      groupedNotes[note.date] = []
    }
    groupedNotes[note.date].push(note.content)
  }

  let notesText = ''
  for (const [date, contents] of Object.entries(groupedNotes).sort((a, b) => b[0].localeCompare(a[0]))) {
    notesText += `\n## ${date}\n`
    for (const content of contents) {
      notesText += `- ${content}\n`
    }
  }

  return `${DEFAULT_SYSTEM_PROMPT}

---

TAG: [[${tagName}]]

USER'S REQUEST:
${userPrompt}

---

NOTES (${occurrences.length} entries):
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

  // Get all occurrences for this tag
  const occurrences = getOccurrencesForTag(tagName.toLowerCase())

  if (occurrences.length === 0) {
    callbacks.onComplete('No notes found with this tag yet.')
    return
  }

  const fullPrompt = buildPrompt(tagName, occurrences, promptText)

  // Log the full prompt for debugging
  console.log('\n========== TAG PROMPT AI REQUEST ==========')
  console.log('Tag:', tagName)
  console.log('Occurrences count:', occurrences.length)
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
