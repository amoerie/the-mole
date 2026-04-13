import { Star } from 'lucide-react'

interface Props {
  level: number | undefined
  disabled?: boolean
  onChange: (level: number | undefined) => void
}

export default function SuspicionLevelPicker({ level, disabled = false, onChange }: Props) {
  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, current: number) {
    if (disabled) return
    let next: number | undefined
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = current === 5 ? 1 : current + 1
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        next = current === 1 ? 5 : current - 1
        break
      case 'Home':
        next = 1
        break
      case 'End':
        next = 5
        break
      default:
        return
    }
    event.preventDefault()
    onChange(next)
    const group = event.currentTarget.parentElement
    group?.querySelector<HTMLButtonElement>(`[data-level="${next}"]`)?.focus()
  }

  return (
    <div role="radiogroup" aria-label="Verdachtigheidsniveau" className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={level === n}
          aria-label={`${n} ster`}
          data-level={n}
          tabIndex={level === undefined ? (n === 1 ? 0 : -1) : level === n ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(level === n ? undefined : n)}
          onKeyDown={(e) => handleKeyDown(e, n)}
          className={`size-5 transition-colors ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:text-yellow-500'}`}
        >
          <Star
            className={`size-4 ${
              level !== undefined && n <= level
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-muted-foreground'
            }`}
          />
        </button>
      ))}
    </div>
  )
}
