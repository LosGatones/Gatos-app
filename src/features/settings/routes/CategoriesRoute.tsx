import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createEventCategory, createEventSubcategory, listEventCategories } from "@/data/queries";

export function CategoriesRoute() {
  const queryClient = useQueryClient();
  const [categoryLabel, setCategoryLabel] = useState("");
  const [categoryCode, setCategoryCode] = useState("");
  const [subcategoryCategoryId, setSubcategoryCategoryId] = useState("");
  const [subcategoryLabel, setSubcategoryLabel] = useState("");
  const [subcategoryCode, setSubcategoryCode] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [subcategoryError, setSubcategoryError] = useState<string | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["categories", "all"],
    queryFn: listEventCategories,
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

  return (
    <section className="stack">
      <div className="panel stack stack--compact">
        <div>
          <h1>Categorias</h1>
          <p className="muted">Lectura y captura minima de categorias y subcategorias.</p>
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
