import type { Contestant } from '../types'
import { cn } from '../lib/utils'

interface ContestantCardProps {
  contestant: Contestant
  rank?: number
  eliminated?: boolean
  className?: string
}

export default function ContestantCard({
  contestant,
  rank,
  eliminated,
  className,
}: ContestantCardProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col items-center gap-2 rounded-lg border bg-card p-3 text-center transition-opacity',
        eliminated && 'eliminated opacity-40',
        className,
      )}
    >
      {rank != null && (
        <span className="absolute left-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          #{rank}
        </span>
      )}
      <img
        src={contestant.photoUrl}
        alt={contestant.name}
        className="size-16 rounded-full border-2 border-border object-cover"
        onError={(e) => {
          ;(e.target as HTMLImageElement).src =
            `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(contestant.name)}&backgroundType=gradientLinear`
        }}
      />
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold leading-tight">{contestant.name}</span>
        <span className="text-xs text-muted-foreground">{contestant.age} jaar</span>
      </div>
    </div>
  )
}
