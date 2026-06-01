import { sql } from "drizzle-orm"
import {
  boolean,
  doublePrecision,
  foreignKey,
  integer,
  jsonb,
  pgEnum,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

export const transactionStatusEnum = pgEnum("transaction_status", [
  "valid",
  "reserved",
  "expired",
  "confirmed",
  "refunded",
])
export type TransactionStatus =
  (typeof transactionStatusEnum.enumValues)[number]

export const refundReasonEnum = pgEnum("refund_reason", [
  "user_request",
  "cancelled_by_partner",
  "chargeback",
  "fraud",
  "other",
])
export type RefundReason = (typeof refundReasonEnum.enumValues)[number]

export const groupScopeEnum = pgEnum("group_scope", ["transaction", "item"])
export type GroupScope = (typeof groupScopeEnum.enumValues)[number]

export type PartnerTheme = {
  primary?: string
}

export type FormTheme = PartnerTheme

export const partnerConfig = pgTable("partner_config", {
  id: integer("id").primaryKey(),
  crowderApiKey: text("crowder_api_key").notNull(),
  crowderApiKeyPrevious: text("crowder_api_key_previous"),
  supportedCurrencies: jsonb("supported_currencies")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  protocolVersions: jsonb("protocol_versions")
    .$type<string[]>()
    .notNull()
    .default(sql`'["1.2"]'::jsonb`),
  allowedOrigins: jsonb("allowed_origins")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  theme: jsonb("theme").$type<PartnerTheme>(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export type FormDefinition = {
  schemaVersion: 1
  groups: FormGroup[]
}

export type FormGroup = {
  id: string
  title: string
  description: string | null
  scope: GroupScope
  labelTemplate: string
  visibleWhen?: { question: string; equals: string | number | boolean }
  questions: FormQuestion[]
}

export type QuestionType =
  | "short_text"
  | "long_text"
  | "number"
  | "email"
  | "phone"
  | "single_choice"
  | "multiple_choice"
  | "dropdown"
  | "date"
  | "datetime"
  | "time"
  | "country"
  | "document_id"
  | "scale"
  | "consent"
  | "info"

export type FormQuestion = {
  id: string
  type: QuestionType
  label: string
  help: string | null
  required: boolean
  placeholder: string | null
  validation?: {
    min?: number
    max?: number
    pattern?: string
    message?: string
  }
  options?: { value: string; label: string }[]
  scale?: { min: number; max: number; minLabel?: string; maxLabel?: string }
  consent?: { mustAccept: boolean }
  prefillFrom?:
    | "item.holder.firstName"
    | "item.holder.lastName"
    | "item.holder.documentType"
    | "item.holder.documentNumber"
    | "user.email"
    | "user.firstName"
    | "user.lastName"
    | "user.country"
  visibleWhen?: { question: string; equals: string | number | boolean }
}

export const forms = pgTable("forms", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  definition: jsonb("definition").$type<FormDefinition>().notNull(),
  enabled: boolean("enabled").notNull().default(true),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  position: integer("position").notNull().default(0),
  allowedOrigins: jsonb("allowed_origins")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  theme: jsonb("theme").$type<FormTheme>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const formVersions = pgTable(
  "form_versions",
  {
    formId: text("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    definition: jsonb("definition").$type<FormDefinition>().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.formId, t.version] }),
    index("form_versions_form_id_idx").on(t.formId),
  ],
)

// Snapshot of the buyer as it arrived in the Crowder context at submit time.
// Persisted on the transaction (one context per submit batch) so exports can
// surface who submitted without a round-trip back to Crowder.
export type UserSnapshot = {
  email: string | null
  firstName: string | null
  lastName: string | null
  country: string | null
}

export const transactions = pgTable("transactions", {
  id: text("id").primaryKey(),
  status: transactionStatusEnum("status").notNull(),
  currency: text("currency").notNull(),
  eventId: integer("event_id").notNull(),
  eventName: text("event_name").notNull(),
  // Crowder context fields kept for export/audit; nullable for rows created
  // before this column existed and for contexts that omit them.
  locale: text("locale"),
  userSnapshot: jsonb("user_snapshot").$type<UserSnapshot>(),
  // Denormalized buyer identity, copied from userSnapshot at submit time so
  // support search can hit btree/trigram indexes instead of scanning JSONB.
  // userSnapshot remains the source of truth; these are search index only.
  buyerEmail: text("buyer_email"),
  buyerFirstName: text("buyer_first_name"),
  buyerLastName: text("buyer_last_name"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  purchaseId: integer("purchase_id"),
  purchaseAmount: doublePrecision("purchase_amount"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
  refundAmount: doublePrecision("refund_amount"),
  refundReason: refundReasonEnum("refund_reason"),
  refundId: text("refund_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [
  index("transactions_status_idx").on(t.status),
  index("transactions_status_expires_at_idx").on(t.status, t.expiresAt),
  index("transactions_created_at_idx").on(t.createdAt),
  // Support search: exact email lookup (case-insensitive) and partial name
  // match via pg_trgm. The trigram index covers ILIKE '%term%' on the full
  // name; coalesce avoids a null result when one part is missing.
  index("transactions_buyer_email_idx").on(sql`lower(${t.buyerEmail})`),
  index("transactions_buyer_name_trgm_idx").using(
    "gin",
    sql`lower(coalesce(${t.buyerFirstName}, '') || ' ' || coalesce(${t.buyerLastName}, '')) gin_trgm_ops`,
  ),
])

export type ItemSnapshot = {
  uuid: string
  show: string
  sectorName: string
  rateName: string
  sectionName: string | null
  row: string | null
  seat: string | null
  quantity: number
  price: number
  holder: {
    firstName: string
    lastName: string
    documentType: string
    documentNumber: string
  } | null
}

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    formId: text("form_id")
      .notNull()
      .references(() => forms.id),
    groupId: text("group_id").notNull(),
    formVersion: integer("form_version").notNull(),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    scope: groupScopeEnum("scope").notNull(),
    itemUuid: text("item_uuid"),
    itemSnapshot: jsonb("item_snapshot").$type<ItemSnapshot>(),
    // Denormalized ticket holder identity, copied from itemSnapshot.holder at
    // submit time. The document only exists at the holder (per-item) grain, so
    // support search by document lives here, not on transactions.
    holderFirstName: text("holder_first_name"),
    holderLastName: text("holder_last_name"),
    holderDocument: text("holder_document"),
    answers: jsonb("answers").$type<Record<string, unknown>>().notNull(),
    computedLabel: text("computed_label").notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.formId, t.formVersion],
      foreignColumns: [formVersions.formId, formVersions.version],
      name: "submissions_form_version_fk",
    }),
    uniqueIndex("submissions_unique_item")
      .on(t.formId, t.groupId, t.transactionId, t.itemUuid)
      .where(sql`${t.itemUuid} IS NOT NULL`),
    uniqueIndex("submissions_unique_transaction")
      .on(t.formId, t.groupId, t.transactionId)
      .where(sql`${t.itemUuid} IS NULL`),
    // Covers grouped queries that don't pin transactionId (drilldown,
    // listEditsByGroup) — the unique partial indexes
    // above are not usable for those filters.
    index("submissions_form_group_idx").on(t.formId, t.groupId),
    // Support search at the holder grain: exact document lookup and partial
    // name match via pg_trgm.
    index("submissions_holder_document_idx").on(t.holderDocument),
    index("submissions_holder_name_trgm_idx").using(
      "gin",
      sql`lower(coalesce(${t.holderFirstName}, '') || ' ' || coalesce(${t.holderLastName}, '')) gin_trgm_ops`,
    ),
  ],
)

export const submissionEdits = pgTable(
  "submission_edits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    editedBy: uuid("edited_by").notNull(), // FK lógico → auth.users.id (no enforzado vía .references porque vive en otro schema de Supabase)
    editedAt: timestamp("edited_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reason: text("reason"),
    answersBefore: jsonb("answers_before").notNull(),
    answersAfter: jsonb("answers_after").notNull(),
  },
  (t) => [index("submission_edits_submission_id_idx").on(t.submissionId)],
)

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: text("transaction_id").notNull(),
    status: text("status").notNull(),
    payload: jsonb("payload").notNull(),
    responseStatus: integer("response_status").notNull(),
    responseBody: jsonb("response_body").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("webhook_events_unique").on(t.transactionId, t.status)],
)
