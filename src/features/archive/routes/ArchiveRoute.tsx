import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { deleteArchivedCat, listArchivedCats } from "@/data/queries";

export function ArchiveRoute() {
  const queryClient = useQueryClient();
  const [catPendingDelete, setCatPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const archivedCatsQuery = useQuery({
    queryKey: ["cats", "archived"],
    queryFn: listArchivedCats,
  });

  const deleteCatMutation = useMutation({
    mutationFn: deleteArchivedCat,
    onSuccess: async () => {
      setLocalError(null);
      setCatPendingDelete(null);
      await queryClient.invalidateQueries({ queryKey: ["cats"] });
    },
    onError: (error: Error) => {
      setLocalError(error.message);
      setCatPendingDelete(null);
    },
  });

  function handleAskDelete(cat: { id: string; name: string }) {
    setLocalError(null);
    setCatPendingDelete(cat);
  }

  function handleCancelDelete() {
    if (deleteCatMutation.isPending) {
      return;
    }

    setCatPendingDelete(null);
  }

  function handleConfirmDelete() {
    if (!catPendingDelete) {
      return;
    }

    deleteCatMutation.mutate(catPendingDelete.id);
  }

  return (
    <section className="page">
      <div className="page-intro">
        <div>
          <h1>Archivo</h1>
          <p className="muted">Gatos archivados en modo consulta.</p>
        </div>
      </div>
      {localError ? (
        <div className="panel panel--subtle">
          <p className="error">{localError}</p>
        </div>
      ) : null}
      <div className="stack">
        {archivedCatsQuery.isLoading ? (
          <div className="panel panel--subtle">
            <p className="muted">Cargando archivo...</p>
          </div>
        ) : null}
        {archivedCatsQuery.isError ? (
          <div className="panel panel--subtle">
            <p className="error">No fue posible cargar el archivo.</p>
          </div>
        ) : null}
        {!archivedCatsQuery.isLoading && !archivedCatsQuery.isError && !archivedCatsQuery.data?.length ? (
          <div className="panel panel--subtle empty-state">
            <h2>No hay gatos archivados</h2>
            <p className="muted">Los gatos archivados aparecerán aquí para consulta.</p>
          </div>
        ) : null}
        {archivedCatsQuery.data?.map((cat) => (
          <article className="panel panel--subtle list-card list-card--archived" key={cat.id}>
            <Link className="list-row" to={`/cats/${cat.id}`}>
              <div className="list-card__content">
                <strong>{cat.name}</strong>
                <p className="muted clamp-two-lines">{cat.notes ?? "Sin notas."}</p>
              </div>
              <span className="status-link">Consultar</span>
            </Link>
            <div className="archive-card__actions">
              <button
                className="button button--ghost button--danger button--small"
                type="button"
                onClick={() => handleAskDelete({ id: cat.id, name: cat.name })}
                disabled={deleteCatMutation.isPending}
              >
                Eliminar gato
              </button>
            </div>
          </article>
        ))}
      </div>
      {catPendingDelete ? (
        <div className="dialog-backdrop" role="presentation">
          <div
            aria-labelledby="delete-cat-title"
            aria-modal="true"
            className="panel panel--subtle dialog-card"
            role="dialog"
          >
            <div className="stack stack--compact">
              <h2 id="delete-cat-title">Eliminar gato</h2>
              <p>
                {catPendingDelete.name} se eliminara de forma permanente. Esta accion no se puede
                deshacer.
              </p>
              <p className="muted">
                Solo continuara si este gato archivado no tiene registros relacionados.
              </p>
            </div>
            <div className="actions">
              <button
                className="button button--secondary"
                type="button"
                onClick={handleCancelDelete}
                disabled={deleteCatMutation.isPending}
              >
                Cancelar
              </button>
              <button
                className="button button--danger"
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteCatMutation.isPending}
              >
                {deleteCatMutation.isPending ? "Eliminando..." : "Aceptar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
