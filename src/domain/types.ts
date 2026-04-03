export type EventTimeKind = "occurred" | "scheduled";

export type EventCostMode = "none" | "per_cat" | "shared_total";

export type AttachmentFileKind = "image" | "document" | "other";

export type Profile = {
  id: string;
  display_name: string | null;
  is_active: boolean;
};

export type Cat = {
  id: string;
  name: string;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
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
  cost: EventCostSummary | null;
};

export type CatDetail = Cat & {
  primary_photo: CatPhoto | null;
  attachments: CatAttachment[];
  timeline: CatTimelineItem[];
  cost_total_amount: number | null;
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

export type CreateCatInput = {
  name: string;
  notes: string;
};

export type UpdateCatInput = {
  name: string;
  notes: string;
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
