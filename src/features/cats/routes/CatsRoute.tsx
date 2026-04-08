import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createCat, listActiveCats } from "@/data/queries";

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatJoinedDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
  }).format(new Date(value));
}

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
      <section className="panel cats-hero surface-hero">
        <div className="cats-hero__copy">
          <span className="eyebrow">Perfiles activos</span>
          <h1>Gatos</h1>
          <p className="muted">
            Entra a cada perfil para leer su actividad como un feed cronologico y seguir lo importante sin perder contexto.
          </p>
          <div className="cats-hero__stats">
            <div className="cats-hero__stat">
              <strong>{catsQuery.data?.length ?? 0}</strong>
              <span>Perfiles activos</span>
            </div>
            <div className="cats-hero__stat">
              <strong>Privado</strong>
              <span>Registro compartido entre dos personas</span>
            </div>
          </div>
        </div>

        <section className="panel panel--subtle panel--section cats-create-card">
          <div>
            <span className="eyebrow">Alta rapida</span>
            <h2>Nuevo perfil</h2>
            <p className="muted">Captura minima para empezar a registrar actividad.</p>
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
      </section>

      <div className="page-intro page-intro--inline">
        <div>
          <h2>Perfiles</h2>
          <p className="muted">Cada card funciona como acceso rapido al perfil y timeline de cada gato.</p>
        </div>
      </div>

      <div className="cats-grid">
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
          <Link className="panel panel--subtle profile-card" key={cat.id} to={`/cats/${cat.id}`}>
            <div className="profile-card__media" aria-hidden="true">
              {cat.primary_photo_url ? (
                <img src={cat.primary_photo_url} alt="" />
              ) : (
                <div className="profile-card__avatar">{getInitials(cat.name)}</div>
              )}
            </div>
            <div className="profile-card__body">
              <div className="profile-card__head">
                <div className="list-card__content">
                  <strong>{cat.name}</strong>
                  <p className="muted clamp-two-lines">{cat.notes ?? "Sin notas todavia."}</p>
                </div>
                <span className="status status--soft">Activo</span>
              </div>
              <div className="profile-card__details">
                <span className="profile-card__label">Perfil privado</span>
                <span className="profile-card__label">Timeline disponible</span>
              </div>
              <div className="profile-card__submeta">
                <span className="profile-card__pill">Perfil y feed</span>
                <span className="profile-card__date">Desde {formatJoinedDate(cat.created_at)}</span>
              </div>
              <div className="profile-card__footer">
                <span className="profile-card__meta">Entrar al perfil</span>
                <span className="status-link">Abrir</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
