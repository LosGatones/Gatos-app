import type {
  CatAttachment,
  Cat,
  EventCostSummary,
  CatPhoto,
  CatTimelineItem,
  EventCategory,
  EventSubcategory,
  Profile,
} from "@/domain/types";

function pickSingleRelation(
  value: Record<string, unknown> | Array<Record<string, unknown>> | null | undefined,
) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function mapEventCostSummary(
  eventCostValue: Record<string, unknown> | Array<Record<string, unknown>> | null | undefined,
  eventCatCostValue: unknown,
  currentCatId: string,
): EventCostSummary | null {
  const eventCost = pickSingleRelation(
    eventCostValue as Record<string, unknown> | Array<Record<string, unknown>> | null | undefined,
  );

  if (!eventCost) {
    return null;
  }

  const catCostRows = Array.isArray(eventCatCostValue)
    ? (eventCatCostValue as Array<Record<string, unknown>>)
    : [];

  const matchingCatCost = catCostRows.find((row) => String(row.cat_id) === currentCatId);
  const mode = eventCost.mode;

  return {
    mode: mode === "per_cat" || mode === "shared_total" ? mode : "none",
    currency_code: eventCost.currency_code ? String(eventCost.currency_code) : null,
    total_amount:
      typeof eventCost.total_amount === "number"
        ? eventCost.total_amount
        : eventCost.total_amount
          ? Number(eventCost.total_amount)
          : null,
    cat_amount:
      matchingCatCost?.amount === 0 || matchingCatCost?.amount
        ? Number(matchingCatCost.amount)
        : null,
  };
}

export function mapProfileRow(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    display_name: row.display_name ? String(row.display_name) : null,
    is_active: Boolean(row.is_active),
  };
}

export function mapCatRow(row: Record<string, unknown>): Cat {
  return {
    id: String(row.id),
    name: String(row.name),
    notes: row.notes ? String(row.notes) : null,
    archived_at: row.archived_at ? String(row.archived_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function mapCatPhotoRow(
  row: Record<string, unknown>,
  signedUrl: string | null,
): CatPhoto {
  return {
    id: String(row.id),
    bucket: String(row.bucket),
    storage_path: String(row.storage_path),
    original_filename: String(row.original_filename),
    mime_type: row.mime_type ? String(row.mime_type) : null,
    byte_size: Number(row.byte_size ?? 0),
    created_at: String(row.created_at),
    caption: row.caption ? String(row.caption) : null,
    signed_url: signedUrl,
  };
}

export function mapCatAttachmentRow(
  row: Record<string, unknown>,
  signedUrl: string | null,
): CatAttachment {
  return {
    id: String(row.id),
    bucket: String(row.bucket),
    storage_path: String(row.storage_path),
    original_filename: String(row.original_filename),
    mime_type: row.mime_type ? String(row.mime_type) : null,
    byte_size: Number(row.byte_size ?? 0),
    file_kind:
      row.file_kind === "image" || row.file_kind === "document" ? row.file_kind : "other",
    caption: row.caption ? String(row.caption) : null,
    created_at: String(row.created_at),
    is_primary_for_cat: Boolean(row.is_primary_for_cat),
    signed_url: signedUrl,
  };
}

export function mapCatTimelineRow(
  row: Record<string, unknown>,
  currentCatId: string,
): CatTimelineItem {
  const category = pickSingleRelation(
    row.category as Record<string, unknown> | Array<Record<string, unknown>> | null,
  );
  const subcategory = pickSingleRelation(
    row.subcategory as Record<string, unknown> | Array<Record<string, unknown>> | null,
  );
  const process = pickSingleRelation(
    row.process as Record<string, unknown> | Array<Record<string, unknown>> | null,
  );

  return {
    id: String(row.id),
    title: String(row.title),
    notes: row.notes ? String(row.notes) : null,
    time_kind: row.time_kind === "scheduled" ? "scheduled" : "occurred",
    event_at: String(row.event_at),
    created_at: String(row.created_at),
    category_label: category?.label ? String(category.label) : null,
    subcategory_label: subcategory?.label ? String(subcategory.label) : null,
    process_id: process?.id ? String(process.id) : null,
    process_title: process?.title ? String(process.title) : null,
    cost: mapEventCostSummary(
      row.event_costs as Record<string, unknown> | Array<Record<string, unknown>> | null,
      row.event_cat_costs,
      currentCatId,
    ),
  };
}

export function mapEventSubcategoryRow(row: Record<string, unknown>): EventSubcategory {
  return {
    id: String(row.id),
    category_id: String(row.category_id),
    code: String(row.code),
    label: String(row.label),
    is_active: Boolean(row.is_active),
    sort_order: Number(row.sort_order ?? 0),
  };
}

export function mapEventCategoryRow(
  row: Record<string, unknown>,
  subcategories: EventSubcategory[],
): EventCategory {
  return {
    id: String(row.id),
    code: String(row.code),
    label: String(row.label),
    is_active: Boolean(row.is_active),
    sort_order: Number(row.sort_order ?? 0),
    subcategories,
  };
}
