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

  const cats = catsQuery.data ?? [];
  const featuredCat = cats[0] ?? null;

  return (
    <section className="page">
      <section className="panel cats-stage surface-hero">
        <div className="cats-stage__backdrop" aria-hidden="true" />

        <div className="cats-stage__intro">
          <span className="eyebrow">Perfiles activos</span>
          <h1>Una galeria viva para abrir cada historia desde su cara y su ritmo.</h1>
          <p className="muted">
            Esta entrada deja de sentirse administrativa: primero ves perfiles, contexto y acceso directo al feed; la captura queda disponible, pero ya no domina la pantalla.
          </p>

          <div className="cats-stage__metrics">
            <div className="cats-stage__metric">
              <span>Activos</span>
              <strong>{cats.length}</strong>
            </div>
            <div className="cats-stage__metric">
              <span>Espacio</span>
              <strong>Privado</strong>
            </div>
            <div className="cats-stage__metric">
              <span>Lectura</span>
              <strong>Perfil + feed</strong>
            </div>
          </div>
        </div>

        <div className="cats-stage__rail">
          {featuredCat ? (
            <Link className="cats-featured-card" to={`/cats/${featuredCat.id}`}>
              <div className="cats-featured-card__media" aria-hidden="true">
                {featuredCat.primary_photo_url ? (
                  <img src={featuredCat.primary_photo_url} alt="" />
                ) : (
                  <div className="cats-featured-card__avatar">{getInitials(featuredCat.name)}</div>
                )}
              </div>
              <div className="cats-featured-card__body">
                <span className="eyebrow">Entrada sugerida</span>
                <h2>{featuredCat.name}</h2>
                <p className="muted clamp-two-lines">
                  {featuredCat.notes ?? "Perfil listo para abrir timeline, media y seguimientos."}
                </p>
                <div className="cats-featured-card__meta">
                  <span className="status status--soft">Activo</span>
                  <span className="profile-inline-pill">
                    {featuredCat.primary_photo_url ? "Con foto principal" : "Sin foto principal"}
                  </span>
                </div>
                <span className="status-link">Abrir perfil</span>
              </div>
            </Link>
          ) : (
            <div className="cats-featured-card cats-featured-card--empty">
              <span className="eyebrow">Listo para empezar</span>
              <h2>El primer perfil aparecera aqui</h2>
              <p className="muted">
                En cuanto registres un gato, tendras un acceso principal al perfil y su timeline.
              </p>
            </div>
          )}

          <section className="panel panel--subtle panel--section cats-quickform">
            <div className="cats-quickform__intro">
              <span className="eyebrow">Alta rapida</span>
              <h2>Nuevo perfil</h2>
              <p className="muted">
                Solo nombre y contexto breve. El resto vive dentro del perfil.
              </p>
            </div>
            <form className="form form--compact" onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="cat-name">Nombre</label>
                <input
                  id="cat-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ej. Luna"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="cat-notes">Notas iniciales</label>
                <textarea
                  id="cat-notes"
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Caracter, contexto o detalle breve"
                />
              </div>
              {localError ? <p className="error">{localError}</p> : null}
              <div className="actions actions--stretch-mobile">
                <button className="button" type="submit" disabled={createCatMutation.isPending}>
                  {createCatMutation.isPending ? "Guardando..." : "Crear perfil"}
                </button>
              </div>
            </form>
          </section>
        </div>
      </section>

      <div className="page-intro page-intro--inline page-intro--split page-intro--gallery">
        <div>
          <span className="eyebrow">Galeria principal</span>
          <h2>Perfiles listos para abrir</h2>
          <p className="muted">
            Las tarjetas ahora priorizan rostro, estado y acceso. Menos panel administrativo, mas presencia de perfil.
          </p>
        </div>
        <div className="page-intro__meta">
          <span className="status status--neutral">Privado entre 2 personas</span>
          <span className="status status--soft">{cats.length} activos</span>
        </div>
      </div>

      <div className="cats-gallery">
        {catsQuery.isLoading ? (
          <div className="panel panel--subtle empty-state empty-state--tight">
            <p className="muted">Cargando gatos...</p>
          </div>
        ) : null}
        {catsQuery.isError ? (
          <div className="panel panel--subtle empty-state empty-state--tight">
            <p className="error">No fue posible cargar los gatos.</p>
          </div>
        ) : null}
        {!catsQuery.isLoading && !catsQuery.isError && !catsQuery.data?.length ? (
          <div className="panel panel--subtle empty-state cats-empty-state">
            <span className="eyebrow">Todavia vacio</span>
            <h2>No hay perfiles activos</h2>
            <p className="muted">Cuando registres un gato, aparecera aqui con acceso directo a su perfil y timeline.</p>
          </div>
        ) : null}
        {cats.map((cat, index) => (
          <Link className="profile-hero-card" key={cat.id} to={`/cats/${cat.id}`}>
            <div className="profile-hero-card__media" aria-hidden="true">
              {cat.primary_photo_url ? (
                <img src={cat.primary_photo_url} alt="" />
              ) : (
                <div className="profile-hero-card__avatar">{getInitials(cat.name)}</div>
              )}
            </div>
            <div className="profile-hero-card__shade" aria-hidden="true" />
            <div className="profile-hero-card__body">
              <div className="profile-hero-card__head">
                <span className="eyebrow">Perfil {String(index + 1).padStart(2, "0")}</span>
                <span className="status status--soft">Activo</span>
              </div>
              <div className="profile-hero-card__title">
                <strong>{cat.name}</strong>
                <p className="muted clamp-two-lines">{cat.notes ?? "Sin notas todavia."}</p>
              </div>
              <div className="profile-hero-card__tags">
                <span className="profile-hero-card__tag">Perfil privado</span>
                <span className="profile-hero-card__tag">Feed cronologico</span>
                <span className="profile-hero-card__tag">
                  {cat.primary_photo_url ? "Con foto" : "Sin foto"}
                </span>
              </div>
              <div className="profile-hero-card__footer">
                <span className="profile-hero-card__date">Desde {formatJoinedDate(cat.created_at)}</span>
                <span className="status-link">Entrar al perfil</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
