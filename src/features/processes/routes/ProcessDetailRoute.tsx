import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import type { EventCostInput, ProcessEventKind } from "@/domain/types";
import {
  closeClinicalProcess,
  createProcessEvent,
  getClinicalProcessDetail,
  getEventCostDraft,
  updateEventCost,
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

function getKindLabel(kind: ProcessEventKind) {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

export function ProcessDetailRoute() {
  const params = useParams();
  const catId = params.catId;
  const processId = params.processId;
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<ProcessEventKind>("consulta");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [eventAt, setEventAt] = useState(() => toDateTimeLocalValue(new Date()));
  const [closeFormVisible, setCloseFormVisible] = useState(false);
  const [closeTitle, setCloseTitle] = useState("Alta");
  const [closeNotes, setCloseNotes] = useState("");
  const [closeEventAt, setCloseEventAt] = useState(() => toDateTimeLocalValue(new Date()));
  const [localError, setLocalError] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [costEnabled, setCostEnabled] = useState(false);
  const [costMode, setCostMode] = useState<"per_cat" | "shared_total">("shared_total");
  const [sharedTotalAmount, setSharedTotalAmount] = useState("");
  const [perCatAmount, setPerCatAmount] = useState("");
  const [editingCostEventId, setEditingCostEventId] = useState<string | null>(null);
  const [editingCostError, setEditingCostError] = useState<string | null>(null);
  const [editingCostEnabled, setEditingCostEnabled] = useState(false);
  const [editingCostMode, setEditingCostMode] = useState<"per_cat" | "shared_total">(
    "shared_total",
  );
  const [editingSharedTotalAmount, setEditingSharedTotalAmount] = useState("");
  const [editingPerCatAmount, setEditingPerCatAmount] = useState("");

  const processQuery = useQuery({
    queryKey: ["processes", "detail", processId],
    queryFn: () => getClinicalProcessDetail(processId ?? ""),
    enabled: Boolean(processId),
  });

  const eventCostDraftQuery = useQuery({
    queryKey: ["events", "cost-draft", editingCostEventId],
    queryFn: () => getEventCostDraft(editingCostEventId ?? ""),
    enabled: Boolean(editingCostEventId),
  });

  useEffect(() => {
    if (!eventCostDraftQuery.data) {
      return;
    }

    const draft = eventCostDraftQuery.data;
    const firstCatAmount = draft.cat_amounts[0]?.amount ?? null;
    const hasVisibleCost =
      draft.mode !== "none" &&
      ((draft.total_amount ?? 0) > 0 || (firstCatAmount ?? 0) > 0);

    setEditingCostEnabled(hasVisibleCost);
    setEditingCostMode(draft.mode === "per_cat" ? "per_cat" : "shared_total");
    setEditingSharedTotalAmount(
      draft.mode === "shared_total" && draft.total_amount !== null ? String(draft.total_amount) : "",
    );
    setEditingPerCatAmount(firstCatAmount === null ? "" : String(firstCatAmount));
    setEditingCostError(null);
  }, [eventCostDraftQuery.data]);

  const createProcessEventMutation = useMutation({
    mutationFn: createProcessEvent,
    onSuccess: async () => {
      setKind("consulta");
      setTitle("");
      setNotes("");
      setEventAt(toDateTimeLocalValue(new Date()));
      setCostEnabled(false);
      setCostMode("shared_total");
      setSharedTotalAmount("");
      setPerCatAmount("");
      setLocalError(null);
      await queryClient.invalidateQueries({ queryKey: ["processes", "detail", processId] });
      await queryClient.invalidateQueries({ queryKey: ["cats", "detail", catId] });
      await queryClient.invalidateQueries({ queryKey: ["cats"] });
    },
    onError: (error: Error) => {
      setLocalError(error.message);
    },
  });

  const updateEventCostMutation = useMutation({
    mutationFn: updateEventCost,
    onSuccess: async () => {
      setEditingCostError(null);
      setEditingCostEventId(null);
      await queryClient.invalidateQueries({ queryKey: ["processes", "detail", processId] });
      await queryClient.invalidateQueries({ queryKey: ["cats", "detail", catId] });
      await queryClient.invalidateQueries({ queryKey: ["cats"] });
    },
    onError: (error: Error) => {
      setEditingCostError(error.message);
    },
  });

  const closeProcessMutation = useMutation({
    mutationFn: closeClinicalProcess,
    onSuccess: async () => {
      setCloseFormVisible(false);
      setCloseTitle("Alta");
      setCloseNotes("");
      setCloseEventAt(toDateTimeLocalValue(new Date()));
      setCloseError(null);
      await queryClient.invalidateQueries({ queryKey: ["processes", "detail", processId] });
      await queryClient.invalidateQueries({ queryKey: ["cats", "detail", catId] });
      await queryClient.invalidateQueries({ queryKey: ["cats"] });
    },
    onError: (error: Error) => {
      setCloseError(error.message);
    },
  });

  function buildCreateCostInput(): EventCostInput | undefined {
    const currentCatId = processQuery.data?.cat.id;

    if (!costEnabled || !currentCatId) {
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
      per_cat_amounts: [
        {
          cat_id: currentCatId,
          amount: parseAmount(perCatAmount, `el costo de ${processQuery.data?.cat.name ?? "este gato"}`),
        },
      ],
    };
  }

  function buildEditingCostInput(): EventCostInput {
    const costDraft = eventCostDraftQuery.data;
    const currentCat = costDraft?.cat_amounts[0];

    if (!costDraft || !editingCostEnabled || !currentCat) {
      return { mode: "none", currency_code: "MXN" };
    }

    if (editingCostMode === "shared_total") {
      return {
        mode: "shared_total",
        currency_code: costDraft.currency_code,
        total_amount: parseAmount(editingSharedTotalAmount, "el total compartido"),
      };
    }

    return {
      mode: "per_cat",
      currency_code: costDraft.currency_code,
      per_cat_amounts: [
        {
          cat_id: currentCat.cat_id,
          amount: parseAmount(editingPerCatAmount, `el costo de ${currentCat.cat_name}`),
        },
      ],
    };
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);

    try {
      createProcessEventMutation.mutate({
        process_id: processId ?? "",
        kind,
        title,
        notes,
        event_at: new Date(eventAt).toISOString(),
        cost: buildCreateCostInput(),
      });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "No fue posible preparar el registro.");
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

  function handleCloseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCloseError(null);

    closeProcessMutation.mutate({
      process_id: processId ?? "",
      title: closeTitle,
      notes: closeNotes,
      event_at: new Date(closeEventAt).toISOString(),
    });
  }

  if (!catId || !processId) {
    return <Navigate to="/cats" replace />;
  }

  if (processQuery.isLoading) {
    return (
      <section className="page">
        <div className="panel">
          <p className="muted">Cargando seguimiento...</p>
        </div>
      </section>
    );
  }

  if (processQuery.isError) {
    return (
      <section className="page">
        <div className="panel">
          <p className="error">No fue posible cargar este proceso.</p>
        </div>
      </section>
    );
  }

  if (!processQuery.data || processQuery.data.cat.id !== catId) {
    return <Navigate to={`/cats/${catId}`} replace />;
  }

  const process = processQuery.data;
  const isArchived = Boolean(process.cat.archived_at);
  const isClosed = Boolean(process.closed_at);

  return (
    <section className="page">
      <div className="panel stack stack--airy surface-hero">
        <div className="process-header">
          <div className="stack stack--compact hero-card__title">
            <Link className="back-link" to={`/cats/${process.cat.id}`}>
              Volver a {process.cat.name}
            </Link>
            <span className="eyebrow">Seguimiento clinico</span>
            <span className="process-badge">Proceso clinico</span>
            <h1>{process.title}</h1>
            <div className="process-summary">
              <p className="muted">Tipo: {process.process_type_label ?? "Sin tipo"}</p>
              <p className="muted">Abierto el {formatDate(process.opened_at)}</p>
              {process.closed_at ? (
                <p className="muted">Cerrado el {formatDate(process.closed_at)}</p>
              ) : null}
            </div>
          </div>
          <div className="process-actions">
            <span className={`status ${isClosed ? "status--neutral" : ""}`}>
              {isClosed ? "Cerrado" : "Abierto"}
            </span>
            {!isArchived && !isClosed ? (
              <button
                className="button button--secondary"
                type="button"
                onClick={() => {
                  setCloseFormVisible((current) => !current);
                  setCloseError(null);
                }}
                disabled={closeProcessMutation.isPending}
              >
                {closeFormVisible ? "Cancelar cierre" : "Cerrar proceso"}
              </button>
            ) : null}
          </div>
        </div>

        {process.notes ? (
          <section className="panel panel--subtle panel--section">
            <p>{process.notes}</p>
          </section>
        ) : null}

        {closeFormVisible ? (
          <section className="panel panel--subtle panel--section stack stack--compact">
            <div className="section-header">
              <div>
                <h2>Cerrar proceso</h2>
                <p className="muted">Se registrará un evento final de cierre o alta.</p>
              </div>
            </div>
            <form className="form form--compact" onSubmit={handleCloseSubmit}>
              <div className="field">
                <label htmlFor="process-close-title">Título final</label>
                <input
                  id="process-close-title"
                  value={closeTitle}
                  onChange={(event) => setCloseTitle(event.target.value)}
                  disabled={closeProcessMutation.isPending}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="process-close-at">Fecha y hora</label>
                <input
                  id="process-close-at"
                  type="datetime-local"
                  value={closeEventAt}
                  onChange={(event) => setCloseEventAt(event.target.value)}
                  disabled={closeProcessMutation.isPending}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="process-close-notes">Notas</label>
                <textarea
                  id="process-close-notes"
                  rows={3}
                  value={closeNotes}
                  onChange={(event) => setCloseNotes(event.target.value)}
                  disabled={closeProcessMutation.isPending}
                />
              </div>
              {closeError ? <p className="error">{closeError}</p> : null}
              <div className="actions">
                <button className="button" type="submit" disabled={closeProcessMutation.isPending}>
                  {closeProcessMutation.isPending ? "Guardando..." : "Confirmar cierre"}
                </button>
              </div>
            </form>
          </section>
        ) : null}

          <section className="panel panel--subtle panel--section stack stack--compact">
          <div className="section-header">
            <div>
              <h2>Nuevo registro</h2>
              <p className="muted">
                {isArchived
                  ? "Este gato esta archivado. El seguimiento queda solo para consulta."
                  : isClosed
                    ? "Este proceso ya está cerrado. La subtimeline queda solo para consulta."
                  : "Agrega consultas, estudios, medicamentos, dieta o notas a este seguimiento."}
              </p>
            </div>
          </div>

          <form className="form form--compact" onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="process-event-kind">Tipo</label>
              <select
                id="process-event-kind"
                value={kind}
                onChange={(event) => setKind(event.target.value as ProcessEventKind)}
                disabled={isArchived || isClosed || createProcessEventMutation.isPending}
              >
                <option value="consulta">Consulta</option>
                <option value="estudio">Estudio</option>
                <option value="medicamento">Medicamento</option>
                <option value="dieta">Dieta</option>
                <option value="nota">Nota</option>
              </select>
              </div>

              <div className="field">
                <label htmlFor="process-event-at">Fecha y hora</label>
                <input
                  id="process-event-at"
                  type="datetime-local"
                  value={eventAt}
                  onChange={(event) => setEventAt(event.target.value)}
                  disabled={isArchived || isClosed || createProcessEventMutation.isPending}
                  required
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="process-event-title">Titulo</label>
              <input
                id="process-event-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={isArchived || isClosed || createProcessEventMutation.isPending}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="process-event-notes">Notas</label>
              <textarea
                id="process-event-notes"
                rows={4}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                disabled={isArchived || isClosed || createProcessEventMutation.isPending}
              />
            </div>

            <section className="cost-box">
              <div className="section-header section-header--compact">
                <div>
                  <strong>Costo</strong>
                  <p className="muted">
                    Se conserva como informacion secundaria dentro del registro.
                  </p>
                </div>
                <button
                  className="button button--secondary button--small"
                  type="button"
                  onClick={() => setCostEnabled((current) => !current)}
                  disabled={isArchived || isClosed || createProcessEventMutation.isPending}
                >
                  {costEnabled ? "Quitar" : "Agregar"}
                </button>
              </div>

              {costEnabled ? (
                <div className="stack stack--compact">
                  <div className="field">
                    <label htmlFor="process-event-cost-mode">Modo de costo</label>
                    <select
                      id="process-event-cost-mode"
                      value={costMode}
                      onChange={(event) =>
                        setCostMode(event.target.value as "per_cat" | "shared_total")
                      }
                      disabled={isArchived || isClosed || createProcessEventMutation.isPending}
                    >
                      <option value="shared_total">Total compartido</option>
                      <option value="per_cat">Monto por gato</option>
                    </select>
                  </div>

                  {costMode === "shared_total" ? (
                    <div className="field">
                      <label htmlFor="process-event-shared-total">Total compartido</label>
                      <input
                        id="process-event-shared-total"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={sharedTotalAmount}
                        onChange={(event) => setSharedTotalAmount(event.target.value)}
                        disabled={isArchived || isClosed || createProcessEventMutation.isPending}
                      />
                    </div>
                  ) : (
                    <div className="field">
                      <label htmlFor="process-event-per-cat">{process.cat.name}</label>
                      <input
                        id="process-event-per-cat"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={perCatAmount}
                        onChange={(event) => setPerCatAmount(event.target.value)}
                        disabled={isArchived || isClosed || createProcessEventMutation.isPending}
                      />
                    </div>
                  )}
                </div>
              ) : null}
            </section>

            {localError ? <p className="error">{localError}</p> : null}
            <div className="actions">
              <button
                className="button"
                type="submit"
                disabled={isArchived || isClosed || createProcessEventMutation.isPending}
              >
                {createProcessEventMutation.isPending ? "Guardando..." : "Guardar registro"}
              </button>
            </div>
          </form>
        </section>

        <section className="section-shell">
          <div className="section-shell__head">
            <span className="eyebrow">Historial</span>
            <h2>Subtimeline</h2>
          </div>
          {!process.timeline.length ? (
            <div className="panel panel--subtle empty-state empty-state--tight">
              <p className="muted">Todavia no hay registros en este proceso.</p>
            </div>
          ) : (
            <div className="timeline process-subtimeline">
              {process.timeline.map((item) => {
                const itemCost = item.cost;
                const itemCurrency = itemCost?.currency_code ?? "MXN";
                const kindLabel = item.process_event_kind ? getKindLabel(item.process_event_kind) : null;
                const isEditingCost = editingCostEventId === item.id;

                return (
                  <article
                    className={`timeline__item ${item.is_process_header ? "timeline__item--process" : ""}`}
                    key={item.id}
                  >
                    <div className="timeline__meta">
                      <span>{item.time_kind === "scheduled" ? "Programado" : "Registrado"}</span>
                      <span>{formatDate(item.event_at)}</span>
                    </div>
                    <div className="timeline__header">
                      <div className="timeline__body">
                        {item.is_process_header ? (
                          <span className="process-badge">Inicio del seguimiento</span>
                        ) : kindLabel ? (
                          <span className="process-chip">{kindLabel}</span>
                        ) : null}
                        <h3>{item.title}</h3>
                        {item.is_process_header && item.process_type_label ? (
                          <p className="muted timeline__labels">
                            Tipo: {item.process_type_label}
                            {item.process_closed_at ? " · Cerrado" : " · Abierto"}
                          </p>
                        ) : null}
                      </div>
                      {!item.is_process_header && !isArchived ? (
                        <button
                          className="button button--ghost button--small"
                          type="button"
                          onClick={() => {
                            setEditingCostError(null);
                            setEditingCostEventId((current) => (current === item.id ? null : item.id));
                          }}
                        >
                          {isEditingCost
                            ? "Cerrar costo"
                            : itemCost && itemCost.mode !== "none"
                              ? "Editar costo"
                              : "Agregar costo"}
                        </button>
                      ) : null}
                    </div>
                    {item.notes ? <p>{item.notes}</p> : null}
                    {itemCost && itemCost.mode !== "none" && itemCost.cat_amount !== null ? (
                      <p className="timeline__cost">
                        {itemCost.mode === "shared_total" && itemCost.total_amount !== null
                          ? `${formatMoney(itemCost.cat_amount, itemCurrency)} para ${process.cat.name} · total ${formatMoney(itemCost.total_amount, itemCurrency)}`
                          : `${formatMoney(itemCost.cat_amount, itemCurrency)} para ${process.cat.name}`}
                      </p>
                    ) : null}

                    {isEditingCost ? (
                      <form className="cost-editor" onSubmit={handleEditCostSubmit}>
                        {eventCostDraftQuery.isLoading ? <p className="muted">Cargando costo...</p> : null}
                        {eventCostDraftQuery.data?.cat_amounts[0] ? (
                          <>
                            <div className="section-header section-header--compact">
                              <div>
                                <strong>Costo del registro</strong>
                                <p className="muted">
                                  Se mantiene discreto dentro del seguimiento.
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
                                  <label htmlFor={`process-timeline-cost-mode-${item.id}`}>Modo de costo</label>
                                  <select
                                    id={`process-timeline-cost-mode-${item.id}`}
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
                                    <label htmlFor={`process-timeline-shared-total-${item.id}`}>
                                      Total compartido
                                    </label>
                                    <input
                                      id={`process-timeline-shared-total-${item.id}`}
                                      inputMode="decimal"
                                      placeholder="0.00"
                                      value={editingSharedTotalAmount}
                                      onChange={(event) => setEditingSharedTotalAmount(event.target.value)}
                                    />
                                  </div>
                                ) : (
                                  <div className="field">
                                    <label htmlFor={`process-timeline-per-cat-${item.id}`}>
                                      {eventCostDraftQuery.data.cat_amounts[0].cat_name}
                                    </label>
                                    <input
                                      id={`process-timeline-per-cat-${item.id}`}
                                      inputMode="decimal"
                                      placeholder="0.00"
                                      value={editingPerCatAmount}
                                      onChange={(event) => setEditingPerCatAmount(event.target.value)}
                                    />
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
          )}
        </section>
      </div>
    </section>
  );
}
