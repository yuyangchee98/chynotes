import {
  getSetting,
  getBlocksWithTag,
  getBlockEmbeddings,
  findSimilarBlocksKNN,
  getBlockById,
  getBlockTags,
  getTagsWithCounts,
  BlockRecord,
  EMBEDDING_DIMENSION,
} from './database'

/**
 * Default Ollama settings
 */
const DEFAULT_OLLAMA_ENDPOINT = 'http://localhost:11434'
const DEFAULT_EMBEDDING_MODEL = 'mxbai-embed-large'

/**
 * Response from Ollama /api/embed endpoint
 */
interface OllamaEmbedResponse {
  embeddings: number[][]
}

/**
 * Generate embedding for a single text using Ollama
 */
export async function generateEmbedding(text: string): Promise<Float32Array> {
  const endpoint = getSetting('ollamaEndpoint') || DEFAULT_OLLAMA_ENDPOINT
  const model = getSetting('embeddingModel') || DEFAULT_EMBEDDING_MODEL

  const response = await fetch(`${endpoint}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      input: text,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Ollama embed error: ${response.status} - ${errorText}`)
  }

  const data = (await response.json()) as OllamaEmbedResponse

  if (!data.embeddings || data.embeddings.length === 0) {
    throw new Error('No embeddings returned from Ollama')
  }

  return new Float32Array(data.embeddings[0])
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<Float32Array[]> {
  if (texts.length === 0) return []

  const endpoint = getSetting('ollamaEndpoint') || DEFAULT_OLLAMA_ENDPOINT
  const model = getSetting('embeddingModel') || DEFAULT_EMBEDDING_MODEL

  const response = await fetch(`${endpoint}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      input: texts,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Ollama embed error: ${response.status} - ${errorText}`)
  }

  const data = (await response.json()) as OllamaEmbedResponse

  if (!data.embeddings || data.embeddings.length !== texts.length) {
    throw new Error(`Expected ${texts.length} embeddings, got ${data.embeddings?.length ?? 0}`)
  }

  return data.embeddings.map((emb) => new Float32Array(emb))
}

/**
 * Compute centroid (average) of multiple embeddings
 */
export function computeCentroid(embeddings: Float32Array[]): Float32Array {
  if (embeddings.length === 0) {
    throw new Error('Cannot compute centroid of empty array')
  }

  const dim = embeddings[0].length
  const centroid = new Float32Array(dim)

  // Sum all embeddings
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += emb[i]
    }
  }

  // Divide by count
  for (let i = 0; i < dim; i++) {
    centroid[i] /= embeddings.length
  }

  // Normalize (for cosine similarity)
  let norm = 0
  for (let i = 0; i < dim; i++) {
    norm += centroid[i] * centroid[i]
  }
  norm = Math.sqrt(norm)
  if (norm > 0) {
    for (let i = 0; i < dim; i++) {
      centroid[i] /= norm
    }
  }

  return centroid
}

/**
 * Result from semantic similarity search
 */
export interface SemanticResult {
  block_id: string
  note_date: string
  content: string
  distance: number
  similarity: number // 1 - distance for cosine
}

/**
 * Find blocks semantically similar to a tag's content
 *
 * How it works:
 * 1. Get all blocks explicitly tagged with tagName
 * 2. Get their embeddings and compute centroid
 * 3. Find blocks with similar embeddings
 * 4. Exclude already-tagged blocks
 * 5. Return results with similarity scores
 */
export async function findSemanticallySimilar(
  tagName: string,
  limit: number = 20
): Promise<SemanticResult[]> {
  // 1. Get all blocks tagged with this tag
  const taggedBlocks = getBlocksWithTag(tagName)
  if (taggedBlocks.length === 0) {
    return []
  }

  // 2. Get their embeddings
  const blockIds = taggedBlocks.map((b) => b.id)
  const embeddingsMap = getBlockEmbeddings(blockIds)

  // Only use blocks that have embeddings
  const embeddings = blockIds
    .map((id) => embeddingsMap.get(id))
    .filter((e): e is Float32Array => e !== undefined)

  if (embeddings.length === 0) {
    return []
  }

  // 3. Compute centroid
  const centroid = computeCentroid(embeddings)

  // 4. Query for similar blocks
  // Request more than limit to account for filtering out already-tagged blocks
  const taggedIdSet = new Set(blockIds)
  const knnResults = findSimilarBlocksKNN(centroid, limit + taggedBlocks.length)

  // 5. Filter out already-tagged blocks and hydrate with block details
  const results: SemanticResult[] = []

  for (const result of knnResults) {
    if (taggedIdSet.has(result.block_id)) {
      continue // Skip already-tagged blocks
    }

    const block = getBlockById(result.block_id)
    if (!block) {
      continue // Block was deleted
    }

    results.push({
      block_id: result.block_id,
      note_date: block.note_date,
      content: block.content,
      distance: result.distance,
      similarity: 1 - result.distance, // Convert distance to similarity for cosine
    })

    if (results.length >= limit) {
      break
    }
  }

  return results
}

