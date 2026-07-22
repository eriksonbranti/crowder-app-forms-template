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

// Proveedores de e-commerce integrables. Un proveedor = un adapter
// (ver docs/products/definition.md, sección 5). "shopify" es la base de Fase 1.
export const providerEnum = pgEnum("provider", ["shopify", "vtex"])
export type Provider = (typeof providerEnum.enumValues)[number]

// Origen de un catálogo: "manual" tiene vida propia (CRUD a mano); el resto se
// sincroniza desde el proveedor homónimo. Se mantiene separado de `provider`
// porque uno califica la conexión y el otro el origen del catálogo.
export const catalogSourceEnum = pgEnum("catalog_source", [
  "manual",
  "shopify",
  "vtex",
])
export type CatalogSource = (typeof catalogSourceEnum.enumValues)[number]

export type PartnerTheme = {
  primary?: string
}

export type FormTheme = PartnerTheme

export const partnerConfig = pgTable("partner_config", {
  id: integer("id").primaryKey(),
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
  // Feature-flag de plataforma: qué proveedores puede llegar a usar el partner
  // (nivel "disponible", distinto de la conexión `active`; ver definition sección 5).
  enabledProviders: jsonb("enabled_providers")
    .$type<Provider[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// API keys que Crowder presenta como Bearer en los webhooks server-to-server.
// Relación uno-a-muchos: el partner puede tener varias keys con nombre, cada
// una activable/desactivable y regenerable. Al regenerar, el secreto anterior
// queda válido hasta `secretPreviousExpiresAt` (período de gracia) para no
// romper integraciones en vivo. Secretos en texto plano (alta entropía, no
// passwords) para poder mostrarlos en la UI, igual que el modelo anterior.
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  secret: text("secret").notNull(),
  secretPrevious: text("secret_previous"),
  secretPreviousExpiresAt: timestamp("secret_previous_expires_at", {
    withTimezone: true,
  }),
  active: boolean("active").notNull().default(true),
  // Soft-delete: las keys eliminadas conservan la fila (auditoría, trazabilidad)
  // pero se filtran de toda lectura y dejan de autenticar.
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// ───────────────────────────────────────────────────────────────────────────
// Productos (ver docs/products/definition.md + data-model.md)
// ───────────────────────────────────────────────────────────────────────────

// provider_credentials.config — parámetros NO secretos del proveedor; la forma
// depende del provider. El/los secreto/s viven en la columna `secret` aparte.
export type ProviderConfig =
  | { shopDomain: string; apiVersion: string } // shopify
  | { accountName: string; environment: string } // vtex (futuro)

// catalogs.sync_state — resultado del último sync (para mostrar en la UI y
// reanudar una corrida cortada por el cursor persistido).
export type SyncState = {
  lastRunAt: string
  cursor: string | null
  counts: { fetched: number; upserted: number; archived: number }
  errors: string[]
}

export type ProductStatus = "active" | "draft" | "archived"

// products.options — opciones que generan las variantes (Shopify-style).
// Orden de los valores = índice de array.
export type ProductOption = { name: string; values: string[] }

// Una variante es una combinación concreta de valores de opción (M × Rojo) y la
// unidad vendible: tiene su sku, precio, imagen y stock (ver definition sección 4.3.1).
export type ProductVariant = {
  id: string // estable dentro del producto (uuid local o externalId)
  externalId: string | null
  options: Record<string, string> // { "Talla": "M", "Color": "Rojo" }
  title: string // "M / Rojo" | "Default Title"
  sku: string | null
  price: number | null // precio de ESTA variante (puede diferir por talla)
  // Galería de la variante. imageUrl es la portada (= images[0]), conservada para
  // render/snapshot; images guarda el set completo. Vacío ⇒ hereda la del producto.
  images: string[]
  imageUrl: string | null // portada = images[0]; fallback a product.imageUrl
  status: ProductStatus
  // Inventario por variante (modelo espejo de Shopify, sección 4.4):
  stockTracked: boolean // "Track quantity"; false => ilimitada
  stock: number | null
  oversellPolicy: "deny" | "continue" // deny: no vende en 0; continue: backorder
}

// provider_credentials — credencial de un tercero (Shopify/VTEX) que NOSOTROS
// custodiamos para llamar a SU API. Naturaleza opuesta a api_keys (definition
// sección 2): solo comparten higiene de almacenamiento (secreto en texto plano + toggle
// active), no propósito ni ciclo de vida.
export const providerCredentials = pgTable("provider_credentials", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: providerEnum("provider").notNull(),
  name: text("name").notNull(), // alias visible: "Tienda principal"
  config: jsonb("config").$type<ProviderConfig>().notNull(),
  secret: text("secret").notNull(), // access token del tercero, texto plano
  active: boolean("active").notNull().default(true),
  // Soft-delete: nunca se borra una credencial; se marca eliminada (auditoría) y
  // se filtra de toda lectura. El guard de catálogos colgando se chequea en dominio.
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// catalogs — conjunto de productos. source = manual (vida propia) o
// source = <proveedor> (sincronizado desde su credencial).
export const catalogs = pgTable("catalogs", {
  id: text("id").primaryKey(), // slug, como forms.id
  title: text("title").notNull(),
  source: catalogSourceEnum("source").notNull(),
  // null si source = manual; restrict para no borrar una credencial con catálogos
  // colgando (primero hay que desconectar/migrar).
  credentialId: uuid("credential_id").references(
    () => providerCredentials.id,
    { onDelete: "restrict" },
  ),
  currency: text("currency"), // moneda por defecto del catálogo
  syncState: jsonb("sync_state").$type<SyncState>(),
  // Soft-delete: el catálogo nunca se borra; al eliminarlo se marca acá y se
  // cascadea el deletedAt a sus colecciones y productos (la FK sigue intacta).
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// collections — agrupación configurable dentro de un catálogo (entidad propia:
// título, orden, externalId si vino de Shopify). La membresía producto↔colección
// NO vive acá: vive embebida en products.collectionIds (D7).
export const collections = pgTable(
  "collections",
  {
    id: text("id").primaryKey(), // slug estable; es lo que referencia filter.collection
    catalogId: text("catalog_id")
      .notNull()
      .references(() => catalogs.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    externalId: text("external_id"), // gid://shopify/Collection/...; null si manual
    position: integer("position").notNull().default(0),
    // Soft-delete: se marca eliminada (al borrarla o al cascadear desde el catálogo)
    // y se filtra de toda lectura; la fila se conserva.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("collections_catalog_id_idx").on(t.catalogId),
    // upsert del sync por (catálogo, id externo); manuales (sin externalId) no chocan
    uniqueIndex("collections_catalog_external_idx")
      .on(t.catalogId, t.externalId)
      .where(sql`${t.externalId} IS NOT NULL`),
  ],
)

// products — producto con options/variants embebidos (JSONB, decisión D1).
// Precio y stock viven en la variante. Todo producto tiene ≥ 1 variante.
export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    catalogId: text("catalog_id")
      .notNull()
      .references(() => catalogs.id, { onDelete: "cascade" }),
    externalId: text("external_id"), // id en el proveedor; null si manual
    title: text("title").notNull(),
    currency: text("currency"), // las variantes heredan
    imageUrl: text("image_url"), // portada = images[0]; conservada para render/snapshot
    // Galería del producto (ordenada; la primera es la portada). imageUrl se
    // mantiene sincronizada a images[0] en la capa de dominio.
    images: jsonb("images")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    // "active" | "draft" | "archived" — text, validado en dominio (D2)
    status: text("status").$type<ProductStatus>().notNull().default("active"),
    position: integer("position").notNull().default(0),
    refundable: boolean("refundable").notNull().default(true),
    options: jsonb("options").$type<ProductOption[]>(), // null si producto simple
    variants: jsonb("variants").$type<ProductVariant[]>().notNull(), // SIEMPRE ≥ 1
    collectionIds: jsonb("collection_ids")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    raw: jsonb("raw"), // payload crudo del proveedor (auditoría)
    // Soft-delete: el producto nunca se borra (preserva snapshots de submissions e
    // historial); se marca eliminado y se filtra de las lecturas. Distinto de
    // status="archived": archivado sigue siendo gestionable, eliminado desaparece.
    // El sync (upsert por externalId) lo revive poniendo deletedAt en null.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("products_catalog_id_idx").on(t.catalogId),
    // upsert del sync por (catálogo, id externo); manuales (sin externalId) no chocan
    uniqueIndex("products_catalog_external_idx")
      .on(t.catalogId, t.externalId)
      .where(sql`${t.externalId} IS NOT NULL`),
    // resolver el listado por colección: collection_ids @> '["<id>"]'
    index("products_collection_ids_idx").using("gin", t.collectionIds),
  ],
)

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
  | "product"

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
  // Config de la pregunta tipo `product` (ver definition sección 8). La regla de
  // selección se expresa con min/max (no hace falta single/multiple).
  //
  // El listado se define con `source` (decisión del equipo: la COLECCIÓN es el
  // modo principal — más amigable y coherente entre catálogos manuales/Shopify):
  //   - "collection": lista los miembros de `collectionId` (catálogo derivado).
  //   - "catalog":    lista todo el catálogo `catalogId` (status=active).
  //   - "curated":    solo `productIds` del catálogo, en ese orden.
  // `catalogId` se guarda SIEMPRE (derivado de la colección en modo collection)
  // para que validación/currency/partnerItems tengan el catálogo sin re-lookup.
  // Si `source` falta, se infiere: collectionId → collection; productIds → curated;
  // si no → catalog (retrocompatible con configs que usaban filter.collection).
  product?: {
    source?: "collection" | "catalog" | "curated"
    catalogId: string
    collectionId?: string
    productIds?: string[]
    // filter.collection queda como alias legacy de collectionId; filter.tag aún
    // no se resuelve (el modelo no guarda tags — ver memoria del repo).
    filter?: { tag?: string; collection?: string; status?: "active" }
    // Origen de la regla de cantidad (min/max):
    //   - "fixed" (default): usa los min/max de abajo, tal cual se setean.
    //   - "perTickets": min y max se DERIVAN de la cantidad de tickets de la
    //     transacción (context.items.length) → 1 producto por entrada (1:1
    //     exacto). Los min/max de abajo se ignoran.
    quantitySource?: "fixed" | "perTickets"
    min?: number // mínimo a elegir (default 0). Solo aplica en modo "fixed".
    max?: number // máximo a elegir en UNIDADES totales (default 1). Solo "fixed".
    showPrice?: boolean
    // Visualización del listado: "list" (filas, default) o "cards" (grilla).
    layout?: "list" | "cards"
  }
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
  // Soft-delete: el form nunca se borra (preserva versiones, submissions e
  // historial); se marca eliminado y se filtra de toda lectura. Distinto de
  // enabled=false (archivado, sigue listándose): eliminado desaparece.
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
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

// Line item del protocolo Crowder (ver definition sección 9.2). Cada unidad de un
// producto seleccionado se emite como un PartnerItem con quantity: 1; N unidades
// = N items. Se persiste en transactions.partnerItems y el refund parcial lo
// reduce in-place (mismo uuid determinístico → variante, sección 9.8).
export type PartnerItem = {
  uuid: string // determinístico, estable dentro de la interaction (incluye variantId + unitIndex)
  type: "STORE_PRODUCT" // valor del spec (sección 9.2); NO "STORE:PRODUCT" del template
  description: string // ≤ 200 chars: título + variante
  price: number // ≥ 0, 2 decimales; precio de la VARIANTE en la currency del contexto
  quantity: 1 // SIEMPRE 1 (confirmado con Crowder)
  refundable: boolean // política del producto (products.refundable)
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
  // Line items del protocolo Crowder derivados de las respuestas `product`.
  // [] para forms sin productos (form-only) → retrocompatible. El refund parcial
  // reduce este array (mismo uuid determinístico → variante, sección 9.3/9.8).
  partnerItems: jsonb("partner_items")
    .$type<PartnerItem[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
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
  show: string | null
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

// submissions.answers[questionId] cuando la pregunta es `product`. Guarda el
// snapshot congelado al submit (patrón itemSnapshot) para que la submission sea
// estable aunque el catálogo cambie después (ver definition sección 8.1).
export type ProductPick = {
  productId: string
  variantId: string // variante elegida (la default si el producto es simple)
  quantity?: number
  snapshot: {
    title: string
    variantTitle: string | null // "M / Rojo" (null si producto simple)
    options: Record<string, string> | null
    sku: string | null // sku de la VARIANTE
    price: number | null // precio de la VARIANTE al submit
    currency: string | null
    imageUrl: string | null // variant.imageUrl ?? product.imageUrl al submit
  }
}
// max === 1 → un pick; max > 1 → array de picks.
export type ProductAnswer = ProductPick | ProductPick[]

// stock_reservations — hold de stock por (transaction, variante), append-only y
// auditable (decisión D5). La reserva NO descuenta variant.stock directo:
//   disponible(variante) = variant.stock − Σ(held de esa variante)
// Idempotencia por (transactionId, productId, variantId): variantId solo es
// único DENTRO del producto, así que sin productId dos productos de la misma
// transacción colisionarían (ver definition sección 9.3.1).
export const stockReservations = pgTable(
  "stock_reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull(), // FK lógico → products.id (variante embebida, D1)
    variantId: text("variant_id").notNull(), // id de la variante dentro del JSONB
    quantity: integer("quantity").notNull(),
    // "held" | "released" | "consumed" — text, validado en dominio
    status: text("status")
      .$type<"held" | "released" | "consumed">()
      .notNull()
      .default("held"),
    expiresAt: timestamp("expires_at", { withTimezone: true }), // del ack de purchaseReserved
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("stock_reservations_txn_product_variant_idx").on(
      t.transactionId,
      t.productId,
      t.variantId,
    ),
    // disponible(variante) = variant.stock − SUM(quantity where status='held')
    index("stock_reservations_variant_held_idx")
      .on(t.variantId)
      .where(sql`${t.status} = 'held'`),
  ],
)
