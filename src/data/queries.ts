import {
  mapCatAttachmentRow,
  mapCatPhotoRow,
  mapCatRow,
  mapCatTimelineRow,
  mapClinicalProcessDetailRow,
  mapClinicalProcessTypeRow,
  mapEventCategoryRow,
  mapEventSubcategoryRow,
  mapProfileRow,
} from "@/data/mappers";
import type { Session } from "@supabase/supabase-js";
import type {
  AttachmentFileKind,
  Cat,
  CatCard,
  CatDetail,
  ClinicalProcessType,
  ClinicalProcessDetail,
  CloseClinicalProcessInput,
  CreateClinicalProcessInput,
  CreateClinicalProcessTypeInput,
  CreateEventInput,
  CreateCategoryInput,
  CreateCatInput,
  CreateProcessEventInput,
  CreateSimpleEventInput,
  CreateSubcategoryInput,
  EventCostDraft,
  EventCostInput,
  EventCategory,
  ProcessEventKind,
  Profile,
  SetClinicalProcessTypeActiveStateInput,
  UpdateEventCostInput,
  UpdateClinicalProcessTypeInput,
  UpdateCatInput,
  VoidEventInput,
} from "@/domain/types";
import { supabase } from "@/lib/supabase/client";

export const authStateQueryKey = ["auth", "state"] as const;
export const currentProfileQueryKey = ["profile", "current"] as const;

export type AuthorizationState = {
  session: Session | null;
  isAuthorized: boolean;
};

const ATTACHMENTS_BUCKET = "attachments";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

