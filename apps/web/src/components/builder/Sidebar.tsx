import { NODE_META, NODE_ORDER } from '@/lib/workflow/nodeMeta'

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
      flexShrink: 0,
    }}>
      <p style={{ color: '#888', fontSize: '11px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
        Drag nodes onto canvas
      </p>
      {NODE_ORDER.map((type) => (
        <div
          key={type}
          draggable
          onDragStart={(e) => onDragStart(e, type)}
          title={NODE_META[type].description}
          style={{
            backgroundColor: NODE_META[type].color,
            color: 'white',
            padding: '10px 14px',
            borderRadius: '8px',
            cursor: 'grab',
            fontSize: '13px',
            fontWeight: '500',
          }}
        >
          {NODE_META[type].icon} {NODE_META[type].label}
        </div>
      ))}
    </div>
  )
}
