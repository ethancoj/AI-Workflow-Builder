import { NODE_META, NODE_ORDER } from '@/lib/workflow/nodeMeta'

/** Palette of node types to drag onto the canvas. */
export default function Sidebar() {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <aside className="hidden w-56 shrink-0 flex-col gap-2 overflow-y-auto border-r border-line bg-surface p-4 sm:flex">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Add a step</h2>
      <p className="mb-1 text-xs text-muted">Drag onto the canvas.</p>
      {NODE_ORDER.map((type) => {
        const meta = NODE_META[type]
        return (
          <div
            key={type}
            draggable
            onDragStart={(e) => onDragStart(e, type)}
            title={meta.description}
            className="group flex cursor-grab items-center gap-2.5 rounded-[10px] border border-line bg-surface px-3 py-2.5 transition-[background-color,box-shadow] duration-150 hover:bg-brand-soft hover:shadow-sm active:cursor-grabbing"
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm text-white transition-transform duration-150 ease-out group-hover:-translate-y-0.5 group-hover:scale-105 motion-reduce:transform-none"
              style={{ backgroundColor: meta.color }}
              aria-hidden
            >
              {meta.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">{meta.label}</span>
              <span className="block truncate text-xs text-muted">{meta.description}</span>
            </span>
          </div>
        )
      })}
    </aside>
  )
}
