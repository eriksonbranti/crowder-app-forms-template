import {
  RiAlignLeft,
  RiArrowDownSLine,
  RiBarChartHorizontalLine,
  RiCalendarEventLine,
  RiCalendarLine,
  RiCheckboxLine,
  RiCheckboxMultipleLine,
  RiEarthLine,
  RiHashtag,
  RiIdCardLine,
  RiInformationLine,
  RiMailLine,
  RiPhoneLine,
  RiRadioButtonLine,
  RiText,
  RiTimeLine,
  type RemixiconComponentType,
} from "@remixicon/react"

import type { QuestionType } from "@/lib/db/schema"

export type QuestionTypeMeta = {
  value: QuestionType
  label: string
  Icon: RemixiconComponentType
}

export const QUESTION_TYPES: QuestionTypeMeta[] = [
  { value: "short_text", label: "Texto corto", Icon: RiText },
  { value: "long_text", label: "Texto largo", Icon: RiAlignLeft },
  { value: "number", label: "Número", Icon: RiHashtag },
  { value: "email", label: "Email", Icon: RiMailLine },
  { value: "phone", label: "Teléfono", Icon: RiPhoneLine },
  { value: "single_choice", label: "Opción única", Icon: RiRadioButtonLine },
  { value: "multiple_choice", label: "Múltiple opción", Icon: RiCheckboxMultipleLine },
  { value: "dropdown", label: "Dropdown", Icon: RiArrowDownSLine },
  { value: "date", label: "Fecha", Icon: RiCalendarLine },
  { value: "datetime", label: "Fecha y hora", Icon: RiCalendarEventLine },
  { value: "time", label: "Hora", Icon: RiTimeLine },
  { value: "country", label: "País", Icon: RiEarthLine },
  { value: "document_id", label: "Documento", Icon: RiIdCardLine },
  { value: "scale", label: "Escala", Icon: RiBarChartHorizontalLine },
  { value: "consent", label: "Consentimiento", Icon: RiCheckboxLine },
  { value: "info", label: "Info (solo texto)", Icon: RiInformationLine },
]

export const QUESTION_TYPE_BY_VALUE: Record<QuestionType, QuestionTypeMeta> =
  Object.fromEntries(QUESTION_TYPES.map((t) => [t.value, t])) as Record<
    QuestionType,
    QuestionTypeMeta
  >

export const CHOICE_TYPES: QuestionType[] = [
  "single_choice",
  "multiple_choice",
  "dropdown",
]
export const TEXT_LIKE_TYPES: QuestionType[] = [
  "short_text",
  "long_text",
  "email",
  "phone",
  "document_id",
]
export const NUMBER_LIKE_TYPES: QuestionType[] = ["number"]
