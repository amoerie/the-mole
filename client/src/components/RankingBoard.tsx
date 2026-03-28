import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Contestant } from '../types'
import ContestantCard from './ContestantCard'

interface RankingBoardProps {
  contestants: Contestant[]
  initialOrder?: string[]
  onSubmit: (orderedIds: string[]) => void
  disabled?: boolean
}

function SortableItem({
  contestant,
  rank,
  disabled,
}: {
  contestant: Contestant
  rank: number
  disabled?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: contestant.id,
    disabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className={`sortable-item ${isDragging ? 'dragging' : ''}`}>
      <span className="drag-handle" {...attributes} {...listeners}>
        ⠿
      </span>
      <ContestantCard contestant={contestant} rank={rank} />
    </div>
  )
}

export default function RankingBoard({
  contestants,
  initialOrder,
  onSubmit,
  disabled,
}: RankingBoardProps) {
  const [orderedIds, setOrderedIds] = useState<string[]>(() => {
    if (initialOrder?.length) return initialOrder
    return contestants.map((c) => c.id)
  })

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setOrderedIds((prev) => {
        const oldIndex = prev.indexOf(String(active.id))
        const newIndex = prev.indexOf(String(over.id))
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  const contestantMap = new Map(contestants.map((c) => [c.id, c]))

  return (
    <div className="ranking-board">
      <h3>Rangschikking</h3>
      <p className="ranking-hint">#1 = meest verdacht · Sleep om te herschikken</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
          <div className="ranking-list">
            {orderedIds.map((id, index) => {
              const contestant = contestantMap.get(id)
              if (!contestant) return null
              return (
                <SortableItem
                  key={id}
                  contestant={contestant}
                  rank={index + 1}
                  disabled={disabled}
                />
              )
            })}
          </div>
        </SortableContext>
      </DndContext>
      <button
        className="btn btn-primary submit-ranking"
        onClick={() => onSubmit(orderedIds)}
        disabled={disabled}
      >
        {disabled ? 'Deadline verstreken' : 'Rangschikking indienen'}
      </button>
    </div>
  )
}
