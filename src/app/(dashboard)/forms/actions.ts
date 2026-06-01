"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import {
  createForm,
  deleteForm,
  publishForm,
  updateForm,
} from "@/modules/forms"
import { parseFormDefinition } from "@/lib/form-schema"
import { DomainError } from "@/lib/errors"
import { parseOriginsList } from "@/lib/origins"
import { isValidHex } from "@/lib/theme"

const newFormSchema = z.object({
  title: z.string().min(1).max(200),
})

export type ActionResult =
  | { ok: true; fieldErrors?: undefined; error?: undefined }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }

export async function createFormAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = newFormSchema.safeParse({
    title: formData.get("title"),
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validación inválida",
      fieldErrors: firstFieldErrors(parsed.error),
    }
  }
  let created
  try {
    created = await createForm(parsed.data)
  } catch (err) {
    return { ok: false, error: messageOf(err) }
  }
  revalidatePath("/forms")
  redirect(`/forms/${created.id}`)
}

const updateSchema = z.object({
  title: z.string().min(1).max(200),
  enabled: z.boolean(),
  definition: z.string().min(1),
})

export async function updateFormAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = updateSchema.safeParse({
    title: formData.get("title"),
    enabled: formData.get("enabled") === "on",
    definition: formData.get("definition"),
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: "Datos inválidos",
      fieldErrors: firstFieldErrors(parsed.error),
    }
  }
  let definitionJson: unknown
  try {
    definitionJson = JSON.parse(parsed.data.definition)
  } catch {
    return {
      ok: false,
      error: "El JSON de la definición no es válido",
      fieldErrors: { definition: "JSON malformado" },
    }
  }
  let definition
  try {
    definition = parseFormDefinition(definitionJson)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return {
        ok: false,
        error: "Definición inválida",
        fieldErrors: { definition: firstZodMessage(err) },
      }
    }
    throw err
  }
  try {
    await updateForm(id, {
      title: parsed.data.title,
      enabled: parsed.data.enabled,
      definition,
    })
  } catch (err) {
    return { ok: false, error: messageOf(err) }
  }
  revalidatePath("/forms")
  revalidatePath(`/forms/${id}`)
  return { ok: true }
}

export async function publishFormAction(id: string): Promise<ActionResult> {
  try {
    await publishForm(id)
  } catch (err) {
    return { ok: false, error: messageOf(err) }
  }
  revalidatePath("/forms")
  revalidatePath(`/forms/${id}`)
  return { ok: true }
}

export async function deleteFormAction(id: string): Promise<void> {
  await deleteForm(id)
  revalidatePath("/forms")
  redirect("/forms")
}

export async function updateAllowedOriginsAction(
  id: string,
  origins: string[],
): Promise<ActionResult> {
  const parsed = parseOriginsList(origins)
  if (!parsed.ok) {
    return { ok: false, error: parsed.error }
  }
  try {
    await updateForm(id, { allowedOrigins: parsed.value })
  } catch (err) {
    return { ok: false, error: messageOf(err) }
  }
  revalidatePath(`/forms/${id}`)
  return { ok: true }
}

export async function updateFormThemeAction(
  id: string,
  hex: string | null,
): Promise<ActionResult> {
  const next = hex?.trim() || null
  if (next && !isValidHex(next)) {
    return { ok: false, error: "Color hex inválido" }
  }
  try {
    await updateForm(id, { theme: next ? { primary: next } : null })
  } catch (err) {
    return { ok: false, error: messageOf(err) }
  }
  revalidatePath(`/forms/${id}`)
  return { ok: true }
}

function firstFieldErrors(err: z.ZodError): Record<string, string> {
  const { fieldErrors } = err.flatten()
  const out: Record<string, string> = {}
  for (const [key, msgs] of Object.entries(fieldErrors)) {
    if (msgs && msgs[0]) out[key] = msgs[0]
  }
  return out
}

function firstZodMessage(err: z.ZodError): string {
  const flat = err.flatten()
  return (
    flat.formErrors[0] ??
    Object.values(flat.fieldErrors).flat()[0] ??
    "Estructura inválida"
  )
}

function messageOf(err: unknown): string {
  return err instanceof DomainError ? err.message : "Error inesperado"
}
