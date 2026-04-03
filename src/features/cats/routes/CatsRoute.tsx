import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createCat, listActiveCats } from "@/data/queries";

export function CatsRoute() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const catsQuery = useQuery({
    queryKey: ["cats", "active"],
    queryFn: listActiveCats,
  });

  const createCatMutation = useMutation({
    mutationFn: createCat,
    onSuccess: async (cat) => {
      setName("");
      setNotes("");
      setLocalError(null);
      await queryClient.invalidateQueries({ queryKey: ["cats"] });
      navigate(`/cats/${cat.id}`);
    },
    onError: (error: Error) => {
      setLocalError(error.message);
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    createCatMutation.mutate({
      name,
      notes,
    });
  }

  return (
    <section className="page">
      <div className="page-intro">
        <div>
          <h1>Gatos</h1>
          <p className="muted">Lista de gatos activos.</p>
        </div>
      </div>

      <section className="panel panel--subtle panel--section stack stack--compact">
        <div>
          <h2>Nuevo gato</h2>
          <p className="muted">Captura minima para empezar a registrar.</p>
        </div>
        <form className="form form--compact" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="cat-name">Nombre</label>
            <input
              id="cat-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nombre del gato"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="cat-notes">Notas</label>
            <textarea
              id="cat-notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Notas generales"
            />
          </div>
          {localError ? <p className="error">{localError}</p> : null}
          <div className="actions">
            <button className="button" type="submit" disabled={createCatMutation.isPending}>
              {createCatMutation.isPending ? "Guardando..." : "Crear gato"}
            </button>
          </div>
        </form>
      </section>

      <div className="stack">
        {catsQuery.isLoading ? (
          <div className="panel panel--subtle">
            <p className="muted">Cargando gatos...</p>
          </div>
        ) : null}
        {catsQuery.isError ? (
          <div className="panel panel--subtle">
            <p className="error">No fue posible cargar los gatos.</p>
          </div>
        ) : null}
        {!catsQuery.isLoading && !catsQuery.isError && !catsQuery.data?.length ? (
          <div className="panel panel--subtle empty-state">
            <h2>No hay gatos activos</h2>
            <p className="muted">Cuando registres un gato, aparecera aqui.</p>
          </div>
        ) : null}
        {catsQuery.data?.map((cat) => (
          <Link className="panel panel--subtle list-row list-card" key={cat.id} to={`/cats/${cat.id}`}>
            <div className="list-card__content">
              <strong>{cat.name}</strong>
              <p className="muted clamp-two-lines">{cat.notes ?? "Sin notas."}</p>
            </div>
            <span className="status-link">Ver detalle</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
