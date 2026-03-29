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
import { GripVertical } from 'lucide-react'
import type { Contestant } from '../types'
import { cn } from '../lib/utils'

interface RankingBoardProps {
  contestants: Contestant[]
  initialOrder?: string[]
  onChange: (orderedIds: string[]) => void
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
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 rounded-md border bg-card p-2 transition-colors',
        isDragging ? 'border-primary opacity-50 shadow-lg' : 'hover:border-primary/40',
        disabled && 'cursor-default',
      )}
    >
      <button
        className={cn(
          'flex touch-none items-center text-muted-foreground',
          disabled ? 'cursor-default' : 'cursor-grab hover:text-foreground active:cursor-grabbing',
        )}
        {...attributes}
        {...listeners}
        aria-label="Versleep om te herschikken"
      >
        <GripVertical className="size-4" />
      </button>
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
        #{rank}
      </span>
      <img
        src={contestant.photoUrl}
        alt={contestant.name}
        className="size-8 rounded-full border border-border object-cover"
        onError={(e) => {
          ;(e.target as HTMLImageElement).src =
            `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(contestant.name)}&backgroundType=gradientLinear`
        }}
      />
      <span className="text-sm font-medium">{contestant.name}</span>
    </div>
  )
}

export default function RankingBoard({
  contestants,
  initialOrder,
  onChange,
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
      const oldIndex = orderedIds.indexOf(String(active.id))
      const newIndex = orderedIds.indexOf(String(over.id))
      const newOrder = arrayMove(orderedIds, oldIndex, newIndex)
      setOrderedIds(newOrder)
      onChange(newOrder)
    }
  }

  const contestantMap = new Map(contestants.map((c) => [c.id, c]))

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">#1 = meest verdacht · Sleep om te herschikken</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-1.5">
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
    </div>
  )
}
