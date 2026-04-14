import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../api/client'
import type { Game, Notebook } from '../types'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Skeleton } from '../components/ui/skeleton'
import { AlertCircle } from 'lucide-react'
import NotebookCoverHeader from '../components/notebook/NotebookCoverHeader'
import { DEFAULT_COLOR_PALETTE } from '../components/notebook/notebookColors'
import EpisodeNoteCard from '../components/notebook/EpisodeNoteCard'
import SuspectTimelinePanel from '../components/notebook/SuspectTimelinePanel'

export interface NoteState {
  content: string
  suspicionLevels: Record<string, number>
  savingState: 'idle' | 'saving' | 'saved'
}

function buildInitialNotes(game: Game, notebook: Notebook): Map<number, NoteState> {
  const map = new Map<number, NoteState>()
  const now = new Date()
  const sortedEpisodes = [...game.episodes].sort((a, b) => a.number - b.number)

  for (let i = 0; i < sortedEpisodes.length; i++) {
    const ep = sortedEpisodes[i]
    const referenceDeadline = i === 0 ? ep.deadline : sortedEpisodes[i - 1].deadline
    if (new Date(referenceDeadline) >= now) continue
    map.set(ep.number, { content: '', suspicionLevels: {}, savingState: 'idle' })
  }

  for (const note of notebook.notes) {
    const existing = map.get(note.episodeNumber)
    if (existing) {
      map.set(note.episodeNumber, {
        ...existing,
        content: note.content,
        suspicionLevels: note.suspicionLevels,
      })
    }
  }

  return map
}

function defaultColor(userId: string): string {
  const hash = userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return DEFAULT_COLOR_PALETTE[hash % DEFAULT_COLOR_PALETTE.length]
}

