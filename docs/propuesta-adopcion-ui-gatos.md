# Propuesta de adopcion de interfaz para GATOS_APP

Fecha: 14 de abril de 2026

## Resumen

Si es posible incorporar la interfaz ubicada en `C:\Users\Christian\Downloads\Interfaz PWA seguimiento gatos` dentro de `GATOS_APP`, pero debe hacerse como una adopcion visual progresiva y no como reemplazo directo del frontend actual.

La razon principal es que `GATOS_APP` ya contiene un dominio real y reglas importantes de producto:

- eventos multi-gato
- procesos clinicos con subtimeline
- costos por gato con modos `none`, `per_cat` y `shared_total`
- archivado de gatos
- adjuntos y foto principal
- trazabilidad y base relacional pensada para crecer

La interfaz externa funciona bien como referencia visual y de interaccion movil, pero hoy depende de mocks y simplifica reglas clave del producto.

## Que es y que no es esta adopcion

Esto si es:

- una mejora fuerte de UI/UX
- una migracion visual hacia una experiencia movil mas pulida
- una adopcion de layout, ritmo visual, timeline y sheets ligeros
- una reconstruccion de pantallas sobre el dominio existente

Esto no es:

- rehacer la app desde cero
- reemplazar el modelo de datos actual por mocks del prototipo
- meter todas las librerias del prototipo sin filtro
- sacrificar reglas de costos, procesos, archivado o trazabilidad por una UI mas vistosa

## Direccion visual propuesta

Se propone una direccion visual tipo glass ligero y tactil, inspirada en el prototipo revisado, pero ajustada a las reglas del producto:

- superficies claras, respiradas y con blur moderado
- jerarquia visual basada en perfil + feed
- timeline del gato como vista principal de lectura
- captura en sheets o paneles ligeros
- costos discretos y secundarios
- uso de la paleta del proyecto:
  - primario `#7848A8`
  - profundo `#583A79`
  - apoyo ciruela `#974F84`
  - secundario `#FC9C06`
  - apoyo calido `#FEB641`
  - texto `#3C2355`

Nota:
La estetica glass debe usarse con moderacion. Si en algun punto reduce legibilidad, contraste o velocidad de captura, se prioriza la usabilidad.

## Plan corto

### Fase 1. Base visual compartida

Objetivo:
Crear el lenguaje visual comun sin tocar el dominio.

Trabajo:

- redefinir tokens visuales globales en `src/styles.css`
- modernizar `AppShell` con header mas ligero y navegacion mas tactil
- preparar utilidades visuales reutilizables para paneles, pills, timeline y sheets
- conservar React Query, router y auth tal como estan

Resultado:
La app cambia de sensacion visual sin alterar datos ni flujos base.

### Fase 2. Lista de gatos

Objetivo:
Llevar `CatsRoute` a una vista mas editorial y movil, con mejor lectura.

Trabajo:

- convertir la grilla actual en tarjetas de perfil mas pulidas
- priorizar foto, nombre, estado y ultima actividad
- mantener la logica real de gatos activos y archivados

Resultado:
Entrada principal mas clara y alineada con la direccion de producto.

### Fase 3. Perfil del gato + feed principal

Objetivo:
Transformar `CatDetailRoute` en la vista principal de perfil + timeline.

Trabajo:

- hero del perfil del gato
- reorganizar informacion primaria, acciones y resumen
- presentar timeline con mas calidad visual y menos densidad administrativa
- conservar eventos multi-gato, procesos, adjuntos, foto principal y costo acumulado

Resultado:
El detalle del gato se vuelve la vista central del producto.

### Fase 4. Composer ligero

Objetivo:
Sustituir la captura larga por una experiencia mas tactil.

Trabajo:

- rediseñar `QuickComposer` como sheet ligero
- mantener soporte para:
  - evento simple
  - evento multi-gato
  - proceso clinico
  - costo opcional
- no mezclar reglas de dominio dentro del componente visual

Resultado:
Captura mas rapida sin perder estructura ni validaciones.

### Fase 5. Detalle de proceso clinico

Objetivo:
Convertir `ProcessDetailRoute` en una subtimeline clara y legible.

Trabajo:

