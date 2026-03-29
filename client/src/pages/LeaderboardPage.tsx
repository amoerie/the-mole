import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Game, LeaderboardEntry } from '../types'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Skeleton } from '../components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'

export default function LeaderboardPage() {
  const { gameId } = useParams<{ gameId: string }>()

  const [game, setGame] = useState<Game | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [selectedContestant, setSelectedContestant] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!gameId) return
    Promise.all([api.getGame(gameId), api.getLeaderboard(gameId).catch(() => [])])
      .then(([gameData, lb]) => {
        setGame(gameData)
        setLeaderboard(lb)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Fout bij laden'))
      .finally(() => setLoading(false))
  }, [gameId])

  useEffect(() => {
    if (!gameId || !selectedContestant) return
    api
      .getWhatIfLeaderboard(gameId, selectedContestant)
      .then(setLeaderboard)
      .catch((err) => setError(err instanceof Error ? err.message : 'Fout bij laden'))
  }, [gameId, selectedContestant])

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl p-4 flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }
  if (!game) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <Alert variant="destructive">
          <AlertDescription>Spel niet gevonden</AlertDescription>
        </Alert>
      </div>
    )
  }

  const isMoleRevealed = !!game.moleContestantId
  const episodeNumbers = game.episodes.map((e) => e.number)

  return (
    <div className="mx-auto max-w-2xl p-4 flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Klassement — {game.name}</h2>
        <Button asChild variant="outline" size="sm">
          <Link to={`/game/${game.id}`}>← Terug</Link>
        </Button>
      </div>

      {isMoleRevealed ? (
        <Alert>
          <AlertDescription>
            🕵️ De Mol was:{' '}
            <strong>{game.contestants.find((c) => c.id === game.moleContestantId)?.name}</strong>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="flex items-center gap-3">
          <label htmlFor="what-if" className="text-sm text-muted-foreground whitespace-nowrap">
            Wat als de Mol is...
          </label>
          <select
            id="what-if"
            value={selectedContestant}
            onChange={(e) => setSelectedContestant(e.target.value)}
            className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Selecteer een kandidaat</option>
            {game.contestants.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {leaderboard.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Speler</TableHead>
                  {episodeNumbers.map((n) => (
                    <TableHead key={n} className="text-center">
                      Afl. {n}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Totaal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard
                  .sort((a, b) => b.totalScore - a.totalScore)
                  .map((entry, index) => (
                    <TableRow key={entry.userId} className={index === 0 ? 'font-semibold' : ''}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{entry.displayName}</TableCell>
                      {episodeNumbers.map((n) => {
                        const epScore = entry.episodeScores.find((es) => es.episodeNumber === n)
                        return (
                          <TableCell key={n} className="text-center text-muted-foreground">
                            {epScore ? epScore.score : '—'}
                          </TableCell>
                        )
                      })}
                      <TableCell className="text-right">{entry.totalScore}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          {isMoleRevealed
            ? 'Nog geen scores beschikbaar.'
            : 'Selecteer een kandidaat om het hypothetisch klassement te zien.'}
        </p>
      )}
    </div>
  )
}
