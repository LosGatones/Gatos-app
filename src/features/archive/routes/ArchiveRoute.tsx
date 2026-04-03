import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listArchivedCats } from "@/data/queries";

export function ArchiveRoute() {
  const archivedCatsQuery = useQuery({
    queryKey: ["cats", "archived"],
    queryFn: listArchivedCats,
  });

  return (
    <section className="page">
      <div className="page-intro">
        <div>
          <h1>Archivo</h1>
          <p className="muted">Gatos archivados en modo consulta.</p>
        </div>
      </div>
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
          <Link className="panel panel--subtle list-row list-card" key={cat.id} to={`/cats/${cat.id}`}>
            <div className="list-card__content">
              <strong>{cat.name}</strong>
              <p className="muted clamp-two-lines">{cat.notes ?? "Sin notas."}</p>
            </div>
            <span className="status-link">Consultar</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
