export function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="mt-2 max-w-2xl overflow-x-auto rounded border border-border bg-muted p-3 font-mono text-xs text-secondary-foreground">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}
