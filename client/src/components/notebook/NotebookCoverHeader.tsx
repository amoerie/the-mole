import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../ui/button'
import { NOTEBOOK_COLORS } from './notebookColors'

const COLOR_SWATCHES: Record<string, string> = {
  red: 'bg-red-400',
  orange: 'bg-orange-400',
  yellow: 'bg-yellow-400',
  green: 'bg-green-400',
  teal: 'bg-teal-400',
  blue: 'bg-blue-400',
  purple: 'bg-purple-400',
  pink: 'bg-pink-400',
}

interface Props {
  playerName: string
  notebookColor: string | null
  view: 'episodes' | 'suspects'
  gameId: string
  onViewChange: (view: 'episodes' | 'suspects') => void
  onColorChange: (color: string) => void
}

export default function NotebookCoverHeader({
  playerName,
  notebookColor,
  view,
  gameId,
  onViewChange,
  onColorChange,
}: Props) {
  const color = notebookColor ?? 'blue'
  const { bg, border, text } = NOTEBOOK_COLORS[color] ?? NOTEBOOK_COLORS.blue

  return (
    <div className={`rounded-xl border-2 p-4 flex flex-col gap-3 ${bg} ${border}`}>
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to={`/game/${gameId}`}>
            <ArrowLeft className="size-4" />
            Terug
          </Link>
        </Button>

        <div className="flex gap-1">
          {Object.entries(COLOR_SWATCHES).map(([name, cls]) => (
            <button
              key={name}
              aria-label={name}
              onClick={() => onColorChange(name)}
              className={`size-5 rounded-full border-2 transition-transform ${cls} ${
                color === name ? 'border-gray-800 scale-110' : 'border-transparent'
              }`}
            />
          ))}
        </div>
      </div>

      <div>
        <p className={`text-xs font-medium uppercase tracking-wider opacity-60 ${text}`}>
          Persoonlijk molboekje
        </p>
        <h1 className={`text-xl font-bold tracking-tight ${text}`}>
          Het molboekje van {playerName}
        </h1>
      </div>

      <div className="flex gap-1">
        <button
          onClick={() => onViewChange('episodes')}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
            view === 'episodes'
              ? `${border} border bg-white/60 ${text}`
              : `opacity-60 hover:opacity-80 ${text}`
          }`}
        >
          Afleveringen
        </button>
        <button
          onClick={() => onViewChange('suspects')}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
            view === 'suspects'
              ? `${border} border bg-white/60 ${text}`
              : `opacity-60 hover:opacity-80 ${text}`
          }`}
        >
          Verdachten
        </button>
      </div>
    </div>
  )
}
