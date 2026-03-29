export default function Footer() {
  const buildDate = import.meta.env.VITE_BUILD_DATE as string | undefined
  const commitSha = import.meta.env.VITE_COMMIT_SHA as string | undefined

  if (!buildDate && !commitSha) return null

  const shortSha = commitSha?.slice(0, 7)
  const date = buildDate ? new Date(buildDate).toLocaleString('nl-BE') : null

  return (
    <footer className="border-t border-border py-3 text-center text-xs text-muted-foreground/60">
      {date && <span>{date}</span>}
      {date && shortSha && <span className="mx-1.5">·</span>}
      {shortSha && <span className="font-mono">{shortSha}</span>}
    </footer>
  )
}
