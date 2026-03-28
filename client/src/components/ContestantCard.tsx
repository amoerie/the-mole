import type { Contestant } from '../types'

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
    <div className={`contestant-card ${eliminated ? 'eliminated' : ''} ${className ?? ''}`}>
      {rank != null && <span className="rank-number">#{rank}</span>}
      <img src={contestant.photoUrl} alt={contestant.name} className="contestant-photo" />
      <div className="contestant-info">
        <span className="contestant-name">{contestant.name}</span>
        <span className="contestant-age">{contestant.age} jaar</span>
      </div>
    </div>
  )
}