/**
 * Check if an embedding model is available in Ollama
 */
export async function checkEmbeddingModelAvailable(): Promise<{
  available: boolean
  model: string
  error?: string
}> {
  const endpoint = getSetting('ollamaEndpoint') || DEFAULT_OLLAMA_ENDPOINT
  const model = getSetting('embeddingModel') || DEFAULT_EMBEDDING_MODEL

  try {
    // Try to generate a test embedding
    const response = await fetch(`${endpoint}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        input: 'test',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        available: false,
        model,
        error: `HTTP ${response.status}: ${errorText}`,
      }
    }

    const data = (await response.json()) as OllamaEmbedResponse

    if (!data.embeddings || data.embeddings.length === 0) {
      return {
        available: false,
        model,
        error: 'No embeddings returned',
      }
    }

    // Check dimension matches expected
    const actualDim = data.embeddings[0].length
    if (actualDim !== EMBEDDING_DIMENSION) {
      return {
        available: false,
        model,
        error: `Dimension mismatch: expected ${EMBEDDING_DIMENSION}, got ${actualDim}`,
      }
    }

    return { available: true, model }
  } catch (err) {
    return {
      available: false,
      model,
      error: (err as Error).message,
    }
  }
}

/**
 * List embedding-capable models from Ollama
 */
export async function listEmbeddingModels(): Promise<string[]> {
  const endpoint = getSetting('ollamaEndpoint') || DEFAULT_OLLAMA_ENDPOINT

  try {
    const response = await fetch(`${endpoint}/api/tags`)
    if (!response.ok) {
      return []
    }

    const data = (await response.json()) as { models?: { name: string }[] }

    // Filter for known embedding models
    // These are models that support the /api/embed endpoint
    const embeddingModelPatterns = [
      'nomic-embed',
      'mxbai-embed',
      'all-minilm',
      'bge-',
      'e5-',
      'gte-',
      'instructor',
      'jina-embeddings',
    ]

    return (data.models || [])
      .map((m) => m.name)
      .filter((name) =>
        embeddingModelPatterns.some((pattern) =>
          name.toLowerCase().includes(pattern.toLowerCase())
        )
      )
  } catch {
    return []
  }
}

/**
 * Semantic tag connection (tags related by embedding similarity)
 */
export interface SemanticTagConnection {
  tag1: string
  tag2: string
  similarity: number
}

/**
 * Find semantic connections between tags based on embedding similarity.
 *
 * For each tag:
 * 1. Get blocks with that tag
 * 2. Compute centroid of their embeddings
 * 3. Find similar blocks via KNN
 * 4. Get tags from those similar blocks
 * 5. Aggregate into tag-to-tag connections
 *
 * Returns pairs of tags with similarity scores (excluding co-occurrence pairs
 * which are already shown as explicit edges).
 */
export function getSemanticTagConnections(
  cooccurrencePairs: Set<string>,
  minSimilarity: number = 0.7,
  limit: number = 20
): SemanticTagConnection[] {
  const allTags = getTagsWithCounts()
  if (allTags.length === 0) return []

  // Map to accumulate tag-to-tag similarities
  const connectionMap = new Map<string, number>()

  for (const tag of allTags) {
    // Get blocks for this tag
    const blocks = getBlocksWithTag(tag.name)
    if (blocks.length === 0) continue

    // Get embeddings for these blocks
    const blockIds = blocks.map((b) => b.id)
    const embeddingsMap = getBlockEmbeddings(blockIds)

    const embeddings = blockIds
      .map((id) => embeddingsMap.get(id))
      .filter((e): e is Float32Array => e !== undefined)

    if (embeddings.length === 0) continue

    // Compute centroid
    const centroid = computeCentroid(embeddings)

    // Find similar blocks (more than we need to account for same-tag blocks)
    const similar = findSimilarBlocksKNN(centroid, 30)

    // For each similar block, get its tags
    for (const result of similar) {
      // Skip if too dissimilar
      const similarity = 1 - result.distance
      if (similarity < minSimilarity) continue

      // Get tags from this similar block
      const blockTags = getBlockTags(result.block_id)

      for (const otherTag of blockTags) {
        // Skip self-connections
        if (otherTag === tag.name) continue

        // Create ordered key for the pair
        const [t1, t2] = tag.name < otherTag ? [tag.name, otherTag] : [otherTag, tag.name]
        const key = `${t1}|${t2}`

        // Skip if this is already a co-occurrence pair
        if (cooccurrencePairs.has(key)) continue

        // Accumulate similarity (take max if seen before)
        const existing = connectionMap.get(key) || 0
        connectionMap.set(key, Math.max(existing, similarity))
      }
    }
  }

  // Convert to array and sort by similarity
  const connections: SemanticTagConnection[] = []
  for (const [key, similarity] of connectionMap) {
    const [tag1, tag2] = key.split('|')
    connections.push({ tag1, tag2, similarity })
  }

  connections.sort((a, b) => b.similarity - a.similarity)

  return connections.slice(0, limit)
}
