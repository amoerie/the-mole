import { useState, useRef, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { CheckCircle2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import RankingBoard from './RankingBoard'
import type { Contestant, Episode, PlayerRanking, Ranking } from '../types'

interface Props {
  episode: Episode
  activeContestants: Contestant[]
  allContestants: Contestant[]
  myRankings: Ranking[]
  episodeRankings: PlayerRanking[]
  onSubmit: (orderedIds: string[]) => Promise<void>
}

type SaveStatus = 'idle' | 'saving' | 'saved'

const DEBOUNCE_MS = 500
const SAVED_FEEDBACK_MS = 3000

export default function EpisodeCard({
  episode,
  activeContestants,
  allContestants,
  myRankings,
  episodeRankings,
  onSubmit,
}: Props) {
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  const isDeadlinePassed = new Date(episode.deadline) < new Date()
  const existingRanking = myRankings.find((r) => r.episodeNumber === episode.number)
  const hasSubmitted = myRankings.some((r) => r.episodeNumber === episode.number)

  function handleChange(orderedIds: string[]) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    setSaveStatus('saving')
    debounceRef.current = setTimeout(async () => {
      try {
        await onSubmit(orderedIds)
        setSaveStatus('saved')
        savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), SAVED_FEEDBACK_MS)
      } catch {
        setSaveStatus('idle')
      }
    }, DEBOUNCE_MS)
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle>Aflevering {episode.number}</CardTitle>
          <Badge variant={isDeadlinePassed ? 'destructive' : 'secondary'} className="text-xs">
            {isDeadlinePassed ? 'Deadline verstreken' : 'Open'}
          </Badge>
        </div>
        <CardDescription>
          Deadline: {new Date(episode.deadline).toLocaleString('nl-BE')}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 flex flex-col gap-3">
        <RankingBoard
          key={existingRanking?.id ?? 'new'}
          contestants={activeContestants}
          initialOrder={existingRanking?.contestantIds}
          onChange={handleChange}
          disabled={isDeadlinePassed}
        />
        <div className="flex items-center gap-2 text-sm h-5">
          {saveStatus === 'saving' && (
            <>
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Opslaan...</span>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <CheckCircle2 className="size-4 text-green-500" />
              <span className="text-green-500">
                {hasSubmitted ? 'Rangschikking bijgewerkt.' : 'Rangschikking opgeslagen.'}
              </span>
            </>
          )}
        </div>
        {isDeadlinePassed && episodeRankings.length > 0 && (
          <>
            <Separator className="mt-2" />
            <p className="text-sm font-medium">
              Inzendingen aflevering {episode.number} ({episodeRankings.length}{' '}
              {episodeRankings.length === 1 ? 'speler' : 'spelers'})
            </p>
            {episodeRankings.map((pr) => (
              <div key={pr.userId} className="rounded-md border overflow-hidden">
                <button
                  className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedPlayer(expandedPlayer === pr.userId ? null : pr.userId)}
                >
                  <span>{pr.displayName}</span>
                  {expandedPlayer === pr.userId ? (
                    <ChevronUp className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  )}
                </button>
                {expandedPlayer === pr.userId && (
                  <div className="flex flex-col gap-1 border-t px-3 py-2">
                    {pr.contestantIds.map((id, idx) => {
                      const contestant = allContestants.find((c) => c.id === id)
                      return (
                        <div key={id} className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground w-5">#{idx + 1}</span>
                          <span>{contestant?.name ?? id}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  )
}
