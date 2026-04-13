import type { Contestant, Episode } from '../../types'
import type { NoteState } from '../../pages/NotebookPage'
import ContestantSuspicionChip from './ContestantSuspicionChip'

interface Props {
  episode: Episode
  contestants: Contestant[]
  noteState: NoteState
  onContentChange: (content: string) => void
  onSuspicionChange: (contestantId: string, level: number | undefined) => void
}

function formatDeadline(iso: string) {
  return new Date(iso).toLocaleDateString('nl-BE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function EpisodeNoteCard({
  episode,
  contestants,
  noteState,
  onContentChange,
  onSuspicionChange,
}: Props) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-sm">
          Aflevering {episode.number}
          <span className="ml-2 font-normal text-muted-foreground text-xs">
            {formatDeadline(episode.deadline)}
          </span>
        </h2>
        {noteState.savingState === 'saving' && (
          <span className="text-xs text-muted-foreground">Opslaan...</span>
        )}
        {noteState.savingState === 'saved' && (
          <span className="text-xs text-muted-foreground">Opgeslagen</span>
        )}
      </div>

      <textarea
        value={noteState.content}
        onChange={(e) => onContentChange(e.target.value)}
        placeholder={`Schrijf hier je notities voor aflevering ${episode.number}…`}
        rows={4}
        className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />

      {contestants.length > 0 && (
        <div className="overflow-x-auto">
          <div className="flex gap-3 pb-1">
            {contestants.map((c) => {
              const eliminated =
                c.eliminatedInEpisode != null && c.eliminatedInEpisode <= episode.number
              return (
                <ContestantSuspicionChip
                  key={c.id}
                  contestant={c}
                  level={noteState.suspicionLevels[c.id]}
                  eliminated={eliminated}
                  onChange={(level) => onSuspicionChange(c.id, level)}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
