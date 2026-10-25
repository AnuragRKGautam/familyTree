import { useState } from 'react'

interface ChildrenOrderListProps {
  childIds: string[]
  personLabel: (id: string) => string
  birthDateLabel?: (id: string) => string | null
  disabled?: boolean
  onReorder: (orderedIds: string[]) => void | Promise<void>
  onRemove: (id: string) => void
}

/**
 * Drag-and-drop (or move up/down) list to set left→right sibling order on the chart.
 */
export function ChildrenOrderList({
  childIds,
  personLabel,
  birthDateLabel,
  disabled = false,
  onReorder,
  onRemove,
}: ChildrenOrderListProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (childIds.length === 0) {
    return <p className="muted">None linked yet.</p>
  }

  async function commit(next: string[]) {
    setSaving(true)
    try {
      await onReorder(next)
    } finally {
      setSaving(false)
    }
  }

  function move(id: string, direction: -1 | 1) {
    const index = childIds.indexOf(id)
    if (index < 0) return
    const target = index + direction
    if (target < 0 || target >= childIds.length) return
    const next = [...childIds]
    const [item] = next.splice(index, 1)
    if (!item) return
    next.splice(target, 0, item)
    void commit(next)
  }

  function onDrop(targetId: string) {
    if (!draggingId || draggingId === targetId || disabled || saving) return
    const from = childIds.indexOf(draggingId)
    const to = childIds.indexOf(targetId)
    setDraggingId(null)
    if (from < 0 || to < 0) return
    const next = [...childIds]
    const [item] = next.splice(from, 1)
    if (!item) return
    next.splice(to, 0, item)
    void commit(next)
  }

  return (
    <div className="children-order">
      <p className="muted small">
        Use ↑ ↓ to reorder (drag also works on desktop). Leftmost on this list is leftmost on the
        chart.
      </p>
      <ol className="children-order-list">
        {childIds.map((id, index) => {
          const birth = birthDateLabel?.(id)
          return (
            <li
              key={id}
              className={`children-order-item${draggingId === id ? ' is-dragging' : ''}`}
              draggable={!disabled && !saving}
              onDragStart={() => setDraggingId(id)}
              onDragEnd={() => setDraggingId(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(id)}
            >
              <span className="children-order-handle" aria-hidden="true" title="Drag to reorder">
                ⋮⋮
              </span>
              <span className="children-order-index">{index + 1}.</span>
              <span className="children-order-name">
                {personLabel(id)}
                {birth ? <span className="muted"> · {birth}</span> : (
                  <span className="muted"> · no birth date</span>
                )}
              </span>
              <span className="children-order-actions">
                <button
                  type="button"
                  className="linkish"
                  disabled={disabled || saving || index === 0}
                  onClick={() => move(id, -1)}
                  title="Move left / earlier"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="linkish"
                  disabled={disabled || saving || index === childIds.length - 1}
                  onClick={() => move(id, 1)}
                  title="Move right / later"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="linkish"
                  disabled={disabled || saving}
                  onClick={() => onRemove(id)}
                >
                  Remove
                </button>
              </span>
            </li>
          )
        })}
      </ol>
      {saving ? <p className="muted small">Saving order…</p> : null}
    </div>
  )
}
