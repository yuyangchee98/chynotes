import { useEffect, useState, useCallback, useRef } from 'react'
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d'

interface GraphViewProps {
  onTagClick: (tag: string) => void
}

interface GraphNode {
  id: string
  name: string
  val: number
}

interface GraphLink {
  source: string
  target: string
  weight: number
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

export function GraphView({ onTagClick }: GraphViewProps) {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] })
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<ForceGraphMethods | undefined>()

  // Track container size
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // Load graph data
  useEffect(() => {
    async function loadGraph() {
      if (!window.api) return

      const [tags, cooccurrences] = await Promise.all([
        window.api.getAllTags(),
        window.api.getTagCooccurrences(),
      ])

      // Build nodes from tags
      const nodes: GraphNode[] = tags.map(t => ({
        id: t.name,
        name: t.name,
        val: Math.max(t.count, 1), // node size based on usage
      }))

      // Build links from co-occurrences
      const links: GraphLink[] = cooccurrences.map(c => ({
        source: c.tag1,
        target: c.tag2,
        weight: c.weight,
      }))

      setGraphData({ nodes, links })
    }
    loadGraph()
  }, [])

  // Zoom to fit after data loads
  useEffect(() => {
    if (graphData.nodes.length > 0 && graphRef.current) {
      setTimeout(() => {
        graphRef.current?.zoomToFit(400, 50)
      }, 500)
    }
  }, [graphData])

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      onTagClick(node.id)
    },
    [onTagClick]
  )

  // Get CSS variable values for theming
  const getColor = (varName: string): string => {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#888'
  }

  if (graphData.nodes.length === 0) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="text-center" style={{ color: 'var(--text-muted)' }}>
          <svg
            className="w-16 h-16 mx-auto mb-4 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <circle cx="6" cy="6" r="2" strokeWidth="2" />
            <circle cx="18" cy="6" r="2" strokeWidth="2" />
            <circle cx="12" cy="18" r="2" strokeWidth="2" />
            <path strokeWidth="2" d="M6 8v2a4 4 0 004 4h4a4 4 0 004-4V8" />
            <path strokeWidth="2" d="M12 14v2" />
          </svg>
          <p className="text-lg font-medium">No tag connections yet</p>
          <p className="text-sm mt-1">
            Tags will appear here when they co-occur in the same block
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 h-full relative"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* Header */}
      <div
        className="absolute top-0 left-0 right-0 z-10 px-6 py-4"
        style={{ backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border)' }}
      >
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Tag Graph
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {graphData.nodes.length} tags · {graphData.links.length} connections
        </p>
      </div>

      {/* Graph */}
      <div className="absolute inset-0 pt-20">
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          width={dimensions.width}
          height={dimensions.height - 80}
          nodeLabel="name"
          nodeVal="val"
          nodeColor={() => getColor('--accent')}
          linkWidth={(link) => Math.sqrt((link as GraphLink).weight) * 0.5}
          linkColor={() => getColor('--border')}
          onNodeClick={handleNodeClick}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const n = node as GraphNode & { x: number; y: number }
            const label = n.name
            const fontSize = Math.max(12 / globalScale, 3)
            const nodeSize = Math.sqrt(n.val) * 3

            // Draw node
            ctx.beginPath()
            ctx.arc(n.x, n.y, nodeSize, 0, 2 * Math.PI)
            ctx.fillStyle = getColor('--accent')
            ctx.fill()

            // Draw label
            ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`
            ctx.textAlign = 'left'
            ctx.textBaseline = 'middle'
            ctx.fillStyle = getColor('--text-primary')
            ctx.fillText(label, n.x + nodeSize + 4, n.y)
          }}
          nodePointerAreaPaint={(node, color, ctx) => {
            const n = node as GraphNode & { x: number; y: number }
            const nodeSize = Math.sqrt(n.val) * 3
            ctx.beginPath()
            ctx.arc(n.x, n.y, nodeSize + 5, 0, 2 * Math.PI)
            ctx.fillStyle = color
            ctx.fill()
          }}
          cooldownTicks={100}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
        />
      </div>
    </div>
  )
}
