import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import type { EventCostInput, ProcessEventKind } from "@/domain/types";
import {
  createClinicalProcess,
  createEvent,
  getCatDetail,
  getEventCostDraft,
  listActiveCats,
  listClinicalProcessTypes,
  listEventCategories,
  setCatArchivedState,
  updateEventCost,
  updateCat,
  uploadCatAttachment,
  uploadCatPrimaryPhoto,
  voidEvent,
} from "@/data/queries";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

function formatMoney(amount: number, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function toDateTimeLocalValue(date: Date) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function parseAmount(value: string, label: string) {
  const normalized = value.trim().replace(",", ".");

  if (!normalized) {
    throw new Error(`Completa ${label.toLowerCase()}.`);
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} debe ser un numero igual o mayor a 0.`);
  }

  return Math.round(parsed * 100) / 100;
}

function buildPerCatMap(catIds: string[], current: Record<string, string>) {
  return catIds.reduce<Record<string, string>>((next, catId) => {
    next[catId] = current[catId] ?? "";
    return next;
  }, {});
}

function getProcessKindLabel(kind: ProcessEventKind | null) {
  if (!kind) {
    return null;
  }

  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function formatDateOnly(date: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long",
  }).format(new Date(`${date}T00:00:00`));
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
  }).format(new Date(date));
}

function formatMonthLabel(date: string) {
  return new Intl.DateTimeFormat("es-MX", {
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

function formatFeedDay(date: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
  }).format(new Date(date));
}

function formatFeedMonth(date: string) {
  return new Intl.DateTimeFormat("es-MX", {
    month: "short",
  }).format(new Date(date));
}

function getBirthdayMetrics(birthDate: string | null) {
  if (!birthDate) {
    return null;
  }

  const [year, month, day] = birthDate.split("-").map((value) => Number(value));

  if (!year || !month || !day) {
    return null;
  }

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const birthdayThisYear = new Date(todayStart.getFullYear(), month - 1, day);

  if (month === 2 && day === 29 && birthdayThisYear.getMonth() !== 1) {
    birthdayThisYear.setMonth(1, 28);
  }

  let nextBirthday = birthdayThisYear;

  if (birthdayThisYear < todayStart) {
    nextBirthday = new Date(todayStart.getFullYear() + 1, month - 1, day);

    if (month === 2 && day === 29 && nextBirthday.getMonth() !== 1) {
      nextBirthday.setMonth(1, 28);
    }
  }

  let age = todayStart.getFullYear() - year;
  const hasHadBirthdayThisYear =
    todayStart.getMonth() > birthdayThisYear.getMonth() ||
    (todayStart.getMonth() === birthdayThisYear.getMonth() &&
      todayStart.getDate() >= birthdayThisYear.getDate());

  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }

  if (nextBirthday.getTime() === todayStart.getTime()) {
    return {
      age: Math.max(age, 0),
      nextBirthdayLabel: "Hoy cumple años",
    };
  }

  let cursor = new Date(todayStart);
  let monthsUntilBirthday = 0;

  while (true) {
    const nextMonthCursor = new Date(cursor);
    nextMonthCursor.setMonth(nextMonthCursor.getMonth() + 1);

    if (nextMonthCursor <= nextBirthday) {
      cursor = nextMonthCursor;
      monthsUntilBirthday += 1;
      continue;
    }

    break;
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntilBirthday = Math.round((nextBirthday.getTime() - cursor.getTime()) / msPerDay);

  return {
    age: Math.max(age, 0),
    nextBirthdayLabel: `${monthsUntilBirthday} meses y ${Math.max(daysUntilBirthday, 0)} días`,
  };
}

export function CatDetailRoute() {
  const params = useParams();
  const catId = params.catId;
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [title, setTitle] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [eventAt, setEventAt] = useState(() => toDateTimeLocalValue(new Date()));
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [selectedRelatedCatIds, setSelectedRelatedCatIds] = useState<string[]>([]);
  const [catError, setCatError] = useState<string | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);
  const [processTitle, setProcessTitle] = useState("");
  const [processNotes, setProcessNotes] = useState("");
  const [processTypeId, setProcessTypeId] = useState("");
  const [processOpenedAt, setProcessOpenedAt] = useState(() => toDateTimeLocalValue(new Date()));
  const [processError, setProcessError] = useState<string | null>(null);
  const [costEnabled, setCostEnabled] = useState(false);
  const [costMode, setCostMode] = useState<"per_cat" | "shared_total">("shared_total");
  const [sharedTotalAmount, setSharedTotalAmount] = useState("");
  const [perCatAmounts, setPerCatAmounts] = useState<Record<string, string>>({});
  const [primaryPhotoError, setPrimaryPhotoError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [primaryPhotoFile, setPrimaryPhotoFile] = useState<File | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [editingCostEventId, setEditingCostEventId] = useState<string | null>(null);
  const [editingCostError, setEditingCostError] = useState<string | null>(null);
  const [editingCostEnabled, setEditingCostEnabled] = useState(false);
  const [editingCostMode, setEditingCostMode] = useState<"per_cat" | "shared_total">(
    "shared_total",
  );
  const [editingSharedTotalAmount, setEditingSharedTotalAmount] = useState("");
  const [editingPerCatAmounts, setEditingPerCatAmounts] = useState<Record<string, string>>({});
  const [timelineActionError, setTimelineActionError] = useState<string | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  const catDetailQuery = useQuery({
    queryKey: ["cats", "detail", catId],
    queryFn: () => getCatDetail(catId ?? ""),
    enabled: Boolean(catId),
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories", "all"],
    queryFn: listEventCategories,
  });

  const processTypesQuery = useQuery({
    queryKey: ["process-types", "all"],
    queryFn: listClinicalProcessTypes,
  });

  const activeCatsQuery = useQuery({
    queryKey: ["cats", "active"],
    queryFn: listActiveCats,
  });

  const eventCostDraftQuery = useQuery({
    queryKey: ["events", "cost-draft", editingCostEventId],
    queryFn: () => getEventCostDraft(editingCostEventId ?? ""),
    enabled: Boolean(editingCostEventId),
  });

  useEffect(() => {
    if (!catDetailQuery.data) {
      return;
    }

    setName(catDetailQuery.data.name);
    setNotes(catDetailQuery.data.notes ?? "");
    setBirthDate(catDetailQuery.data.birth_date ?? "");
  }, [catDetailQuery.data]);

  useEffect(() => {
    const activeTypes = processTypesQuery.data?.filter((type) => type.is_active) ?? [];

    if (!activeTypes.length) {
      setProcessTypeId("");
      return;
    }

    setProcessTypeId((current) =>
      current && activeTypes.some((type) => type.id === current) ? current : activeTypes[0]?.id ?? "",
    );
  }, [processTypesQuery.data]);

  const filteredSubcategories = useMemo(() => {
    if (!categoryId) {
      return [];
    }

    return categoriesQuery.data?.find((category) => category.id === categoryId)?.subcategories ?? [];
  }, [categoriesQuery.data, categoryId]);

  const activeProcessTypes = useMemo(
    () => processTypesQuery.data?.filter((type) => type.is_active) ?? [],
    [processTypesQuery.data],
  );

  const relatedCatOptions = useMemo(() => {
    return (activeCatsQuery.data ?? []).filter((cat) => cat.id !== catId);
  }, [activeCatsQuery.data, catId]);

  const selectedCatIds = useMemo(() => {
    return [catId ?? "", ...selectedRelatedCatIds].filter(Boolean);
  }, [catId, selectedRelatedCatIds]);

  const selectedCats = useMemo(() => {
    if (!catDetailQuery.data) {
      return [];
    }

    const catById = new Map(
      [catDetailQuery.data, ...(activeCatsQuery.data ?? [])].map((cat) => [cat.id, cat]),
    );

    return selectedCatIds.map((selectedCatId) => ({
      id: selectedCatId,
      name: catById.get(selectedCatId)?.name ?? "Gato",
    }));
  }, [activeCatsQuery.data, catDetailQuery.data, selectedCatIds]);

  useEffect(() => {
    setPerCatAmounts((current) => buildPerCatMap(selectedCatIds, current));
  }, [selectedCatIds]);

  useEffect(() => {
    if (!eventCostDraftQuery.data) {
      return;
    }

    const draft = eventCostDraftQuery.data;
    const hasVisibleCost =
      draft.mode !== "none" &&
      ((draft.total_amount ?? 0) > 0 || draft.cat_amounts.some((item) => (item.amount ?? 0) > 0));

    setEditingCostEnabled(hasVisibleCost);
    setEditingCostMode(draft.mode === "per_cat" ? "per_cat" : "shared_total");
    setEditingSharedTotalAmount(
      draft.mode === "shared_total" && draft.total_amount !== null ? String(draft.total_amount) : "",
    );
    setEditingPerCatAmounts(
      draft.cat_amounts.reduce<Record<string, string>>((next, item) => {
        next[item.cat_id] = item.amount === null ? "" : String(item.amount);
        return next;
      }, {}),
    );
    setEditingCostError(null);
  }, [eventCostDraftQuery.data]);

  const updateCatMutation = useMutation({
    mutationFn: (input: { name: string; notes: string; birth_date: string | null }) =>
      updateCat(catId ?? "", input),
    onSuccess: async () => {
      setCatError(null);
      await queryClient.invalidateQueries({ queryKey: ["cats"] });
      await queryClient.invalidateQueries({ queryKey: ["cats", "detail", catId] });
    },
    onError: (error: Error) => {
      setCatError(error.message);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (archived: boolean) => setCatArchivedState(catId ?? "", archived),
    onSuccess: async () => {
      setCatError(null);
      await queryClient.invalidateQueries({ queryKey: ["cats"] });
      await queryClient.invalidateQueries({ queryKey: ["cats", "detail", catId] });
    },
    onError: (error: Error) => {
      setCatError(error.message);
    },
  });

  const createProcessMutation = useMutation({
    mutationFn: createClinicalProcess,
    onSuccess: async () => {
      setProcessTitle("");
      setProcessNotes("");
      setProcessTypeId("");
      setProcessOpenedAt(toDateTimeLocalValue(new Date()));
      setProcessError(null);
      await queryClient.invalidateQueries({ queryKey: ["cats"] });
      await queryClient.invalidateQueries({ queryKey: ["cats", "detail"] });
      await queryClient.invalidateQueries({ queryKey: ["cats", "detail", catId] });
    },
    onError: (error: Error) => {
      setProcessError(error.message);
    },
  });

  const createEventMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: async () => {
      setTitle("");
      setEventNotes("");
      setEventAt(toDateTimeLocalValue(new Date()));
      setCategoryId("");
      setSubcategoryId("");
      setSelectedRelatedCatIds([]);
      setCostEnabled(false);
      setCostMode("shared_total");
      setSharedTotalAmount("");
      setPerCatAmounts({});
      setEventError(null);
      await queryClient.invalidateQueries({ queryKey: ["cats"] });
      await queryClient.invalidateQueries({ queryKey: ["cats", "detail"] });
      await queryClient.invalidateQueries({ queryKey: ["cats", "detail", catId] });
    },
    onError: (error: Error) => {
      setEventError(error.message);
    },
  });

  const updateEventCostMutation = useMutation({
    mutationFn: updateEventCost,
    onSuccess: async () => {
      setEditingCostError(null);
      setEditingCostEventId(null);
      await queryClient.invalidateQueries({ queryKey: ["cats"] });
      await queryClient.invalidateQueries({ queryKey: ["cats", "detail"] });
      await queryClient.invalidateQueries({ queryKey: ["cats", "detail", catId] });
      await queryClient.invalidateQueries({ queryKey: ["processes"] });
    },
    onError: (error: Error) => {
      setEditingCostError(error.message);
    },
  });

  const voidEventMutation = useMutation({
    mutationFn: voidEvent,
    onSuccess: async () => {
      setTimelineActionError(null);
      setDeletingEventId(null);
      setEditingCostEventId(null);
      await queryClient.invalidateQueries({ queryKey: ["cats"] });
      await queryClient.invalidateQueries({ queryKey: ["cats", "detail"] });
      await queryClient.invalidateQueries({ queryKey: ["cats", "detail", catId] });
      await queryClient.invalidateQueries({ queryKey: ["processes"] });
    },
    onError: (error: Error) => {
      setTimelineActionError(error.message);
    },
  });

  const uploadPrimaryPhotoMutation = useMutation({
    mutationFn: (file: File) => uploadCatPrimaryPhoto(catId ?? "", file),
    onSuccess: async () => {
      setPrimaryPhotoError(null);
      setPrimaryPhotoFile(null);
      await queryClient.invalidateQueries({ queryKey: ["cats", "detail", catId] });
    },
    onError: (error: Error) => {
      setPrimaryPhotoError(error.message);
    },
  });

  const uploadAttachmentMutation = useMutation({
    mutationFn: (file: File) => uploadCatAttachment(catId ?? "", file),
    onSuccess: async () => {
      setAttachmentError(null);
      setAttachmentFile(null);
      await queryClient.invalidateQueries({ queryKey: ["cats", "detail", catId] });
    },
    onError: (error: Error) => {
      setAttachmentError(error.message);
    },
  });

  function buildCreateCostInput(): EventCostInput | undefined {
    if (!costEnabled) {
      return undefined;
    }

    if (costMode === "shared_total") {
      return {
        mode: "shared_total",
        currency_code: "MXN",
        total_amount: parseAmount(sharedTotalAmount, "el total compartido"),
      };
    }

    return {
      mode: "per_cat",
      currency_code: "MXN",
      per_cat_amounts: selectedCats.map((selectedCat) => ({
        cat_id: selectedCat.id,
        amount: parseAmount(perCatAmounts[selectedCat.id] ?? "", `el costo de ${selectedCat.name}`),
      })),
    };
  }

  function buildEditingCostInput(): EventCostInput {
    if (!eventCostDraftQuery.data || !editingCostEnabled) {
      return { mode: "none", currency_code: "MXN" };
    }

    if (editingCostMode === "shared_total") {
      return {
        mode: "shared_total",
        currency_code: eventCostDraftQuery.data.currency_code,
        total_amount: parseAmount(editingSharedTotalAmount, "el total compartido"),
      };
    }

    return {
      mode: "per_cat",
      currency_code: eventCostDraftQuery.data.currency_code,
      per_cat_amounts: eventCostDraftQuery.data.cat_amounts.map((item) => ({
        cat_id: item.cat_id,
        amount: parseAmount(editingPerCatAmounts[item.cat_id] ?? "", `el costo de ${item.cat_name}`),
      })),
    };
  }

  function handleCatSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCatError(null);
    updateCatMutation.mutate({ name, notes, birth_date: birthDate || null });
  }

  function handleProcessSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProcessError(null);
    createProcessMutation.mutate({
      cat_id: catId ?? "",
      process_type_id: processTypeId,
      title: processTitle,
      notes: processNotes,
      opened_at: new Date(processOpenedAt).toISOString(),
    });
  }

  function handleEventSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEventError(null);

    try {
      createEventMutation.mutate({
        cat_ids: selectedCatIds,
        title,
        notes: eventNotes,
        event_at: new Date(eventAt).toISOString(),
        category_id: categoryId || null,
        subcategory_id: subcategoryId || null,
        cost: buildCreateCostInput(),
      });
    } catch (error) {
      setEventError(error instanceof Error ? error.message : "No fue posible preparar el costo.");
    }
  }

  function handleEditCostSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingCostEventId) {
      return;
    }

    setEditingCostError(null);

    try {
      updateEventCostMutation.mutate({
        event_id: editingCostEventId,
        cost: buildEditingCostInput(),
      });
    } catch (error) {
      setEditingCostError(
        error instanceof Error ? error.message : "No fue posible preparar este costo.",
      );
    }
  }

  function handlePrimaryPhotoSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!primaryPhotoFile) {
      setPrimaryPhotoError("Selecciona una imagen para continuar.");
      return;
    }

    setPrimaryPhotoError(null);
    uploadPrimaryPhotoMutation.mutate(primaryPhotoFile);
  }

  function handleAttachmentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!attachmentFile) {
      setAttachmentError("Selecciona un archivo para continuar.");
      return;
    }

    setAttachmentError(null);
    uploadAttachmentMutation.mutate(attachmentFile);
  }

  function handleDeleteEvent(eventId: string) {
    const confirmed = window.confirm(
      "Este registro se ocultara del timeline y dejara de contar en costos, pero seguira en la bitacora interna. ¿Quieres eliminarlo?",
    );

    if (!confirmed) {
      return;
    }

    setTimelineActionError(null);
    setDeletingEventId(eventId);
    voidEventMutation.mutate({ event_id: eventId });
  }

  if (!catId) {
    return <Navigate to="/cats" replace />;
  }

  if (catDetailQuery.isLoading) {
    return (
      <section className="page">
        <div className="panel">
          <p className="muted">Cargando detalle...</p>
        </div>
      </section>
    );
  }

  if (catDetailQuery.isError) {
    return (
      <section className="page">
        <div className="panel">
          <p className="error">No fue posible cargar este gato.</p>
        </div>
      </section>
    );
  }

  if (!catDetailQuery.data) {
    return (
      <section className="page">
        <div className="panel">
          <h1>Gato no encontrado</h1>
          <p className="muted">Este registro no existe o ya no esta disponible.</p>
        </div>
      </section>
    );
  }

  const cat = catDetailQuery.data;
  const isArchived = Boolean(cat.archived_at);
  const showCostTotal = (cat.cost_total_amount ?? 0) > 0;
  const birthdayMetrics = getBirthdayMetrics(cat.birth_date);
  const openProcessCount = cat.timeline.filter(
    (item) => item.is_process_header && !item.process_closed_at,
  ).length;
  const timelineCountLabel = `${cat.timeline.length} ${cat.timeline.length === 1 ? "entrada" : "entradas"} visibles`;
  const latestTimelineEntry = cat.timeline[0] ?? null;
  const timelineGroups = cat.timeline.reduce<
    Array<{
      key: string;
      label: string;
      items: typeof cat.timeline;
    }>
  >((groups, item) => {
    const date = new Date(item.event_at);
    const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
    const current = groups[groups.length - 1];

    if (current?.key === key) {
      current.items.push(item);
      return groups;
    }

    groups.push({
      key,
      label: formatMonthLabel(item.event_at),
      items: [item],
    });

    return groups;
  }, []);

  return (
    <section className="page">
      <div className="panel stack stack--airy surface-hero cat-detail-shell cat-detail-shell--profile">
        <div className="detail-header hero-card__top cat-detail-hero">
          <div className="cat-profile-header">
            <div className="cat-profile-header__avatar">
              {cat.primary_photo?.signed_url ? (
                <img
                  src={cat.primary_photo.signed_url}
                  alt={cat.primary_photo.caption ?? `Foto de ${cat.name}`}
                />
              ) : (
                <span aria-hidden="true">{getInitials(cat.name)}</span>
              )}
            </div>
            <div className="stack stack--compact hero-card__title">
              <Link className="back-link" to={isArchived ? "/archive" : "/cats"}>
                Volver
              </Link>
              <span className="eyebrow">Perfil del gato</span>
              <h1>{cat.name}</h1>
              <p className="muted">
                {isArchived
                  ? "Registro en consulta. La captura queda bloqueada hasta reactivarlo."
                  : "Perfil, feed cronologico y seguimiento general en una sola vista, pensado para leer primero y registrar despues."}
              </p>
              <div className="cat-profile-header__pills">
                <span className={`status ${isArchived ? "status--neutral" : ""}`}>
                  {isArchived ? "Archivado" : "Activo"}
                </span>
                {cat.birth_date ? (
                  <span className="profile-inline-pill">Cumple: {formatDateOnly(cat.birth_date)}</span>
                ) : null}
                <span className="profile-inline-pill">Creado {formatShortDate(cat.created_at)}</span>
              </div>
              <div className="cat-detail-hero__actions">
                <a className="button button--ghost button--small" href="#cat-feed">
                  Ver feed
                </a>
                <a className="button button--ghost button--small" href="#new-event">
                  Registrar evento
                </a>
                <a className="button button--ghost button--small" href="#new-process">
                  Nuevo seguimiento
                </a>
                <a className="button button--ghost button--small" href="#cat-media">
                  Fotos y adjuntos
                </a>
              </div>
            </div>
          </div>
          <div className="cat-profile-quickpanel cat-profile-quickpanel--hero">
            <div className="cat-profile-quickpanel__item">
              <span className="detail-fact__label">Perfil</span>
              <strong>{isArchived ? "Solo consulta" : "Activo para registrar"}</strong>
            </div>
            <div className="cat-profile-quickpanel__item">
              <span className="detail-fact__label">Feed</span>
              <strong>{timelineCountLabel}</strong>
            </div>
            <div className="cat-profile-quickpanel__item">
              <span className="detail-fact__label">Seguimientos</span>
              <strong>{openProcessCount} abiertos</strong>
            </div>
            <div className="cat-profile-quickpanel__item">
              <span className="detail-fact__label">Adjuntos</span>
              <strong>{cat.attachments.length} visibles</strong>
            </div>
          </div>
        </div>

        <div className="detail-grid detail-grid--social">
          <div className="surface-group">
            <section className="panel panel--subtle panel--section stack stack--compact cat-profile-panel">
              <div className="section-header form-card__head">
                <div>
                  <h2>Resumen del perfil</h2>
                  <p className="muted">
                    {isArchived ? "En consulta. Reactiva para editar." : "Nombre, notas y datos base del perfil."}
                  </p>
                </div>
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => archiveMutation.mutate(!isArchived)}
                  disabled={archiveMutation.isPending}
                >
                  {archiveMutation.isPending
                    ? "Guardando..."
                    : isArchived
                      ? "Reactivar"
                      : "Archivar"}
                </button>
              </div>
              <form className="form form--compact" onSubmit={handleCatSubmit}>
                <div className="field">
                  <label htmlFor="detail-name">Nombre</label>
                  <input
                    id="detail-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    disabled={isArchived}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="detail-notes">Notas</label>
                  <textarea
                    id="detail-notes"
                    rows={4}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    disabled={isArchived}
                  />
                </div>
                <div className="field">
                  <label htmlFor="detail-birth-date">Fecha de nacimiento</label>
                  <input
                    id="detail-birth-date"
                    type="date"
                    value={birthDate}
                    onChange={(event) => setBirthDate(event.target.value)}
                    disabled={isArchived || updateCatMutation.isPending}
                  />
                </div>
                <div className="detail-facts">
                  <div className="detail-fact">
                    <span className="detail-fact__label">Nacimiento</span>
                    <strong>{cat.birth_date ? formatDateOnly(cat.birth_date) : "Sin registrar"}</strong>
                  </div>
                  <div className="detail-fact">
                    <span className="detail-fact__label">Edad actual</span>
                    <strong>
                      {birthdayMetrics ? `${birthdayMetrics.age} ${birthdayMetrics.age === 1 ? "año" : "años"}` : "Sin registrar"}
                    </strong>
                  </div>
                  <div className="detail-fact">
                    <span className="detail-fact__label">Próximo cumpleaños</span>
                    <strong>
                      {birthdayMetrics ? birthdayMetrics.nextBirthdayLabel : "Sin registrar"}
                    </strong>
                  </div>
                </div>
                {catError ? <p className="error">{catError}</p> : null}
                <div className="actions">
                  <button
                    className="button"
                    type="submit"
                    disabled={isArchived || updateCatMutation.isPending}
                  >
                    {updateCatMutation.isPending ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>
              </form>
            </section>

            <section className="panel panel--subtle panel--section stack stack--compact" id="new-process">
              <div className="section-header form-card__head">
                <div>
                  <h2>Nuevo seguimiento clinico</h2>
                  <p className="muted">
                    {isArchived
                      ? "Este gato esta archivado. Reactivalo para iniciar seguimiento."
                      : "Abre un seguimiento clinico ligero que luego tendra su propia subtimeline."}
                  </p>
                </div>
              </div>

              <form className="form form--compact" onSubmit={handleProcessSubmit}>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="process-type">Tipo de proceso</label>
                  <select
                    id="process-type"
                    value={processTypeId}
                    onChange={(event) => setProcessTypeId(event.target.value)}
                    disabled={isArchived || createProcessMutation.isPending || !activeProcessTypes.length}
                    required
                  >
                    <option value="">Selecciona un tipo</option>
                    {activeProcessTypes.map((processType) => (
                      <option key={processType.id} value={processType.id}>
                        {processType.label}
                      </option>
                    ))}
                  </select>
                  </div>
                  <div className="field">
                    <label htmlFor="process-opened-at">Fecha de apertura</label>
                    <input
                      id="process-opened-at"
                      type="datetime-local"
                      value={processOpenedAt}
                      onChange={(event) => setProcessOpenedAt(event.target.value)}
                      disabled={isArchived || createProcessMutation.isPending}
                      required
                    />
                  </div>
                </div>
                {!activeProcessTypes.length ? (
                  <p className="muted">
                    Primero activa o crea al menos un tipo de proceso en Catálogos.
                  </p>
                ) : null}
                <div className="field">
                  <label htmlFor="process-title">Titulo del proceso</label>
                  <input
                    id="process-title"
                    value={processTitle}
                    onChange={(event) => setProcessTitle(event.target.value)}
                    disabled={isArchived || createProcessMutation.isPending}
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="process-notes">Notas</label>
                  <textarea
                    id="process-notes"
                    rows={3}
                    value={processNotes}
                    onChange={(event) => setProcessNotes(event.target.value)}
                    disabled={isArchived || createProcessMutation.isPending}
                  />
                </div>

                {processError ? <p className="error">{processError}</p> : null}
                <div className="actions">
                  <button
                    className="button"
                    type="submit"
                    disabled={
                      isArchived || createProcessMutation.isPending || !processTypeId || !activeProcessTypes.length
                    }
                  >
                    {createProcessMutation.isPending ? "Guardando..." : "Crear proceso"}
                  </button>
                </div>
              </form>
            </section>

            <section className="panel panel--subtle panel--section stack stack--compact" id="new-event">
              <div className="section-header form-card__head">
                <div>
                  <h2>Nuevo registro</h2>
                  <p className="muted">
                    {isArchived
                      ? "Este gato esta archivado. Reactivalo para registrar nuevos eventos."
                      : "Registra actividad desde este perfil y aparecera en el feed."}
                  </p>
                </div>
              </div>

              <form className="form form--compact" onSubmit={handleEventSubmit}>
                <div className="field">
                  <label htmlFor="event-title">Titulo</label>
                  <input
                    id="event-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    disabled={isArchived || createEventMutation.isPending}
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="event-notes">Notas</label>
                  <textarea
                    id="event-notes"
                    rows={4}
                    value={eventNotes}
                    onChange={(event) => setEventNotes(event.target.value)}
                    disabled={isArchived || createEventMutation.isPending}
                  />
                </div>

                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="event-at">Fecha y hora</label>
                    <input
                      id="event-at"
                      type="datetime-local"
                      value={eventAt}
                      onChange={(event) => setEventAt(event.target.value)}
                      disabled={isArchived || createEventMutation.isPending}
                      required
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="event-category">Categoria</label>
                    <select
                      id="event-category"
                      value={categoryId}
                      onChange={(event) => {
                        setCategoryId(event.target.value);
                        setSubcategoryId("");
                      }}
                      disabled={isArchived || createEventMutation.isPending}
                    >
                      <option value="">Sin categoria</option>
                      {(categoriesQuery.data ?? []).map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="event-subcategory">Subcategoria</label>
                  <select
                    id="event-subcategory"
                    value={subcategoryId}
                    onChange={(event) => setSubcategoryId(event.target.value)}
                    disabled={
                      isArchived ||
                      createEventMutation.isPending ||
                      !categoryId ||
                      filteredSubcategories.length === 0
                    }
                  >
                    <option value="">Sin subcategoria</option>
                    {filteredSubcategories.map((subcategory) => (
                      <option key={subcategory.id} value={subcategory.id}>
                        {subcategory.label}
                      </option>
                    ))}
                  </select>
                </div>

                <fieldset className="fieldset" disabled={isArchived || createEventMutation.isPending}>
                  <div className="field">
                    <legend>Tambien afecta a</legend>
                  </div>
                  {!relatedCatOptions.length ? (
                    <p className="muted">No hay otros gatos activos para relacionar.</p>
                  ) : (
                    <div className="selection-list">
                      {relatedCatOptions.map((relatedCat) => (
                        <label className="selection-chip" key={relatedCat.id}>
                          <input
                            type="checkbox"
                            checked={selectedRelatedCatIds.includes(relatedCat.id)}
                            onChange={(event) =>
                              setSelectedRelatedCatIds((current) =>
                                event.target.checked
                                  ? [...current, relatedCat.id]
                                  : current.filter((currentId) => currentId !== relatedCat.id),
                              )
                            }
                          />
                          {relatedCat.name}
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>

                <section className="cost-box">
                  <div className="section-header section-header--compact">
                    <div>
                      <strong>Costo</strong>
                      <p className="muted">
                        Se guarda como informacion secundaria dentro del evento.
                      </p>
                    </div>
                    <button
                      className="button button--secondary button--small"
                      type="button"
                      onClick={() => setCostEnabled((current) => !current)}
                      disabled={isArchived || createEventMutation.isPending}
                    >
                      {costEnabled ? "Quitar" : "Agregar"}
                    </button>
                  </div>

                  {costEnabled ? (
                    <div className="stack stack--compact">
                      <div className="field">
                        <label htmlFor="new-event-cost-mode">Modo de costo</label>
                        <select
                          id="new-event-cost-mode"
                          value={costMode}
                          onChange={(event) =>
                            setCostMode(event.target.value as "per_cat" | "shared_total")
                          }
                          disabled={isArchived || createEventMutation.isPending}
                        >
                          <option value="shared_total">Total compartido</option>
                          <option value="per_cat">Monto por gato</option>
                        </select>
                      </div>

                      {costMode === "shared_total" ? (
                        <div className="field">
                          <label htmlFor="new-event-shared-total">Total compartido</label>
                          <input
                            id="new-event-shared-total"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={sharedTotalAmount}
                            onChange={(event) => setSharedTotalAmount(event.target.value)}
                            disabled={isArchived || createEventMutation.isPending}
                          />
                        </div>
                      ) : (
                        <div className="stack stack--compact">
                          {selectedCats.map((selectedCat) => (
                            <div className="field" key={selectedCat.id}>
                              <label htmlFor={`new-event-cost-${selectedCat.id}`}>
                                {selectedCat.name}
                              </label>
                              <input
                                id={`new-event-cost-${selectedCat.id}`}
                                inputMode="decimal"
                                placeholder="0.00"
                                value={perCatAmounts[selectedCat.id] ?? ""}
                                onChange={(event) =>
                                  setPerCatAmounts((current) => ({
                                    ...current,
                                    [selectedCat.id]: event.target.value,
                                  }))
                                }
                                disabled={isArchived || createEventMutation.isPending}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </section>

                {eventError ? <p className="error">{eventError}</p> : null}
                <div className="actions">
                  <button
                    className="button"
                    type="submit"
                    disabled={isArchived || createEventMutation.isPending}
                  >
                    {createEventMutation.isPending ? "Guardando..." : "Guardar evento"}
                  </button>
                </div>
              </form>
            </section>

            <section className="section-shell" id="cat-feed">
              <div className="section-shell__head feed-head">
                <div>
                  <span className="eyebrow">Actividad</span>
                  <h2>Feed del perfil</h2>
                </div>
                <p className="muted">
                  Esta es la lectura principal del perfil. Los costos se mantienen discretos y los seguimientos aparecen como hilos especiales dentro del mismo historial.
                </p>
              </div>
              <div className="feed-summary-strip">
                <div className="feed-summary-strip__item">
                  <span>Ultima entrada</span>
                  <strong>{latestTimelineEntry ? formatShortDate(latestTimelineEntry.event_at) : "Sin actividad"}</strong>
                </div>
                <div className="feed-summary-strip__item">
                  <span>Seguimientos</span>
                  <strong>{openProcessCount} abiertos</strong>
                </div>
                <div className="feed-summary-strip__item">
                  <span>Modo</span>
                  <strong>Lectura cronologica</strong>
                </div>
              </div>
              {!cat.timeline.length ? (
                <div className="panel panel--subtle empty-state empty-state--tight">
                  <p className="muted">Todavia no hay actividad registrada para este perfil.</p>
                </div>
              ) : (
                <div className="timeline timeline--feed timeline--grouped">
                  {timelineGroups.map((group) => (
                    <section className="timeline-group" key={group.key}>
                      <div className="timeline-group__header">
                        <span className="timeline-group__label">{group.label}</span>
                        <div className="timeline-group__rule" aria-hidden="true" />
                      </div>
                      <div className="timeline-group__items">
                        {group.items.map((item) => {
                          const isEditingCost = editingCostEventId === item.id;
                          const isDeleting = deletingEventId === item.id;
                          const itemCost = item.cost;
                          const itemCurrency = itemCost?.currency_code ?? "MXN";
                          const kindLabel = getProcessKindLabel(item.process_event_kind);
                          const canDelete =
                            !isArchived &&
                            !item.is_process_header &&
                            item.process_closed_event_id !== item.id;

                          return (
                            <article
                              className={`timeline__item timeline__post ${item.is_process_header ? "timeline__item--process" : ""}`}
                              key={item.id}
                            >
                              <div className="timeline-story">
                                <div className="timeline-story__date">
                                  <span className="timeline-story__day">{formatFeedDay(item.event_at)}</span>
                                  <span className="timeline-story__month">{formatFeedMonth(item.event_at)}</span>
                                  <span className="timeline-story__time">
                                    {item.time_kind === "scheduled" ? "Programado" : "Registrado"}
                                  </span>
                                </div>
                                <div className="timeline-story__content">
                              <div className="timeline__meta">
                                <span>{formatDate(item.event_at)}</span>
                              </div>
                              <div className="timeline__header">
                                <div className="timeline__body">
                                  <div className="timeline__badge-row">
                                    {item.is_process_header ? (
                                      <span className="process-badge">Seguimiento especial</span>
                                    ) : null}
                                    <h3>{item.is_process_header ? item.process_title ?? item.title : item.title}</h3>
                                    {item.is_process_header && item.process_type_label ? (
                                      <p className="muted timeline__labels">
                                        Tipo: {item.process_type_label}
                                        {item.process_closed_at ? " · Cerrado" : " · Abierto"}
                                      </p>
                                    ) : null}
                                    {!item.is_process_header && kindLabel ? (
                                      <span className="process-chip">{kindLabel}</span>
                                    ) : null}
                                  </div>
                                </div>
                                {item.is_process_header ? (
                                  <Link className="inline-link" to={`/cats/${cat.id}/processes/${item.process_id}`}>
                                    Abrir seguimiento
                                  </Link>
                                ) : !isArchived ? (
                                  <div className="timeline__actions">
                                    <button
                                      className="button button--ghost button--small"
                                      type="button"
                                      onClick={() => {
                                        setTimelineActionError(null);
                                        setEditingCostError(null);
                                        setEditingCostEventId((current) => (current === item.id ? null : item.id));
                                      }}
                                      disabled={isDeleting}
                                    >
                                      {isEditingCost
                                        ? "Cerrar costo"
                                        : itemCost && itemCost.mode !== "none"
                                          ? "Editar costo"
                                          : "Agregar costo"}
                                    </button>
                                    {canDelete ? (
                                      <button
                                        className="button button--ghost button--danger button--small"
                                        type="button"
                                        onClick={() => handleDeleteEvent(item.id)}
                                        disabled={voidEventMutation.isPending}
                                      >
                                        {voidEventMutation.isPending && isDeleting ? "Eliminando..." : "Eliminar"}
                                      </button>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                              <p className="muted timeline__labels">
                                {item.is_process_header
                                  ? `Seguimiento ligado al feed de ${cat.name}.`
                                  : [item.category_label, item.subcategory_label].filter(Boolean).join(" / ") ||
                                    "Sin categoria"}
                              </p>
                              {item.notes ? <p className="timeline__narrative">{item.notes}</p> : null}
                              {itemCost && itemCost.mode !== "none" && itemCost.cat_amount !== null ? (
                                <p className="timeline__cost">
                                  {itemCost.mode === "shared_total" && itemCost.total_amount !== null
                                    ? `${formatMoney(itemCost.cat_amount, itemCurrency)} para este perfil · total ${formatMoney(itemCost.total_amount, itemCurrency)}`
                                    : `${formatMoney(itemCost.cat_amount, itemCurrency)} para este perfil`}
                                </p>
                              ) : <span className="timeline__quiet">Sin costo visible</span>}
                              {item.process_id && !item.is_process_header ? (
                                <Link className="inline-link" to={`/cats/${cat.id}/processes/${item.process_id}`}>
                                  Ver hilo: {item.process_title ?? "Proceso clinico"}
                                </Link>
                              ) : null}
                              {isDeleting && timelineActionError ? (
                                <p className="error">{timelineActionError}</p>
                              ) : null}
                                </div>
                              </div>
                              {isEditingCost ? (
                                <form className="cost-editor" onSubmit={handleEditCostSubmit}>
                                  {eventCostDraftQuery.isLoading ? <p className="muted">Cargando costo...</p> : null}
                                  {eventCostDraftQuery.data ? (
                                    <>
                                      <div className="section-header section-header--compact">
                                        <div>
                                          <strong>Costo del evento</strong>
                                          <p className="muted">
                                            Se guarda separado y solo se refleja aqui de forma discreta.
                                          </p>
                                        </div>
                                        <button
                                          className="button button--secondary button--small"
                                          type="button"
                                          onClick={() => setEditingCostEnabled((current) => !current)}
                                        >
                                          {editingCostEnabled ? "Quitar" : "Agregar"}
                                        </button>
                                      </div>
                                      {editingCostEnabled ? (
                                        <div className="stack stack--compact">
                                          <div className="field">
                                            <label htmlFor={`timeline-cost-mode-${item.id}`}>Modo de costo</label>
                                            <select
                                              id={`timeline-cost-mode-${item.id}`}
                                              value={editingCostMode}
                                              onChange={(event) =>
                                                setEditingCostMode(
                                                  event.target.value as "per_cat" | "shared_total",
                                                )
                                              }
                                            >
                                              <option value="shared_total">Total compartido</option>
                                              <option value="per_cat">Monto por gato</option>
                                            </select>
                                          </div>
                                          {editingCostMode === "shared_total" ? (
                                            <div className="field">
                                              <label htmlFor={`timeline-shared-total-${item.id}`}>
                                                Total compartido
                                              </label>
                                              <input
                                                id={`timeline-shared-total-${item.id}`}
                                                inputMode="decimal"
                                                placeholder="0.00"
                                                value={editingSharedTotalAmount}
                                                onChange={(event) => setEditingSharedTotalAmount(event.target.value)}
                                              />
                                            </div>
                                          ) : (
                                            <div className="stack stack--compact">
                                              {eventCostDraftQuery.data.cat_amounts.map((costItem) => (
                                                <div className="field" key={costItem.cat_id}>
                                                  <label htmlFor={`timeline-cost-${item.id}-${costItem.cat_id}`}>
                                                    {costItem.cat_name}
                                                  </label>
                                                  <input
                                                    id={`timeline-cost-${item.id}-${costItem.cat_id}`}
                                                    inputMode="decimal"
                                                    placeholder="0.00"
                                                    value={editingPerCatAmounts[costItem.cat_id] ?? ""}
                                                    onChange={(event) =>
                                                      setEditingPerCatAmounts((current) => ({
                                                        ...current,
                                                        [costItem.cat_id]: event.target.value,
                                                      }))
                                                    }
                                                  />
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      ) : null}
                                    </>
                                  ) : null}
                                  {editingCostError ? <p className="error">{editingCostError}</p> : null}
                                  <div className="actions">
                                    <button
                                      className="button"
                                      type="submit"
                                      disabled={updateEventCostMutation.isPending || eventCostDraftQuery.isLoading}
                                    >
                                      {updateEventCostMutation.isPending ? "Guardando..." : "Guardar costo"}
                                    </button>
                                  </div>
                                </form>
                              ) : null}
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="aside-stack">
            {showCostTotal ? (
              <section className="panel panel--subtle cost-total-card profile-accent-card">
                <p className="cost-total-card__label">Acumulado</p>
                <strong>{formatMoney(cat.cost_total_amount ?? 0)}</strong>
              </section>
            ) : null}

            <section className="panel panel--subtle panel--section stack stack--compact" id="cat-media">
              <div>
                <h2>Foto principal</h2>
                <p className="muted">
                  {isArchived
                    ? "Disponible solo para consulta."
                    : "Sube una imagen y la mostraremos en este detalle."}
                </p>
              </div>
              {cat.primary_photo?.signed_url ? (
                <figure className="photo-card">
                  <img
                    src={cat.primary_photo.signed_url}
                    alt={cat.primary_photo.caption ?? `Foto de ${cat.name}`}
                  />
                  <figcaption className="muted">
                    {cat.primary_photo.caption ?? cat.primary_photo.original_filename}
                  </figcaption>
                </figure>
              ) : (
                <div className="photo-card photo-card--empty">
                  <p className="muted">No hay foto principal disponible.</p>
                </div>
              )}
              <form className="form form--compact" onSubmit={handlePrimaryPhotoSubmit}>
                <div className="field">
                  <label htmlFor="cat-primary-photo">
                    {cat.primary_photo ? "Reemplazar foto principal" : "Subir foto principal"}
                  </label>
                  <input
                    id="cat-primary-photo"
                    type="file"
                    accept="image/*"
                    disabled={isArchived || uploadPrimaryPhotoMutation.isPending}
                    onChange={(event) => setPrimaryPhotoFile(event.target.files?.[0] ?? null)}
                  />
                </div>
                {primaryPhotoError ? <p className="error">{primaryPhotoError}</p> : null}
                <div className="actions">
                  <button
                    className="button"
                    type="submit"
                    disabled={isArchived || !primaryPhotoFile || uploadPrimaryPhotoMutation.isPending}
                  >
                    {uploadPrimaryPhotoMutation.isPending
                      ? "Subiendo..."
                      : cat.primary_photo
                        ? "Reemplazar foto"
                        : "Guardar foto"}
                  </button>
                </div>
              </form>
            </section>

            <section className="panel panel--subtle panel--section stack stack--compact">
              <div>
                <h2>Adjuntos</h2>
                <p className="muted">
                  {isArchived
                    ? "Los adjuntos quedan visibles, pero no editables."
                    : "Archivos e imagenes generales ligados a este gato."}
                </p>
              </div>
              <form className="form form--compact" onSubmit={handleAttachmentSubmit}>
                <div className="field">
                  <label htmlFor="cat-attachment">Agregar adjunto</label>
                  <input
                    id="cat-attachment"
                    type="file"
                    disabled={isArchived || uploadAttachmentMutation.isPending}
                    onChange={(event) => setAttachmentFile(event.target.files?.[0] ?? null)}
                  />
                </div>
                {attachmentError ? <p className="error">{attachmentError}</p> : null}
                <div className="actions">
                  <button
                    className="button button--secondary"
                    type="submit"
                    disabled={isArchived || !attachmentFile || uploadAttachmentMutation.isPending}
                  >
                    {uploadAttachmentMutation.isPending ? "Subiendo..." : "Agregar adjunto"}
                  </button>
                </div>
              </form>
              {!cat.attachments.length ? (
                <div className="panel panel--subtle empty-state empty-state--tight">
                  <p className="muted">Todavia no hay adjuntos registrados.</p>
                </div>
              ) : (
                <div className="attachments-list">
                  {cat.attachments.map((attachment) => (
                    <article className="attachment-row" key={attachment.id}>
                      <div className="attachment-row__content">
                        <strong>{attachment.original_filename}</strong>
                        <p className="muted">
                          {attachment.file_kind === "image"
                            ? "Imagen"
                            : attachment.file_kind === "document"
                              ? "Documento"
                              : "Archivo"}
                          {" · "}
                          {new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(
                            new Date(attachment.created_at),
                          )}
                          {attachment.is_primary_for_cat ? " · Foto principal" : ""}
                        </p>
                      </div>
                      {attachment.signed_url ? (
                        <a className="inline-link" href={attachment.signed_url} target="_blank" rel="noreferrer">
                          Abrir
                        </a>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </section>
  );
}
