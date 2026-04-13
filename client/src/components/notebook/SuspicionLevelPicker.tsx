import { Star } from 'lucide-react'

interface Props {
  level: number | undefined
  disabled?: boolean
  onChange: (level: number | undefined) => void
}

export default function SuspicionLevelPicker({ level, disabled = false, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label="Verdachtigheidsniveau" className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          role="radio"
          aria-checked={level === n}
          aria-label={`${n} ster`}
          disabled={disabled}
          onClick={() => onChange(level === n ? undefined : n)}
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
