import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import RankingBoard from './RankingBoard'
import type { Contestant, Episode, PlayerRanking, Ranking } from '../types'

interface Props {
  episode: Episode
  activeContestants: Contestant[]
  allContestants: Contestant[]
  myRankings: Ranking[]
  episodeRankings: PlayerRanking[]
  submitting: boolean
  onSubmit: (orderedIds: string[]) => Promise<void>
}

export default function EpisodeCard({
  episode,
  activeContestants,
  allContestants,
  myRankings,
  episodeRankings,
  submitting,
  onSubmit,
}: Props) {
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const isDeadlinePassed = new Date(episode.deadline) < new Date()
  const existingRanking = myRankings.find((r) => r.episodeNumber === episode.number)
  const hasSubmitted = myRankings.some((r) => r.episodeNumber === episode.number)

  async function handleSubmit(orderedIds: string[]) {
    await onSubmit(orderedIds)
    setSubmitted(true)
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
        {(hasSubmitted || submitted) && (
          <div className="flex items-center gap-2 text-sm text-green-500">
            <CheckCircle2 className="size-4" />
            <span>
              {submitted
                ? 'Je rangschikking is bijgewerkt voor deze aflevering.'
                : 'Je rangschikking is ingediend voor deze aflevering.'}
            </span>
          </div>
        )}
        <RankingBoard
          key={existingRanking?.id ?? 'new'}
          contestants={activeContestants}
          initialOrder={existingRanking?.contestantIds}
          onSubmit={handleSubmit}
          disabled={isDeadlinePassed || submitting}
          isUpdate={hasSubmitted && !submitted}
        />
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