- destacar el proceso como seguimiento especial
- mostrar estado, tipo, fechas y eventos del proceso con jerarquia clara
- mantener el vinculo natural con el timeline del gato

Resultado:
Los procesos clinicos se leen como hilos especiales, no como un modulo separado y pesado.

### Fase 6. Ajuste fino y endurecimiento

Objetivo:
Cerrar la migracion visual con estabilidad y consistencia.

Trabajo:

- revisar responsive movil y escritorio
- corregir contraste y accesibilidad
- validar estados vacios, carga y error
- eliminar cualquier dependencia visual no esencial

Resultado:
Interfaz mas pulida y sostenible.

## Impacto en datos

Impacto esperado en esta iniciativa: bajo o nulo en esquema.

No se propone cambiar por ahora:

- tablas
- relaciones
- reglas de costos
- reglas de procesos
- politica de archivado
- auditoria
- estructura de persistencia

Solo podria haber impacto de datos si, mas adelante, decidimos:

- agregar metadatos visuales al perfil del gato
- incorporar portada o fotos destacadas extra
- mejorar adjuntos con orden o captions mas ricos

Eso seria una decision aparte y no es necesario para esta adopcion inicial.

## Pantallas afectadas

Pantallas directas:

- `src/app/layouts/AppShell.tsx`
- `src/features/cats/routes/CatsRoute.tsx`
- `src/features/cats/routes/CatDetailRoute.tsx`
- `src/features/processes/routes/ProcessDetailRoute.tsx`
- `src/features/composer/components/QuickComposer.tsx`
- `src/styles.css`

Pantallas con impacto indirecto:

- `src/features/archive/routes/ArchiveRoute.tsx`
- `src/features/settings/routes/CategoriesRoute.tsx`
- componentes visuales reutilizados desde futuras superficies

## Riesgos

### 1. Copiar la UI del prototipo demasiado literal

Riesgo:
Terminar importando una interfaz pensada con mocks y no con el dominio real.

Mitigacion:
Tomar patrones visuales y de interaccion, no estructura de datos.

### 2. Inflar dependencias innecesarias

Riesgo:
Agregar librerias pesadas para resolver cosas que hoy pueden hacerse con CSS y React.

Mitigacion:
Introducir dependencias solo si resuelven algo concreto y repetible.

### 3. Perder claridad de producto

Riesgo:
Que la app se vea como dashboard SaaS o como software veterinario generico.

Mitigacion:
Mantener el tono privado, intimo, funcional y centrado en perfil + feed.

### 4. Romper reglas de costos o multi-gato

Riesgo:
Simplificar la captura visual y perder reglas importantes del dominio.

Mitigacion:
Mantener las validaciones y tipos actuales como fuente de verdad.

### 5. Glass excesivo o poco legible

Riesgo:
Bonito en mock, incomodo en uso real.

Mitigacion:
Aplicar blur y translucidez con moderacion y medir contraste desde movil.

## Recomendaciones tecnicas

- Mantener el stack actual de `GATOS_APP` como base.
- No migrar a Tailwind ni a un kit UI completo en esta etapa.
- No importar el prototipo entero.
- Reutilizar solo ideas visuales y ciertas composiciones.
- Hacer la migracion por archivos pequenos y revisables.

## Orden recomendado de implementacion

1. `src/styles.css`
2. `src/app/layouts/AppShell.tsx`
3. `src/features/cats/routes/CatsRoute.tsx`
4. `src/features/cats/routes/CatDetailRoute.tsx`
5. `src/features/composer/components/QuickComposer.tsx`
6. `src/features/processes/routes/ProcessDetailRoute.tsx`
7. ajustes secundarios en archivo y catalogos

## Criterios de exito

- la app se siente claramente mas pulida en movil
- el timeline del gato gana protagonismo y legibilidad
- la captura nueva reduce friccion
- no se rompe el dominio actual
- no aumenta innecesariamente la complejidad operativa
- la base queda lista para seguir creciendo sin rehacer otra vez la UI

## Proxima accion sugerida

Implementar primero Fase 1 y Fase 2:

- nueva base visual global
- nuevo `AppShell`
- nueva lista de gatos

Eso permite validar la direccion visual rapido, con riesgo bajo y sin tocar aun la parte mas sensible del timeline y composer.
