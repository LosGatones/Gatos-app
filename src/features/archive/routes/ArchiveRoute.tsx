import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listArchivedCats } from "@/data/queries";

export function ArchiveRoute() {
  const archivedCatsQuery = useQuery({
    queryKey: ["cats", "archived"],
    queryFn: listArchivedCats,
  });

  return (
    <section className="stack">
      <div className="panel stack stack--compact">
        <div>
          <h1>Archivo</h1>
          <p className="muted">Gatos archivados en modo consulta.</p>
        </div>
      </div>
      <div className="stack">
        {archivedCatsQuery.isLoading ? (
          <div className="panel">
            <p className="muted">Cargando archivo...</p>
          </div>
        ) : null}
        {archivedCatsQuery.isError ? (
          <div className="panel">
            <p className="error">No fue posible cargar el archivo.</p>
          </div>
        ) : null}
        {!archivedCatsQuery.isLoading && !archivedCatsQuery.isError && !archivedCatsQuery.data?.length ? (
          <div className="panel empty-state">
            <h2>No hay gatos archivados</h2>
            <p className="muted">Los gatos archivados aparecerán aquí para consulta.</p>
          </div>
        ) : null}
        {archivedCatsQuery.data?.map((cat) => (
          <Link className="panel list-row" key={cat.id} to={`/cats/${cat.id}`}>
            <div className="stack stack--compact">
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
