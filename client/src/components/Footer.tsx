export default function Footer() {
  const buildDate = import.meta.env.VITE_BUILD_DATE as string | undefined
  const commitSha = import.meta.env.VITE_COMMIT_SHA as string | undefined

  if (!buildDate && !commitSha && !import.meta.env.DEV) return null

  const shortSha = commitSha?.slice(0, 7)
  const date = buildDate ? new Date(buildDate).toLocaleString('nl-BE') : null
  const isDev = import.meta.env.DEV

  return (
    <footer className="border-t border-border py-3 text-center text-xs text-muted-foreground/60">
      {date && <span>{date}</span>}
      {date && shortSha && <span className="mx-1.5">·</span>}
      {shortSha && <span className="font-mono">{shortSha}</span>}
      {isDev && !date && !shortSha && <span className="font-mono">dev</span>}
    </footer>
  )
}
