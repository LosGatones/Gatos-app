export type EventTimeKind = "occurred" | "scheduled";

export type EventCostMode = "none" | "per_cat" | "shared_total";

export type AttachmentFileKind = "image" | "document" | "other";

export type ProcessEventKind =
  | "consulta"
  | "estudio"
  | "medicamento"
  | "dieta"
  | "nota";

export type Profile = {
  id: string;
  display_name: string | null;
  is_active: boolean;
};

export type Cat = {
  id: string;
  name: string;
  notes: string | null;
  birth_date: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CatCard = Cat & {
  primary_photo_url: string | null;
};

export type CatPhoto = {
  id: string;
  bucket: string;
  storage_path: string;
  original_filename: string;
  mime_type: string | null;
  byte_size: number;
  created_at: string;
  caption: string | null;
  signed_url: string | null;
};

export type CatAttachment = {
  id: string;
  bucket: string;
  storage_path: string;
  original_filename: string;
  mime_type: string | null;
  byte_size: number;
  file_kind: AttachmentFileKind;
  caption: string | null;
  created_at: string;
  is_primary_for_cat: boolean;
  signed_url: string | null;
};

export type CatTimelineItem = {
  id: string;
  title: string;
  notes: string | null;
  time_kind: EventTimeKind;
  event_at: string;
  created_at: string;
  category_label: string | null;
  subcategory_label: string | null;
  process_id: string | null;
  process_title: string | null;
  process_type_label: string | null;
  process_opened_at: string | null;
  process_closed_at: string | null;
  process_closed_event_id: string | null;
  process_created_at: string | null;
  is_process_header: boolean;
  process_event_kind: ProcessEventKind | null;
  cost: EventCostSummary | null;
};

export type CatDetail = Cat & {
  primary_photo: CatPhoto | null;
  attachments: CatAttachment[];
  timeline: CatTimelineItem[];
  cost_total_amount: number | null;
};

export type ClinicalProcess = {
  id: string;
  cat_id: string;
  process_type_id: string;
  process_type_label: string | null;
  title: string;
  notes: string | null;
  opened_at: string;
  closed_at: string | null;
  closed_event_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ProcessTimelineItem = {
  id: string;
  title: string;
  notes: string | null;
  time_kind: EventTimeKind;
  event_at: string;
  created_at: string;
  category_label: string | null;
  subcategory_label: string | null;
  process_id: string;
  process_title: string | null;
  process_type_label: string | null;
  process_opened_at: string;
  process_closed_at: string | null;
  process_closed_event_id: string | null;
  process_created_at: string;
  is_process_header: boolean;
  process_event_kind: ProcessEventKind | null;
  cost: EventCostSummary | null;
};

export type ClinicalProcessDetail = ClinicalProcess & {
  cat: Pick<Cat, "id" | "name" | "archived_at">;
  timeline: ProcessTimelineItem[];
};

export type EventSubcategory = {
  id: string;
  category_id: string;
  code: string;
  label: string;
  is_active: boolean;
  sort_order: number;
};

export type EventCategory = {
  id: string;
  code: string;
  label: string;
  is_active: boolean;
  sort_order: number;
  subcategories: EventSubcategory[];
};

export type ClinicalProcessType = {
  id: string;
  code: string;
  label: string;
  is_active: boolean;
  sort_order: number;
};

export type CreateCatInput = {
  name: string;
  notes: string;
};

export type UpdateCatInput = {
  name: string;
  notes: string;
  birth_date: string | null;
};

export type CreateCategoryInput = {
  label: string;
  code?: string;
};

export type CreateSubcategoryInput = {
  category_id: string;
  label: string;
  code?: string;
};

export type CreateEventInput = {
  cat_ids: string[];
  title: string;
  notes: string;
  event_at: string;
  category_id?: string | null;
  subcategory_id?: string | null;
  cost?: EventCostInput;
};

export type CreateSimpleEventInput = {
  cat_id: string;
  title: string;
  notes: string;
  event_at: string;
  category_id?: string | null;
  subcategory_id?: string | null;
  cost?: EventCostInput;
};

export type CreateClinicalProcessInput = {
  cat_id: string;
  process_type_id: string;
  title: string;
  notes: string;
  opened_at: string;
};

export type CreateClinicalProcessTypeInput = {
  label: string;
  code?: string;
};

export type UpdateClinicalProcessTypeInput = {
  id: string;
  label: string;
};

export type SetClinicalProcessTypeActiveStateInput = {
  id: string;
  is_active: boolean;
};

export type CreateProcessEventInput = {
  process_id: string;
  kind: ProcessEventKind;
  title: string;
  notes: string;
  event_at: string;
  cost?: EventCostInput;
};

export type CloseClinicalProcessInput = {
  process_id: string;
  title: string;
  notes: string;
  event_at: string;
};

export type EventCostAllocationInput = {
  cat_id: string;
  amount: number;
};

export type EventCostInput =
  | {
      mode: "none";
      currency_code?: string;
    }
  | {
      mode: "per_cat";
      currency_code?: string;
      per_cat_amounts: EventCostAllocationInput[];
    }
  | {
      mode: "shared_total";
      currency_code?: string;
      total_amount: number;
    };

export type UpdateEventCostInput = {
  event_id: string;
  cost: EventCostInput;
};

export type VoidEventInput = {
  event_id: string;
};

export type EventCostSummary = {
  mode: EventCostMode;
  currency_code: string | null;
  total_amount: number | null;
  cat_amount: number | null;
};

export type EventCostDraft = {
  event_id: string;
  mode: EventCostMode;
  currency_code: string;
  total_amount: number | null;
  cat_amounts: Array<{
    cat_id: string;
    cat_name: string;
    amount: number | null;
  }>;
};
