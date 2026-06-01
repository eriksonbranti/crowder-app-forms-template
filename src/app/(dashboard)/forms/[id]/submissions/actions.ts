"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { DomainError } from "@/lib/errors"
import { getCurrentUser } from "@/adapters/supabase/server"
import { editSubmission } from "@/modules/submissions"

const editSchema = z.object({
  submissionId: z.string().uuid(),
  answers: z.record(z.string(), z.unknown()),
  reason: z.string().max(500).optional().nullable(),
})

export type EditResult =
  | { ok: true }
  | { ok: false; error: { code: string; message: string; details?: unknown } }

export async function editSubmissionAction(
  input: z.infer<typeof editSchema>,
): Promise<EditResult> {
  const parsed = editSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "invalid_payload", message: "Input inválido" },
    }
  }
  const user = await getCurrentUser()
  if (!user) {
    return {
      ok: false,
      error: { code: "auth_invalid", message: "No autenticado" },
    }
  }

  try {
    await editSubmission({
      submissionId: parsed.data.submissionId,
      editedBy: user.id,
      answers: parsed.data.answers,
      reason: parsed.data.reason ?? null,
    })
    revalidatePath("/forms", "layout")
    return { ok: true }
  } catch (err) {
    if (err instanceof DomainError) {
      return {
        ok: false,
        error: { code: err.code, message: err.message, details: err.details },
      }
    }
    return {
      ok: false,
      error: { code: "internal_error", message: "Error inesperado" },
    }
  }
}
