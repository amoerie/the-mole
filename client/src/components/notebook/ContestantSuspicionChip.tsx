import type { Contestant } from '../../types'
import SuspicionLevelPicker from './SuspicionLevelPicker'

interface Props {
  contestant: Contestant
  level: number | undefined
  onChange: (level: number | undefined) => void
}

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default function ContestantSuspicionChip({ contestant, level, onChange }: Props) {
  return (
    <div className="flex flex-col items-center gap-1 flex-shrink-0">
      {contestant.photoUrl ? (
        <img
          src={contestant.photoUrl}
          alt={contestant.name}
          className="size-10 rounded-full object-cover border border-border"
        />
      ) : (
        <div className="size-10 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground border border-border">
          {initials(contestant.name)}
        </div>
      )}
      <span className="text-xs text-center leading-tight max-w-[60px] truncate">
        {contestant.name.split(' ')[0]}
      </span>
      <SuspicionLevelPicker level={level} onChange={onChange} />
    </div>
  )
}
