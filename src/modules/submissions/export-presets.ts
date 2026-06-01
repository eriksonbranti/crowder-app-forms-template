export type ExportPreset = "full" | "sizes" | "medical" | "attendance"

export const PRESET_FIELDS: Record<Exclude<ExportPreset, "full">, string[]> = {
  sizes: ["shirt_size"],
  medical: ["blood_type", "allergies", "emergency_contact"],
  attendance: ["afiliacion", "afiliación", "especialidad"],
}
