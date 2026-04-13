import type { Contestant, Episode } from '../../types'
import type { NoteState } from '../../pages/NotebookPage'

interface Props {
  contestants: Contestant[]
  episodes: Episode[]
  notes: Map<number, NoteState>
  onEpisodeSelect: (episodeNumber: number) => void
}

function StarBadge({ level }: { level: number | undefined }) {
  if (level === undefined) return <span className="text-muted-foreground">–</span>
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-yellow-600">
      {'★'.repeat(level)}
    </span>
  )
}

export default function SuspectTimelinePanel({
  contestants,
  episodes,
  notes,
  onEpisodeSelect,
}: Props) {
  const sorted = [
    ...contestants.filter((c) => c.eliminatedInEpisode == null),
    ...contestants
      .filter((c) => c.eliminatedInEpisode != null)
      .sort((a, b) => (a.eliminatedInEpisode ?? 0) - (b.eliminatedInEpisode ?? 0)),
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="text-left py-2 pr-4 font-medium text-muted-foreground whitespace-nowrap">
              Kandidaat
            </th>
            {episodes.map((ep) => (
              <th
                key={ep.number}
                className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap text-center"
              >
                Afl. {ep.number}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((contestant) => (
            <tr key={contestant.id} className="border-t border-border">
              <td className="py-2 pr-4 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  {contestant.photoUrl && (
                    <img
                      src={contestant.photoUrl}
                      alt={contestant.name}
                      className="size-6 rounded-full object-cover"
                    />
                  )}
                  <span
                    className={
                      contestant.eliminatedInEpisode != null ? 'line-through opacity-50' : ''
                    }
                  >
                    {contestant.name.split(' ')[0]}
                  </span>
                </div>
              </td>
              {episodes.map((ep) => {
                const level = notes.get(ep.number)?.suspicionLevels[contestant.id]
                return (
                  <td key={ep.number} className="py-2 px-2 text-center">
                    <button
                      onClick={() => onEpisodeSelect(ep.number)}
                      className="hover:underline focus:outline-none"
                      title={`Ga naar aflevering ${ep.number}`}
                    >
                      <StarBadge level={level} />
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
