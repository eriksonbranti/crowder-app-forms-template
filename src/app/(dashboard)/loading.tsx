export default function Loading() {
  return (
    <main>
      <div className="mb-8 space-y-2">
        <div className="h-6 w-40 animate-pulse rounded bg-subtle" />
        <div className="h-4 w-72 animate-pulse rounded bg-muted" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg border border-border bg-background"
          />
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-lg border border-border bg-background" />
        <div className="h-64 animate-pulse rounded-lg border border-border bg-background" />
      </div>
    </main>
  )
}
