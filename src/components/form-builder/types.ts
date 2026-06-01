export type BuilderSelection =
  | { kind: "form" }
  | { kind: "group"; gIdx: number }
  | { kind: "question"; gIdx: number; qIdx: number }
