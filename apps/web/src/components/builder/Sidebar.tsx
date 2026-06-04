const nodeTypes = [
  { type: 'start', label: '▶ Start', color: '#16a34a' },
  { type: 'llm', label: '🤖 LLM Response', color: '#2563eb' },
  { type: 'condition', label: '🔀 Condition', color: '#d97706' },
  { type: 'quote', label: '📷 Quote', color: '#7c3aed' },
  { type: 'end', label: '⏹ End', color: '#dc2626' },
]

export default function Sidebar() {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div style={{
      width: '220px',
      height: '100vh',
      backgroundColor: '#1e1e1e',
      padding: '20px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      <p style={{ color: '#888', fontSize: '11px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
        Drag nodes onto canvas
      </p>
      {nodeTypes.map((node) => (
        <div
          key={node.type}
          draggable
          onDragStart={(e) => onDragStart(e, node.type)}
          style={{
            backgroundColor: node.color,
            color: 'white',
            padding: '10px 14px',
            borderRadius: '8px',
            cursor: 'grab',
            fontSize: '13px',
            fontWeight: '500',
          }}
        >
          {node.label}
        </div>
      ))}
    </div>
  )
}