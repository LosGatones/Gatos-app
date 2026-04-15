import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createClinicalProcess,
  createEvent,
  listActiveCats,
  listClinicalProcessTypes,
  listEventCategories,
} from "@/data/queries";
import type { EventCostInput } from "@/domain/types";

type ComposerMode = "event" | "process";
type ComposerCostMode = "none" | "shared_total" | "per_cat";

type QuickComposerProps = {
  currentCatId?: string | null;
};

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

export function QuickComposer({ currentCatId }: QuickComposerProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<ComposerMode>("event");
  const [selectedCatIds, setSelectedCatIds] = useState<string[]>([]);
  const [processCatId, setProcessCatId] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [eventAt, setEventAt] = useState(() => toDateTimeLocalValue(new Date()));
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [costMode, setCostMode] = useState<ComposerCostMode>("none");
  const [sharedTotalAmount, setSharedTotalAmount] = useState("");
  const [perCatAmounts, setPerCatAmounts] = useState<Record<string, string>>({});
  const [processTitle, setProcessTitle] = useState("");
  const [processNotes, setProcessNotes] = useState("");
  const [processTypeId, setProcessTypeId] = useState("");
  const [processOpenedAt, setProcessOpenedAt] = useState(() => toDateTimeLocalValue(new Date()));
  const [localError, setLocalError] = useState<string | null>(null);

  const activeCatsQuery = useQuery({
    queryKey: ["cats", "active"],
    queryFn: listActiveCats,
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories", "all"],
    queryFn: listEventCategories,
  });

  const processTypesQuery = useQuery({
    queryKey: ["process-types", "all"],
    queryFn: listClinicalProcessTypes,
  });

  const activeCats = activeCatsQuery.data ?? [];
  const activeProcessTypes = useMemo(
    () => (processTypesQuery.data ?? []).filter((type) => type.is_active),
    [processTypesQuery.data],
  );

  const filteredSubcategories = useMemo(() => {
    if (!categoryId) {
      return [];
    }

    return categoriesQuery.data?.find((category) => category.id === categoryId)?.subcategories ?? [];
  }, [categoriesQuery.data, categoryId]);

  const selectedCats = useMemo(() => {
    const catMap = new Map(activeCats.map((cat) => [cat.id, cat]));
    return selectedCatIds
      .map((catId) => catMap.get(catId))
      .filter((cat): cat is (typeof activeCats)[number] => Boolean(cat));
  }, [activeCats, selectedCatIds]);

  useEffect(() => {
    setPerCatAmounts((current) => buildPerCatMap(selectedCatIds, current));
  }, [selectedCatIds]);

  useEffect(() => {
    if (!activeProcessTypes.length) {
      setProcessTypeId("");
      return;
    }

    setProcessTypeId((current) =>
      current && activeProcessTypes.some((type) => type.id === current)
        ? current
        : activeProcessTypes[0]?.id ?? "",
    );
  }, [activeProcessTypes]);

  function getPreferredCatId() {
    if (currentCatId && activeCats.some((cat) => cat.id === currentCatId)) {
      return currentCatId;
    }

    return activeCats[0]?.id ?? "";
  }

  function resetComposer(nextMode: ComposerMode = "event") {
    const preferredCatId = getPreferredCatId();

    setMode(nextMode);
    setSelectedCatIds(preferredCatId ? [preferredCatId] : []);
    setProcessCatId(preferredCatId);
    setTitle("");
    setNotes("");
    setEventAt(toDateTimeLocalValue(new Date()));
    setCategoryId("");
    setSubcategoryId("");
    setCostMode("none");
    setSharedTotalAmount("");
    setPerCatAmounts({});
    setProcessTitle("");
    setProcessNotes("");
    setProcessOpenedAt(toDateTimeLocalValue(new Date()));
    setLocalError(null);
  }

  function openComposer(nextMode: ComposerMode = "event") {
    resetComposer(nextMode);
    setIsOpen(true);
  }

  function closeComposer() {
    setIsOpen(false);
    setLocalError(null);
  }

  const createEventMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: async () => {
      closeComposer();
      await queryClient.invalidateQueries({ queryKey: ["cats"] });
      await queryClient.invalidateQueries({ queryKey: ["cats", "detail"] });
      await queryClient.invalidateQueries({ queryKey: ["processes"] });
    },
    onError: (error: Error) => {
      setLocalError(error.message);
    },
  });

  const createProcessMutation = useMutation({
    mutationFn: createClinicalProcess,
    onSuccess: async () => {
      closeComposer();
      await queryClient.invalidateQueries({ queryKey: ["cats"] });
      await queryClient.invalidateQueries({ queryKey: ["cats", "detail"] });
      await queryClient.invalidateQueries({ queryKey: ["processes"] });
    },
    onError: (error: Error) => {
      setLocalError(error.message);
    },
  });

  function toggleCat(catId: string) {
    setSelectedCatIds((current) =>
      current.includes(catId) ? current.filter((currentId) => currentId !== catId) : [...current, catId],
    );
  }

  function buildEventCostInput(): EventCostInput | undefined {
    if (costMode === "none") {
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

  function handleEventSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);

    try {
      createEventMutation.mutate({
        cat_ids: selectedCatIds,
        title,
        notes,
        event_at: new Date(eventAt).toISOString(),
        category_id: categoryId || null,
        subcategory_id: subcategoryId || null,
        cost: buildEventCostInput(),
      });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "No fue posible preparar el registro.");
    }
  }

  function handleProcessSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);

    createProcessMutation.mutate({
      cat_id: processCatId,
      process_type_id: processTypeId,
      title: processTitle,
      notes: processNotes,
      opened_at: new Date(processOpenedAt).toISOString(),
    });
  }

  const canOpen = activeCats.length > 0;
  const isSubmitting = createEventMutation.isPending || createProcessMutation.isPending;
  const selectedCatsSummary =
    selectedCats.length === 0
      ? "Selecciona al menos un perfil."
      : selectedCats.length === 1
        ? `Se publicara en el perfil de ${selectedCats[0]?.name}.`
        : `Se publicara en ${selectedCats.length} perfiles: ${selectedCats.map((cat) => cat.name).join(", ")}.`;
  const processSelectedCat = activeCats.find((cat) => cat.id === processCatId) ?? null;

  return (
    <>
      <button
        className="composer-fab"
        type="button"
        onClick={() => openComposer("event")}
        disabled={!canOpen}
        aria-label="Nuevo registro"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span className="composer-fab__plus" aria-hidden="true">
          +
        </span>
      </button>

      {isOpen ? (
        <div className="composer-backdrop" onClick={closeComposer}>
          <section
            className="composer-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-composer-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="composer-sheet__handle" aria-hidden="true" />

            <div className="composer-sheet__header">
              <div>
                <span className="eyebrow">Composer principal</span>
                <h2 id="quick-composer-title">Registrar actividad</h2>
                <p className="muted">
                  Usa este flujo para registrar eventos rapidos o iniciar un seguimiento sin salir de la lectura.
                </p>
              </div>
              <button className="composer-close" type="button" onClick={closeComposer}>
                Cerrar
              </button>
            </div>

            <div className="composer-mode-switch" role="tablist" aria-label="Tipo de registro">
              <button
                className={`composer-mode-switch__item ${mode === "event" ? "is-active" : ""}`}
                type="button"
                onClick={() => {
                  resetComposer("event");
                  setIsOpen(true);
                }}
              >
                Registro
              </button>
              <button
                className={`composer-mode-switch__item ${mode === "process" ? "is-active" : ""}`}
                type="button"
                onClick={() => {
                  resetComposer("process");
                  setIsOpen(true);
                }}
              >
                Seguimiento clinico
              </button>
            </div>

            {mode === "event" ? (
              <form className="composer-form" onSubmit={handleEventSubmit}>
                <section className="composer-section composer-section--hero">
                  <div className="composer-hero-card">
                    <div className="composer-hero-card__copy">
                      <span className="eyebrow">Registro rapido</span>
                      <h3>Publica un evento sin salir del timeline</h3>
                      <p className="muted">
                        Primero eliges a quien afecta, luego capturas el contexto y por ultimo agregas costo solo si aplica.
                      </p>
                    </div>
                    <div className="composer-summary-card composer-summary-card--hero">
                      <strong>Resumen</strong>
                      <p className="muted">{selectedCatsSummary}</p>
                    </div>
                  </div>
                </section>

                <section className="composer-section">
                  <div className="composer-section__head">
                    <div>
                      <h3>Perfiles afectados</h3>
                      <p className="muted">Toca para incluir o quitar perfiles del mismo evento.</p>
                    </div>
                    <span className="composer-counter">
                      {selectedCatIds.length} seleccionad{selectedCatIds.length === 1 ? "o" : "os"}
                    </span>
                  </div>
                  <div className="composer-cat-grid">
                    {activeCats.map((cat) => {
                      const isSelected = selectedCatIds.includes(cat.id);

                      return (
                        <button
                          key={cat.id}
                          className={`composer-cat-chip ${isSelected ? "is-selected" : ""}`}
                          type="button"
                          onClick={() => toggleCat(cat.id)}
                        >
                          <strong>{cat.name}</strong>
                          <span>{isSelected ? "Incluido" : "Tocar para incluir"}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="composer-section composer-section--compact">
                  <div className="composer-section__head">
                    <div>
                      <h3>Detalle del evento</h3>
                      <p className="muted">La captura estructurada va primero y las notas amplian el contexto.</p>
                    </div>
                  </div>
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="composer-event-title">Titulo</label>
                      <input
                        id="composer-event-title"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Ej. Visita al veterinario"
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="composer-event-at">Fecha y hora</label>
                      <input
                        id="composer-event-at"
                        type="datetime-local"
                        value={eventAt}
                        onChange={(event) => setEventAt(event.target.value)}
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="composer-event-notes">Descripcion</label>
                    <textarea
                      id="composer-event-notes"
                      rows={4}
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Hoy llevamos a Greta, Bico y Baxter al veterinario..."
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="composer-event-category">Categoria</label>
                      <select
                        id="composer-event-category"
                        value={categoryId}
                        onChange={(event) => {
                          setCategoryId(event.target.value);
                          setSubcategoryId("");
                        }}
                        disabled={isSubmitting}
                      >
                        <option value="">Sin categoria</option>
                        {(categoriesQuery.data ?? []).map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="composer-event-subcategory">Subcategoria</label>
                      <select
                        id="composer-event-subcategory"
                        value={subcategoryId}
                        onChange={(event) => setSubcategoryId(event.target.value)}
                        disabled={isSubmitting || !categoryId || filteredSubcategories.length === 0}
                      >
                        <option value="">Sin subcategoria</option>
                        {filteredSubcategories.map((subcategory) => (
                          <option key={subcategory.id} value={subcategory.id}>
                            {subcategory.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>

                <section className="composer-section composer-section--compact">
                  <div className="composer-section__head">
                    <div>
                      <h3>Costo</h3>
                      <p className="muted">Secundario, pero bien resuelto cuando el evento lo necesita.</p>
                    </div>
                  </div>

                  <div className="composer-segmented">
                    <button
                      className={`composer-segmented__item ${costMode === "none" ? "is-active" : ""}`}
                      type="button"
                      onClick={() => setCostMode("none")}
                    >
                      Sin costo
                    </button>
                    <button
                      className={`composer-segmented__item ${costMode === "shared_total" ? "is-active" : ""}`}
                      type="button"
                      onClick={() => setCostMode("shared_total")}
                    >
                      Total compartido
                    </button>
                    <button
                      className={`composer-segmented__item ${costMode === "per_cat" ? "is-active" : ""}`}
                      type="button"
                      onClick={() => setCostMode("per_cat")}
                    >
                      Monto por gato
                    </button>
                  </div>

                  {costMode === "shared_total" ? (
                    <div className="composer-cost-card">
                      <div className="field">
                        <label htmlFor="composer-shared-total">Total compartido</label>
                        <input
                          id="composer-shared-total"
                          inputMode="decimal"
                          placeholder="900.00"
                          value={sharedTotalAmount}
                          onChange={(event) => setSharedTotalAmount(event.target.value)}
                          disabled={isSubmitting}
                        />
                      </div>
                      <p className="muted">
                        Ideal para casos como una consulta compartida entre varios perfiles.
                      </p>
                    </div>
                  ) : null}

                  {costMode === "per_cat" ? (
                    <div className="composer-cost-list">
                      {selectedCats.map((cat) => (
                        <div className="field" key={cat.id}>
                          <label htmlFor={`composer-cost-${cat.id}`}>{cat.name}</label>
                          <input
                            id={`composer-cost-${cat.id}`}
                            inputMode="decimal"
                            placeholder="0.00"
                            value={perCatAmounts[cat.id] ?? ""}
                            onChange={(event) =>
                              setPerCatAmounts((current) => ({
                                ...current,
                                [cat.id]: event.target.value,
                              }))
                            }
                            disabled={isSubmitting}
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </section>

                {localError ? <p className="error">{localError}</p> : null}
                <div className="composer-actions">
                  <button className="button button--secondary" type="button" onClick={closeComposer}>
                    Cancelar
                  </button>
                  <button
                    className="button"
                    type="submit"
                    disabled={isSubmitting || selectedCatIds.length === 0}
                  >
                    {createEventMutation.isPending ? "Guardando..." : "Publicar registro"}
                  </button>
                </div>
              </form>
            ) : (
              <form className="composer-form" onSubmit={handleProcessSubmit}>
                <section className="composer-section composer-section--hero">
                  <div className="composer-hero-card">
                    <div className="composer-hero-card__copy">
                      <span className="eyebrow">Seguimiento clinico</span>
                      <h3>Inicia un hilo especial para un solo perfil</h3>
                      <p className="muted">
                        Los seguimientos viven dentro del historial del gato, pero mantienen su propia subtimeline para leer el caso completo.
                      </p>
                    </div>
                    <div className="composer-summary-card composer-summary-card--hero">
                      <strong>Perfil elegido</strong>
                      <p className="muted">
                        {processSelectedCat
                          ? `${processSelectedCat.name} recibira este seguimiento.`
                          : "Elige primero el perfil para abrir el seguimiento."}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="composer-section">
                  <div className="composer-section__head">
                    <div>
                      <h3>Perfil del seguimiento</h3>
                      <p className="muted">Los seguimientos clinicos pertenecen a un solo gato.</p>
                    </div>
                  </div>
                  <div className="composer-cat-grid composer-cat-grid--single">
                    {activeCats.map((cat) => {
                      const isSelected = processCatId === cat.id;

                      return (
                        <button
                          key={cat.id}
                          className={`composer-cat-chip ${isSelected ? "is-selected" : ""}`}
                          type="button"
                          onClick={() => setProcessCatId(cat.id)}
                        >
                          <strong>{cat.name}</strong>
                          <span>{isSelected ? "Perfil elegido" : "Elegir perfil"}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="composer-section composer-section--compact">
                  <div className="composer-section__head">
                    <div>
                      <h3>Datos de apertura</h3>
                      <p className="muted">Define el tipo, el momento de apertura y el contexto inicial.</p>
                    </div>
                  </div>
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="composer-process-type">Tipo de proceso</label>
                      <select
                        id="composer-process-type"
                        value={processTypeId}
                        onChange={(event) => setProcessTypeId(event.target.value)}
                        disabled={isSubmitting || !activeProcessTypes.length}
                        required
                      >
                        <option value="">Selecciona un tipo</option>
                        {activeProcessTypes.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="composer-process-opened-at">Fecha de apertura</label>
                      <input
                        id="composer-process-opened-at"
                        type="datetime-local"
                        value={processOpenedAt}
                        onChange={(event) => setProcessOpenedAt(event.target.value)}
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="composer-process-title">Titulo del seguimiento</label>
                    <input
                      id="composer-process-title"
                      value={processTitle}
                      onChange={(event) => setProcessTitle(event.target.value)}
                      placeholder="Ej. Recuperacion post operatoria"
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="composer-process-notes">Notas</label>
                    <textarea
                      id="composer-process-notes"
                      rows={4}
                      value={processNotes}
                      onChange={(event) => setProcessNotes(event.target.value)}
                      placeholder="Describe el contexto inicial del seguimiento."
                      disabled={isSubmitting}
                    />
                  </div>
                </section>

                {localError ? <p className="error">{localError}</p> : null}
                <div className="composer-actions">
                  <button className="button button--secondary" type="button" onClick={closeComposer}>
                    Cancelar
                  </button>
                  <button
                    className="button"
                    type="submit"
                    disabled={isSubmitting || !processCatId || !processTypeId}
                  >
                    {createProcessMutation.isPending ? "Guardando..." : "Iniciar seguimiento"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
