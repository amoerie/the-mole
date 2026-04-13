import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../ui/button'

export const NOTEBOOK_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  red: { bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-900' },
  orange: { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-900' },
  yellow: { bg: 'bg-yellow-100', border: 'border-yellow-300', text: 'text-yellow-900' },
  green: { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-900' },
  teal: { bg: 'bg-teal-100', border: 'border-teal-300', text: 'text-teal-900' },
  blue: { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-900' },
  purple: { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-900' },
  pink: { bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-900' },
}

export const DEFAULT_COLOR_PALETTE = Object.keys(NOTEBOOK_COLORS)

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
