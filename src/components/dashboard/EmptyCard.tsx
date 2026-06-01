import { EmptyState } from "@/components/EmptyState"

export function EmptyCard({ message }: { message: string }) {
  return <EmptyState compact title={message} />
}