function slugifyCode(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

async function getCurrentActorId() {
  const session = await getCurrentSession();

  if (!session) {
    throw new Error("Sesion no disponible.");
  }

  return session.user.id;
}

function sanitizeFileName(value: string) {
  const trimmed = value.trim();
  const normalized = trimmed.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const safe = normalized.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return safe.replace(/^-+|-+$/g, "") || "archivo";
}

function normalizeCatIds(catIds: string[]) {
  return Array.from(new Set(catIds.map((catId) => catId.trim()).filter(Boolean)));
}

function roundAmount(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeCurrencyCode(value?: string) {
  return (value?.trim().toUpperCase() || "MXN").slice(0, 3);
}

function normalizeOptionalDate(value?: string | null) {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function encodeProcessEventNotes(kind: ProcessEventKind, notes: string) {
  const normalizedNotes = notes.trim();
  return normalizedNotes ? `kind:${kind}\n\n${normalizedNotes}` : `kind:${kind}`;
}

function buildEventCostPayload(
  cost: EventCostInput | undefined,
  catIds: string[],
): {
  p_cost_mode: "none" | "per_cat" | "shared_total";
  p_currency_code: string;
  p_total_amount: number | null;
  p_per_cat_amounts: Array<{ cat_id: string; amount: number }>;
} {
  if (!cost || cost.mode === "none") {
    return {
      p_cost_mode: "none",
      p_currency_code: normalizeCurrencyCode(cost?.currency_code),
      p_total_amount: null,
      p_per_cat_amounts: [],
    };
  }

  if (cost.mode === "shared_total") {
    return {
      p_cost_mode: "shared_total",
      p_currency_code: normalizeCurrencyCode(cost.currency_code),
      p_total_amount: roundAmount(cost.total_amount),
      p_per_cat_amounts: [],
    };
  }

  const normalizedCatIds = normalizeCatIds(catIds);
  const amountMap = new Map(
    cost.per_cat_amounts.map((entry) => [entry.cat_id, roundAmount(entry.amount)]),
  );

  return {
    p_cost_mode: "per_cat",
    p_currency_code: normalizeCurrencyCode(cost.currency_code),
    p_total_amount: normalizedCatIds.reduce((sum, catId) => sum + (amountMap.get(catId) ?? 0), 0),
    p_per_cat_amounts: normalizedCatIds.map((catId) => ({
      cat_id: catId,
      amount: amountMap.get(catId) ?? 0,
    })),
  };
}

function buildAttachmentStoragePath(catId: string, fileName: string) {
  const safeName = sanitizeFileName(fileName);
  const uniqueToken = crypto.randomUUID();
  return `cats/${catId}/${uniqueToken}-${safeName}`;
}

function detectAttachmentFileKind(file: File): AttachmentFileKind {
  if (file.type.startsWith("image/")) {
    return "image";
  }

  if (
    file.type === "application/pdf" ||
    file.type.startsWith("text/") ||
    file.type.includes("document") ||
    file.type.includes("sheet") ||
    file.type.includes("presentation")
  ) {
    return "document";
  }

  return "other";
}

async function createSignedUrlMap(
  rows: Array<Record<string, unknown>>,
): Promise<Map<string, string>> {
  const rowsByBucket = new Map<string, string[]>();

  for (const row of rows) {
    const bucket = String(row.bucket);
    const path = String(row.storage_path);
    const current = rowsByBucket.get(bucket) ?? [];
    current.push(path);
    rowsByBucket.set(bucket, current);
  }

  const signedUrlMap = new Map<string, string>();

  await Promise.all(
    Array.from(rowsByBucket.entries()).map(async ([bucket, paths]) => {
      if (!paths.length) {
        return;
      }

      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

      if (error) {
        throw error;
      }

      for (const entry of data ?? []) {
        if (entry.path && entry.signedUrl) {
          signedUrlMap.set(`${bucket}:${entry.path}`, entry.signedUrl);
        }
      }
    }),
  );

  return signedUrlMap;
}

export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, is_active")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapProfileRow(data) : null;
}

export async function getAuthorizationStateForSession(
  session: Session | null,
): Promise<AuthorizationState> {
  if (!session) {
    return {
      session: null,
      isAuthorized: false,
    };
  }

  const { data, error } = await supabase
    .from("authorized_users")
    .select("user_id")
    .eq("user_id", session.user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    session,
    isAuthorized: Boolean(data),
  };
}

export async function getAuthorizationState(): Promise<AuthorizationState> {
  const session = await getCurrentSession();
  return getAuthorizationStateForSession(session);
}

async function listCatsByArchiveState(archived: boolean): Promise<CatCard[]> {
  const baseQuery = supabase
    .from("cats")
    .select("id, name, notes, birth_date, archived_at, created_at, updated_at")
    .order("name", { ascending: true });

  const { data, error } = archived
    ? await baseQuery.not("archived_at", "is", null)
    : await baseQuery.is("archived_at", null);

  if (error) {
    throw error;
  }

  const cats = (data ?? []).map(mapCatRow);
  const catIds = cats.map((cat) => cat.id);

  if (!catIds.length) {
    return [];
  }

  const { data: photoRows, error: photoError } = await supabase
    .from("attachments")
    .select("cat_id, bucket, storage_path")
    .in("cat_id", catIds)
    .eq("is_primary_for_cat", true)
    .eq("file_kind", "image")
    .is("removed_at", null);

  if (photoError) {
    throw photoError;
  }

  const signedUrlMap = await createSignedUrlMap(
    ((photoRows as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
      bucket: row.bucket,
      storage_path: row.storage_path,
    })),
  );

  const photoUrlByCatId = new Map<string, string>();

  for (const row of (photoRows as Array<Record<string, unknown>> | null) ?? []) {
    const key = `${String(row.bucket)}:${String(row.storage_path)}`;
    const signedUrl = signedUrlMap.get(key) ?? null;

    if (signedUrl) {
      photoUrlByCatId.set(String(row.cat_id), signedUrl);
    }
  }

  return cats.map((cat) => ({
    ...cat,
    primary_photo_url: photoUrlByCatId.get(cat.id) ?? null,
  }));
}

export function listActiveCats() {
  return listCatsByArchiveState(false);
}

export function listArchivedCats() {
  return listCatsByArchiveState(true);
}

export async function createCat(input: CreateCatInput): Promise<Cat> {
  const actorId = await getCurrentActorId();

  const { data, error } = await supabase
    .from("cats")
    .insert({
      name: input.name.trim(),
      notes: input.notes.trim() || null,
      created_by: actorId,
      updated_by: actorId,
    })
    .select("id, name, notes, birth_date, archived_at, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return mapCatRow(data);
}

export async function updateCat(catId: string, input: UpdateCatInput): Promise<Cat> {
  const actorId = await getCurrentActorId();

  const { data, error } = await supabase
    .from("cats")
    .update({
      name: input.name.trim(),
      notes: input.notes.trim() || null,
      birth_date: normalizeOptionalDate(input.birth_date),
      updated_by: actorId,
    })
    .eq("id", catId)
    .select("id, name, notes, birth_date, archived_at, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return mapCatRow(data);
}

export async function setCatArchivedState(catId: string, archived: boolean): Promise<Cat> {
  const actorId = await getCurrentActorId();

  const { data, error } = await supabase
    .from("cats")
    .update({
      archived_at: archived ? new Date().toISOString() : null,
      archived_by: archived ? actorId : null,
      updated_by: actorId,
    })
    .eq("id", catId)
    .select("id, name, notes, birth_date, archived_at, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return mapCatRow(data);
}

export async function deleteArchivedCat(catId: string): Promise<string> {
  const { data, error } = await supabase.rpc("delete_archived_cat", {
    p_cat_id: catId,
  });

  if (error) {
    throw error;
  }

  return String(data);
}

export async function getCatDetail(catId: string): Promise<CatDetail | null> {
  const [
    { data: catRow, error: catError },
    { data: photoRow, error: photoError },
    { data: attachmentRows, error: attachmentError },
    { data: timelineRows, error: timelineError },
    { data: costRow, error: costError },
  ] = await Promise.all([
    supabase
      .from("cats")
      .select("id, name, notes, birth_date, archived_at, created_at, updated_at")
      .eq("id", catId)
      .maybeSingle(),
    supabase
      .from("attachments")
      .select("id, bucket, storage_path, original_filename, mime_type, byte_size, created_at, caption")
      .eq("cat_id", catId)
      .eq("is_primary_for_cat", true)
      .eq("file_kind", "image")
      .is("removed_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .maybeSingle(),
    supabase
      .from("attachments")
      .select(
        "id, bucket, storage_path, original_filename, mime_type, byte_size, file_kind, caption, created_at, is_primary_for_cat",
      )
      .eq("cat_id", catId)
      .is("removed_at", null)
      .order("is_primary_for_cat", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase
      .from("events")
      .select(
        "id, title, notes, time_kind, event_at, created_at, category:event_categories(label), subcategory:event_subcategories(label), process:clinical_processes!events_process_id_fkey(id, title, opened_at, closed_at, closed_event_id, created_at, process_type:clinical_process_types(label)), event_cats!inner(cat_id), event_costs(mode, currency_code, total_amount), event_cat_costs(cat_id, amount)",
      )
      .eq("event_cats.cat_id", catId)
      .is("voided_at", null)
      .order("event_at", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("cat_cost_totals")
      .select("total_amount")
      .eq("cat_id", catId)
      .maybeSingle(),
  ]);

  if (catError) {
    throw catError;
  }

  if (photoError) {
    throw photoError;
  }

  if (attachmentError) {
    throw attachmentError;
  }

  if (timelineError) {
    throw timelineError;
  }

  if (costError) {
    throw costError;
  }

  if (!catRow) {
    return null;
  }

  const allAttachmentRows = [
    ...(photoRow ? [photoRow] : []),
    ...((attachmentRows as Array<Record<string, unknown>> | null) ?? []),
  ];
  const signedUrlMap = await createSignedUrlMap(allAttachmentRows);

  const primaryPhoto = photoRow
    ? mapCatPhotoRow(
        photoRow,
        signedUrlMap.get(`${String(photoRow.bucket)}:${String(photoRow.storage_path)}`) ?? null,
      )
    : null;

  return {
    ...mapCatRow(catRow),
    primary_photo: primaryPhoto,
    attachments: ((attachmentRows as Array<Record<string, unknown>> | null) ?? []).map((row) =>
      mapCatAttachmentRow(
        row,
        signedUrlMap.get(`${String(row.bucket)}:${String(row.storage_path)}`) ?? null,
      ),
    ),
    timeline: (timelineRows ?? []).map((row) =>
      mapCatTimelineRow(row as Record<string, unknown>, catId),
    ),
    cost_total_amount:
      costRow?.total_amount === 0 || costRow?.total_amount
        ? roundAmount(Number(costRow.total_amount))
        : null,
  };
}

type UploadAttachmentInput = {
  catId: string;
  file: File;
  isPrimaryForCat: boolean;
};

async function uploadCatAttachmentRow({
  catId,
  file,
  isPrimaryForCat,
}: UploadAttachmentInput): Promise<void> {
  const actorId = await getCurrentActorId();
  const storagePath = buildAttachmentStoragePath(catId, file.name);
  const fileKind = detectAttachmentFileKind(file);

  if (isPrimaryForCat && fileKind !== "image") {
    throw new Error("La foto principal debe ser una imagen.");
  }

  const { error: uploadError } = await supabase.storage.from(ATTACHMENTS_BUCKET).upload(storagePath, file, {
    contentType: file.type || undefined,
    upsert: false,
  });

  if (uploadError) {
    throw uploadError;
  }

  try {
    if (isPrimaryForCat) {
      const { error: clearPrimaryError } = await supabase
        .from("attachments")
        .update({
          is_primary_for_cat: false,
        })
        .eq("cat_id", catId)
        .eq("is_primary_for_cat", true)
        .is("removed_at", null);

      if (clearPrimaryError) {
        throw clearPrimaryError;
      }
    }

    const { error: insertError } = await supabase.from("attachments").insert({
      cat_id: catId,
      bucket: ATTACHMENTS_BUCKET,
      storage_path: storagePath,
      original_filename: file.name,
      mime_type: file.type || null,
      byte_size: file.size,
      file_kind: fileKind,
      is_primary_for_cat: isPrimaryForCat,
      uploaded_by: actorId,
    });

    if (insertError) {
      throw insertError;
    }
  } catch (error) {
    await supabase.storage.from(ATTACHMENTS_BUCKET).remove([storagePath]);
    throw error;
  }
}

export async function uploadCatPrimaryPhoto(catId: string, file: File): Promise<void> {
  return uploadCatAttachmentRow({
    catId,
    file,
    isPrimaryForCat: true,
  });
}

export async function uploadCatAttachment(catId: string, file: File): Promise<void> {
  return uploadCatAttachmentRow({
    catId,
    file,
    isPrimaryForCat: false,
  });
}

export async function listEventCategories(): Promise<EventCategory[]> {
  const [
    { data: categoryRows, error: categoryError },
    { data: subcategoryRows, error: subcategoryError },
  ] = await Promise.all([
    supabase
      .from("event_categories")
      .select("id, code, label, is_active, sort_order")
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true }),
    supabase
      .from("event_subcategories")
      .select("id, category_id, code, label, is_active, sort_order")
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true }),
  ]);

  if (categoryError) {
    throw categoryError;
  }

  if (subcategoryError) {
    throw subcategoryError;
  }

  const groupedSubcategories = new Map<string, ReturnType<typeof mapEventSubcategoryRow>[]>();

  for (const row of subcategoryRows ?? []) {
    const categoryId = String(row.category_id);
    const current = groupedSubcategories.get(categoryId) ?? [];
    current.push(mapEventSubcategoryRow(row));
    groupedSubcategories.set(categoryId, current);
  }

  return (categoryRows ?? []).map((row) =>
    mapEventCategoryRow(row, groupedSubcategories.get(String(row.id)) ?? []),
  );
}

export async function listClinicalProcessTypes(): Promise<ClinicalProcessType[]> {
  const { data, error } = await supabase
    .from("clinical_process_types")
    .select("id, code, label, is_active, sort_order")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapClinicalProcessTypeRow);
}

export async function createEventCategory(input: CreateCategoryInput): Promise<void> {
  const code = input.code?.trim() || slugifyCode(input.label);

  const { error } = await supabase.from("event_categories").insert({
    label: input.label.trim(),
    code,
  });

  if (error) {
    throw error;
  }
}

export async function createEventSubcategory(input: CreateSubcategoryInput): Promise<void> {
  const code = input.code?.trim() || slugifyCode(input.label);

  const { error } = await supabase.from("event_subcategories").insert({
    category_id: input.category_id,
    label: input.label.trim(),
    code,
  });

  if (error) {
    throw error;
  }
}

export async function createClinicalProcessType(
  input: CreateClinicalProcessTypeInput,
): Promise<void> {
  const code = input.code?.trim() || slugifyCode(input.label);

  const { error } = await supabase.from("clinical_process_types").insert({
    label: input.label.trim(),
    code,
  });

  if (error) {
    throw error;
  }
}

export async function updateClinicalProcessTypeLabel(
  input: UpdateClinicalProcessTypeInput,
): Promise<void> {
  const { error } = await supabase
    .from("clinical_process_types")
    .update({
      label: input.label.trim(),
    })
    .eq("id", input.id);

  if (error) {
    throw error;
  }
}

export async function setClinicalProcessTypeActiveState(
  input: SetClinicalProcessTypeActiveStateInput,
): Promise<void> {
  const { error } = await supabase
    .from("clinical_process_types")
    .update({
      is_active: input.is_active,
    })
    .eq("id", input.id);

  if (error) {
    throw error;
  }
}

export async function createEvent(input: CreateEventInput): Promise<void> {
  const catIds = normalizeCatIds(input.cat_ids);

  if (!catIds.length) {
    throw new Error("Selecciona al menos un gato para este evento.");
  }

  const costPayload = buildEventCostPayload(input.cost, catIds);

  const { error } = await supabase.rpc("create_event_with_costs", {
    p_title: input.title.trim(),
    p_notes: input.notes.trim() || null,
    p_event_at: input.event_at,
    p_category_id: input.category_id || null,
    p_subcategory_id: input.subcategory_id || null,
    p_cat_ids: catIds,
    ...costPayload,
  });

  if (error) {
    throw error;
  }
}

export async function createClinicalProcess(input: CreateClinicalProcessInput): Promise<string> {
  const { data, error } = await supabase.rpc("create_clinical_process", {
    p_cat_id: input.cat_id,
    p_process_type_id: input.process_type_id,
    p_title: input.title.trim(),
    p_notes: input.notes.trim() || null,
    p_opened_at: input.opened_at,
  });

  if (error) {
    throw error;
  }

  return String(data);
}

export async function getClinicalProcessDetail(
  processId: string,
): Promise<ClinicalProcessDetail | null> {
  const { data: processRow, error: processError } = await supabase
    .from("clinical_processes")
    .select(
      "id, cat_id, process_type_id, title, notes, opened_at, closed_at, closed_event_id, created_at, updated_at, process_type:clinical_process_types(label), cat:cats!inner(id, name, birth_date, archived_at)",
    )
    .eq("id", processId)
    .maybeSingle();

  if (processError) {
    throw processError;
  }

  if (!processRow) {
    return null;
  }

  const relatedCat = (processRow as Record<string, unknown>).cat as
    | Record<string, unknown>
    | Array<Record<string, unknown>>
    | null
    | undefined;

  const processCatId =
    Array.isArray(relatedCat) && relatedCat[0]?.id
      ? String(relatedCat[0].id)
      : !Array.isArray(relatedCat) && relatedCat?.id
        ? String(relatedCat.id)
        : String(processRow.cat_id);

  const { data: timelineRows, error: timelineError } = await supabase
    .from("events")
    .select(
      "id, title, notes, time_kind, event_at, created_at, category:event_categories(label), subcategory:event_subcategories(label), process:clinical_processes!events_process_id_fkey(id, title, opened_at, closed_at, closed_event_id, created_at, process_type:clinical_process_types(label)), event_costs(mode, currency_code, total_amount), event_cat_costs(cat_id, amount)",
    )
    .eq("process_id", processId)
    .is("voided_at", null)
    .order("event_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (timelineError) {
    throw timelineError;
  }

  return mapClinicalProcessDetailRow(
    processRow as Record<string, unknown>,
    ((timelineRows ?? []) as Record<string, unknown>[]).map((row) => ({
      ...row,
      event_cat_costs: Array.isArray(row.event_cat_costs)
        ? row.event_cat_costs.filter((item) => String(item.cat_id) === processCatId)
        : [],
    })),
  );
}

export async function createProcessEvent(input: CreateProcessEventInput): Promise<string> {
  const costPayload = buildEventCostPayload(
    input.cost,
    input.cost?.mode === "per_cat"
      ? input.cost.per_cat_amounts.map((entry) => entry.cat_id)
      : [],
  );

  const { data, error } = await supabase.rpc("create_process_event", {
    p_process_id: input.process_id,
    p_title: input.title.trim(),
    p_notes: encodeProcessEventNotes(input.kind, input.notes),
    p_event_at: input.event_at,
    ...costPayload,
  });

  if (error) {
    throw error;
  }

  return String(data);
}

export async function closeClinicalProcess(input: CloseClinicalProcessInput): Promise<string> {
  const { data, error } = await supabase.rpc("close_clinical_process", {
    p_process_id: input.process_id,
    p_title: input.title.trim(),
    p_notes: input.notes.trim() || null,
    p_event_at: input.event_at,
  });

  if (error) {
    throw error;
  }

  return String(data);
}

export async function createSimpleEvent(input: CreateSimpleEventInput): Promise<void> {
  return createEvent({
    cat_ids: [input.cat_id],
    title: input.title,
    notes: input.notes,
    event_at: input.event_at,
    category_id: input.category_id,
    subcategory_id: input.subcategory_id,
    cost: input.cost,
  });
}

export async function getEventCostDraft(eventId: string): Promise<EventCostDraft> {
  const [
    { data: eventRow, error: eventError },
    { data: catRows, error: catError },
    { data: costRow, error: costError },
    { data: allocationRows, error: allocationError },
  ] = await Promise.all([
    supabase.from("events").select("id").eq("id", eventId).is("voided_at", null).maybeSingle(),
    supabase
      .from("event_cats")
      .select("cat_id, cats!inner(id, name)")
      .eq("event_id", eventId)
      .order("cat_id", { ascending: true }),
    supabase
      .from("event_costs")
      .select("mode, currency_code, total_amount")
      .eq("event_id", eventId)
      .maybeSingle(),
    supabase
      .from("event_cat_costs")
      .select("cat_id, amount")
      .eq("event_id", eventId),
  ]);

  if (eventError) {
    throw eventError;
  }

  if (catError) {
    throw catError;
  }

  if (costError) {
    throw costError;
  }

  if (allocationError) {
    throw allocationError;
  }

  if (!eventRow) {
    throw new Error("No fue posible encontrar este evento.");
  }

  const allocationMap = new Map(
    (allocationRows ?? []).map((row) => [
      String(row.cat_id),
      typeof row.amount === "number" ? row.amount : Number(row.amount ?? 0),
    ]),
  );

  const mode =
    costRow?.mode === "per_cat" || costRow?.mode === "shared_total" ? costRow.mode : "none";

  return {
    event_id: String(eventRow.id),
    mode,
    currency_code: costRow?.currency_code ? String(costRow.currency_code) : "MXN",
    total_amount:
      costRow?.total_amount === 0 || costRow?.total_amount
        ? Number(costRow.total_amount)
        : null,
    cat_amounts: (catRows ?? []).map((row) => {
      const relatedCat = Array.isArray(row.cats) ? row.cats[0] : row.cats;
      const relatedCatId = String(row.cat_id);

      return {
        cat_id: relatedCatId,
        cat_name: relatedCat?.name ? String(relatedCat.name) : "Gato",
        amount: allocationMap.has(relatedCatId) ? allocationMap.get(relatedCatId) ?? null : null,
      };
    }),
  };
}

export async function updateEventCost(input: UpdateEventCostInput): Promise<void> {
  const costPayload = buildEventCostPayload(
    input.cost,
    input.cost.mode === "per_cat"
      ? input.cost.per_cat_amounts.map((entry) => entry.cat_id)
      : [],
  );

  const { error } = await supabase.rpc("update_event_costs", {
    p_event_id: input.event_id,
    ...costPayload,
  });

  if (error) {
    throw error;
  }
}

export async function voidEvent(input: VoidEventInput): Promise<string> {
  const { data, error } = await supabase.rpc("void_event", {
    p_event_id: input.event_id,
  });

  if (error) {
    throw error;
  }

  return String(data);
}
