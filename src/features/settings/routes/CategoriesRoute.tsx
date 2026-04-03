import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createClinicalProcessType,
  createEventCategory,
  createEventSubcategory,
  listClinicalProcessTypes,
  listEventCategories,
  setClinicalProcessTypeActiveState,
  updateClinicalProcessTypeLabel,
} from "@/data/queries";

export function CategoriesRoute() {
  const queryClient = useQueryClient();
  const [categoryLabel, setCategoryLabel] = useState("");
  const [categoryCode, setCategoryCode] = useState("");
  const [subcategoryCategoryId, setSubcategoryCategoryId] = useState("");
  const [subcategoryLabel, setSubcategoryLabel] = useState("");
  const [subcategoryCode, setSubcategoryCode] = useState("");
  const [processTypeLabel, setProcessTypeLabel] = useState("");
  const [processTypeCode, setProcessTypeCode] = useState("");
  const [editingProcessTypeId, setEditingProcessTypeId] = useState<string | null>(null);
  const [editingProcessTypeLabel, setEditingProcessTypeLabel] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [subcategoryError, setSubcategoryError] = useState<string | null>(null);
  const [processTypeError, setProcessTypeError] = useState<string | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["categories", "all"],
    queryFn: listEventCategories,
  });

  const processTypesQuery = useQuery({
    queryKey: ["process-types", "all"],
    queryFn: listClinicalProcessTypes,
  });

  const activeCategories = useMemo(
    () => categoriesQuery.data?.filter((category) => category.is_active) ?? [],
    [categoriesQuery.data],
  );

  const createCategoryMutation = useMutation({
    mutationFn: createEventCategory,
    onSuccess: async () => {
      setCategoryLabel("");
      setCategoryCode("");
      setCategoryError(null);
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (error: Error) => {
      setCategoryError(error.message);
    },
  });

  const createSubcategoryMutation = useMutation({
    mutationFn: createEventSubcategory,
    onSuccess: async () => {
      setSubcategoryCategoryId("");
      setSubcategoryLabel("");
      setSubcategoryCode("");
      setSubcategoryError(null);
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (error: Error) => {
      setSubcategoryError(error.message);
    },
  });

  const createProcessTypeMutation = useMutation({
    mutationFn: createClinicalProcessType,
    onSuccess: async () => {
      setProcessTypeLabel("");
      setProcessTypeCode("");
      setProcessTypeError(null);
      await queryClient.invalidateQueries({ queryKey: ["process-types"] });
    },
    onError: (error: Error) => {
      setProcessTypeError(error.message);
    },
  });

  const updateProcessTypeMutation = useMutation({
    mutationFn: updateClinicalProcessTypeLabel,
    onSuccess: async () => {
      setEditingProcessTypeId(null);
      setEditingProcessTypeLabel("");
      setProcessTypeError(null);
      await queryClient.invalidateQueries({ queryKey: ["process-types"] });
    },
    onError: (error: Error) => {
      setProcessTypeError(error.message);
    },
  });

  const toggleProcessTypeMutation = useMutation({
    mutationFn: setClinicalProcessTypeActiveState,
    onSuccess: async () => {
      setProcessTypeError(null);
      await queryClient.invalidateQueries({ queryKey: ["process-types"] });
    },
    onError: (error: Error) => {
      setProcessTypeError(error.message);
    },
  });

  function handleCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCategoryError(null);
    createCategoryMutation.mutate({
      label: categoryLabel,
      code: categoryCode,
    });
  }

  function handleSubcategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubcategoryError(null);
    createSubcategoryMutation.mutate({
      category_id: subcategoryCategoryId,
      label: subcategoryLabel,
      code: subcategoryCode,
    });
  }

  function handleProcessTypeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProcessTypeError(null);
    createProcessTypeMutation.mutate({
      label: processTypeLabel,
      code: processTypeCode,
    });
  }

  function handleProcessTypeUpdateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingProcessTypeId) {
      return;
    }

    setProcessTypeError(null);
    updateProcessTypeMutation.mutate({
      id: editingProcessTypeId,
      label: editingProcessTypeLabel,
    });
  }

  return (
    <section className="stack">
      <div className="panel stack stack--compact">
        <div>
          <h1>Catalogos</h1>
          <p className="muted">Categorias de eventos y tipos de procesos clinicos editables.</p>
        </div>
      </div>

      <div className="two-column">
        <section className="panel stack stack--compact">
          <div>
            <h2>Nueva categoria</h2>
            <p className="muted">Si no existe ninguna, puedes crear la primera aqui.</p>
          </div>
          <form className="form" onSubmit={handleCategorySubmit}>
            <div className="field">
              <label htmlFor="category-label">Nombre</label>
              <input
                id="category-label"
                value={categoryLabel}
                onChange={(event) => setCategoryLabel(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="category-code">Codigo opcional</label>
              <input
                id="category-code"
                value={categoryCode}
                onChange={(event) => setCategoryCode(event.target.value)}
                placeholder="Se genera si lo dejas vacio"
              />
            </div>
            {categoryError ? <p className="error">{categoryError}</p> : null}
            <div className="actions">
              <button className="button" type="submit" disabled={createCategoryMutation.isPending}>
                {createCategoryMutation.isPending ? "Guardando..." : "Crear categoria"}
              </button>
            </div>
          </form>
        </section>

        <section className="panel stack stack--compact">
          <div>
            <h2>Nueva subcategoria</h2>
            <p className="muted">Ligada a una categoria existente.</p>
          </div>
          <form className="form" onSubmit={handleSubcategorySubmit}>
            <div className="field">
              <label htmlFor="subcategory-category">Categoria</label>
              <select
                id="subcategory-category"
                value={subcategoryCategoryId}
                onChange={(event) => setSubcategoryCategoryId(event.target.value)}
                disabled={!activeCategories.length}
                required
              >
                <option value="">Selecciona una categoria</option>
                {activeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="subcategory-label">Nombre</label>
              <input
                id="subcategory-label"
                value={subcategoryLabel}
                onChange={(event) => setSubcategoryLabel(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="subcategory-code">Codigo opcional</label>
              <input
                id="subcategory-code"
                value={subcategoryCode}
                onChange={(event) => setSubcategoryCode(event.target.value)}
                placeholder="Se genera si lo dejas vacio"
              />
            </div>
            {subcategoryError ? <p className="error">{subcategoryError}</p> : null}
            <div className="actions">
              <button
                className="button"
                type="submit"
                disabled={!activeCategories.length || createSubcategoryMutation.isPending}
              >
                {createSubcategoryMutation.isPending ? "Guardando..." : "Crear subcategoria"}
              </button>
            </div>
          </form>
        </section>
      </div>

      <div className="two-column">
        <section className="panel stack stack--compact">
          <div>
            <h2>Nuevo tipo de proceso</h2>
            <p className="muted">Se usa para clasificar seguimientos clinicos.</p>
          </div>
          <form className="form" onSubmit={handleProcessTypeSubmit}>
            <div className="field">
              <label htmlFor="process-type-label">Nombre</label>
              <input
                id="process-type-label"
                value={processTypeLabel}
                onChange={(event) => setProcessTypeLabel(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="process-type-code">Codigo opcional</label>
              <input
                id="process-type-code"
                value={processTypeCode}
                onChange={(event) => setProcessTypeCode(event.target.value)}
                placeholder="Se genera si lo dejas vacio"
              />
            </div>
            {processTypeError ? <p className="error">{processTypeError}</p> : null}
            <div className="actions">
              <button className="button" type="submit" disabled={createProcessTypeMutation.isPending}>
                {createProcessTypeMutation.isPending ? "Guardando..." : "Crear tipo"}
              </button>
            </div>
          </form>
        </section>

        <section className="panel stack stack--compact">
          <div>
            <h2>Editar tipo</h2>
            <p className="muted">Puedes renombrar o activar e inactivar sin romper historial.</p>
          </div>
          {!editingProcessTypeId ? (
            <div className="panel panel--subtle empty-state empty-state--tight">
              <p className="muted">Elige un tipo de la lista para editarlo aqui.</p>
            </div>
          ) : (
            <form className="form" onSubmit={handleProcessTypeUpdateSubmit}>
              <div className="field">
                <label htmlFor="process-type-edit-label">Nombre</label>
                <input
                  id="process-type-edit-label"
                  value={editingProcessTypeLabel}
                  onChange={(event) => setEditingProcessTypeLabel(event.target.value)}
                  required
                />
              </div>
              <div className="actions">
                <button className="button" type="submit" disabled={updateProcessTypeMutation.isPending}>
                  {updateProcessTypeMutation.isPending ? "Guardando..." : "Guardar nombre"}
                </button>
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => {
                    setEditingProcessTypeId(null);
                    setEditingProcessTypeLabel("");
                    setProcessTypeError(null);
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </section>
      </div>

      <div className="stack">
        {processTypesQuery.isLoading ? (
          <div className="panel">
            <p className="muted">Cargando tipos de proceso...</p>
          </div>
        ) : null}
        {processTypesQuery.isError ? (
          <div className="panel">
            <p className="error">No fue posible cargar los tipos de proceso.</p>
          </div>
        ) : null}
        {processTypesQuery.data?.length ? (
          <section className="panel stack stack--compact">
            <div>
              <h2>Tipos de proceso</h2>
              <p className="muted">El selector de nuevos procesos solo muestra los que están activos.</p>
            </div>
            <div className="stack stack--compact">
              {processTypesQuery.data.map((processType) => (
                <article className="catalog-row" key={processType.id}>
                  <div>
                    <strong>{processType.label}</strong>
                    <p className="muted">{processType.code}</p>
                  </div>
                  <div className="catalog-row__actions">
                    <span className={`status ${processType.is_active ? "" : "status--neutral"}`}>
                      {processType.is_active ? "Activo" : "Inactivo"}
                    </span>
                    <button
                      className="button button--ghost button--small"
                      type="button"
                      onClick={() => {
                        setEditingProcessTypeId(processType.id);
                        setEditingProcessTypeLabel(processType.label);
                        setProcessTypeError(null);
                      }}
                    >
                      Editar
                    </button>
                    <button
                      className="button button--secondary button--small"
                      type="button"
                      onClick={() =>
                        toggleProcessTypeMutation.mutate({
                          id: processType.id,
                          is_active: !processType.is_active,
                        })
                      }
                      disabled={toggleProcessTypeMutation.isPending}
                    >
                      {processType.is_active ? "Inactivar" : "Activar"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <div className="stack">
        {categoriesQuery.isLoading ? (
          <div className="panel">
            <p className="muted">Cargando categorias...</p>
          </div>
        ) : null}
        {categoriesQuery.isError ? (
          <div className="panel">
            <p className="error">No fue posible cargar las categorias.</p>
          </div>
        ) : null}
        {!categoriesQuery.isLoading && !categoriesQuery.isError && !categoriesQuery.data?.length ? (
          <div className="panel empty-state">
            <h2>No hay categorias registradas</h2>
            <p className="muted">Cuando existan categorias y subcategorias, apareceran aqui.</p>
          </div>
        ) : null}
        {categoriesQuery.data?.map((category) => (
          <article className="panel stack stack--compact" key={category.id}>
            <div className="category-header">
              <div>
                <h2>{category.label}</h2>
                <p className="muted">{category.code}</p>
              </div>
              <span className={`status ${category.is_active ? "" : "status--neutral"}`}>
                {category.is_active ? "Activa" : "Inactiva"}
              </span>
            </div>
            {!category.subcategories.length ? (
              <p className="muted">Sin subcategorias.</p>
            ) : (
              <ul className="subcategories-list">
                {category.subcategories.map((subcategory) => (
                  <li key={subcategory.id}>
                    <span>{subcategory.label}</span>
                    <span className="muted">{subcategory.code}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