export default function NotebookPage() {
  const { gameId } = useParams<{ gameId: string }>()
  const { user } = useAuth()

  const [game, setGame] = useState<Game | null>(null)
  const [notebookColor, setNotebookColor] = useState<string | null>(null)
  const [notes, setNotes] = useState<Map<number, NoteState>>(new Map())
  const [view, setView] = useState<'episodes' | 'suspects'>('episodes')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const debounceTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  const savedTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  const notesRef = useRef<Map<number, NoteState>>(new Map())
  const episodeRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  useEffect(() => {
    notesRef.current = notes
  }, [notes])

  useEffect(() => {
    return () => {
      debounceTimers.current.forEach(clearTimeout)
      savedTimers.current.forEach(clearTimeout)
    }
  }, [])

  useEffect(() => {
    if (!gameId) return
    Promise.all([api.getGame(gameId), api.getNotebook(gameId)])
      .then(([g, notebook]) => {
        setGame(g)
        setNotebookColor(notebook.notebookColor)
        setNotes(buildInitialNotes(g, notebook))
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Fout bij laden'))
      .finally(() => setLoading(false))
  }, [gameId])

  const saveNote = useCallback(
    (episodeNumber: number, content: string, suspicionLevels: Record<string, number>) => {
      if (!gameId) return

      setNotes((prev) => {
        const next = new Map(prev)
        const entry = next.get(episodeNumber)
        if (entry) next.set(episodeNumber, { ...entry, savingState: 'saving' })
        return next
      })

      api
        .saveNote(gameId, episodeNumber, content, suspicionLevels)
        .then(() => {
          setNotes((prev) => {
            const next = new Map(prev)
            const entry = next.get(episodeNumber)
            if (entry) next.set(episodeNumber, { ...entry, savingState: 'saved' })
            return next
          })
          const existing = savedTimers.current.get(episodeNumber)
          if (existing) clearTimeout(existing)
          const savedTimer = setTimeout(() => {
            setNotes((prev) => {
              const next = new Map(prev)
              const entry = next.get(episodeNumber)
              if (entry && entry.savingState === 'saved')
                next.set(episodeNumber, { ...entry, savingState: 'idle' })
              return next
            })
          }, 2000)
          savedTimers.current.set(episodeNumber, savedTimer)
        })
        .catch(() => {
          setNotes((prev) => {
            const next = new Map(prev)
            const entry = next.get(episodeNumber)
            if (entry) next.set(episodeNumber, { ...entry, savingState: 'idle' })
            return next
          })
        })
    },
    [gameId],
  )

  function handleContentChange(episodeNumber: number, content: string) {
    setNotes((prev) => {
      const next = new Map(prev)
      const entry = next.get(episodeNumber)
      if (entry) next.set(episodeNumber, { ...entry, content })
      return next
    })

    const existing = debounceTimers.current.get(episodeNumber)
    if (existing) clearTimeout(existing)

    const timer = setTimeout(() => {
      const entry = notesRef.current.get(episodeNumber)
      if (entry) saveNote(episodeNumber, entry.content, entry.suspicionLevels)
    }, 500)
    debounceTimers.current.set(episodeNumber, timer)
  }

  function handleSuspicionChange(
    episodeNumber: number,
    contestantId: string,
    level: number | undefined,
  ) {
    setNotes((prev) => {
      const next = new Map(prev)
      const entry = next.get(episodeNumber)
      if (!entry) return prev
      const updatedLevels = { ...entry.suspicionLevels }
      if (level === undefined) {
        delete updatedLevels[contestantId]
      } else {
        updatedLevels[contestantId] = level
      }
      const updated = { ...entry, suspicionLevels: updatedLevels }
      next.set(episodeNumber, updated)
      saveNote(episodeNumber, updated.content, updated.suspicionLevels)
      return next
    })
  }

  function handleEpisodeSelect(episodeNumber: number) {
    setView('episodes')
    setTimeout(() => {
      episodeRefs.current.get(episodeNumber)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  async function handleColorChange(color: string) {
    if (!gameId) return
    setNotebookColor(color)
    await api.updateNotebookColor(gameId, color).catch(() => {})
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8 flex flex-col gap-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!game) return null

  const now = new Date()
  const sortedEpisodes = [...game.episodes].sort((a, b) => a.number - b.number)
  const pastEpisodes = sortedEpisodes
    .filter((ep, i) => {
      const referenceDeadline = i === 0 ? ep.deadline : sortedEpisodes[i - 1].deadline
      return new Date(referenceDeadline) < now
    })
    .reverse()

  const effectiveColor = notebookColor ?? defaultColor(user?.userId ?? '')

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8 flex flex-col gap-4">
      <NotebookCoverHeader
        playerName={user?.displayName ?? ''}
        notebookColor={effectiveColor}
        view={view}
        gameId={game.id}
        onViewChange={setView}
        onColorChange={handleColorChange}
      />

      {view === 'episodes' && (
        <div className="flex flex-col gap-4">
          {pastEpisodes.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nog geen afleveringen afgelopen.
            </p>
          )}
          {pastEpisodes.length > 0 && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Verdachtheid</span> — geef elke kandidaat een score van
              1 tot 5 sterren om bij te houden hoe verdacht je hen vindt.{' '}
              <span className="text-yellow-500">★</span> = nauwelijks verdacht,{' '}
              <span className="text-yellow-500">★★★★★</span> = heel verdacht (de Mol!). Klik
              nogmaals op een ster om de score te wissen.
            </p>
          )}
          {pastEpisodes.map((ep) => (
            <div
              key={ep.number}
              ref={(el) => {
                if (el) episodeRefs.current.set(ep.number, el)
                else episodeRefs.current.delete(ep.number)
              }}
            >
              <EpisodeNoteCard
                episode={ep}
                contestants={game.contestants}
                noteState={
                  notes.get(ep.number) ?? { content: '', suspicionLevels: {}, savingState: 'idle' }
                }
                onContentChange={(content) => handleContentChange(ep.number, content)}
                onSuspicionChange={(contestantId, level) =>
                  handleSuspicionChange(ep.number, contestantId, level)
                }
              />
            </div>
          ))}
        </div>
      )}

      {view === 'suspects' && (
        <SuspectTimelinePanel
          contestants={game.contestants}
          episodes={pastEpisodes.slice().reverse()}
          notes={notes}
          onEpisodeSelect={handleEpisodeSelect}
        />
      )}
    </main>
  )
}
