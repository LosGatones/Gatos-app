# AGENTS.md

## Objetivo del proyecto

Construir una PWA pequeña, pulida y confiable para registro y seguimiento de gatos, pensada para 2 usuarios cerrados con edición compartida, bajo costo operativo y capacidad de crecer sin rehacer la base. 

Esta app NO es una clínica veterinaria, NO es un SaaS genérico y NO debe sonar como software administrativo veterinario comercial.
Es una herramienta privada, íntima y funcional para seguimiento de gatos y sus eventos, procesos y registros. Son 2 personas llevando el control en general de sus gatos. Hasta podrían subir fotos.

## Prioridades

1. Interfaz muy pulida, limpia e intuitiva
2. Facilidad de construcción y mantenimiento con Codex
3. Costo operativo casi cero al inicio
4. Arquitectura desacoplada para voz/IA
5. Colaboración simple entre 2 usuarios sin edición simultánea compleja

## Restricciones

- Uso principal en móvil iPhone/Android, pero debe responder bien en escritorio.
- Solo hay 2 usuarios cerrados.
- La seguridad debe ser simple pero real.
- La colaboración es rápida/asíncrona, no tipo Google Docs.
- Offline aplica solo a registros manuales normales.
- Chat/voz no requiere soporte offline.
- La información es privada.
- Compartir con terceros debe ser puntual y controlado.
- Los gatos archivados salen de vistas normales, quedan solo para consulta y no admiten edición hasta reactivarse.
- No expandir alcance sin razón clara de producto.
- No meter infraestructura innecesariamente compleja.
- No asumir branding veterinario, slogans, copys publicitarios ni tono “clínica”.

## Definición del producto

- La app maneja gatos, eventos, procesos clínicos, adjuntos, bitácora y costos por gato.
- Debe existir perfil del gato, timeline por gato y procesos clínicos con subtimeline.
- Un evento puede afectar a uno o varios gatos.
- La bitácora interna debe registrar quién hizo cada cambio, pero no dominar la UI.
- El módulo de voz/IA debe existir como módulo separado y embebido, no como centro de toda la app.
- El dictado en campos libres es una ayuda de captura, separado del asistente principal.

## Reglas de modelado

- Usar modelo relacional como base del dominio.
- Usar entidades explícitas; evitar blobs JSON gigantes para información estructurada.

### Entidades núcleo esperadas

- `cats`
- `events`
- `event_categories`
- `event_subcategories`
- `event_cats`
- `clinical_processes`
- `attachments`
- `audit_log`
- `event_costs`
- `event_cost_items`
- `event_cat_costs`

### Reglas del dominio

- Un evento puede afectar a uno o varios gatos.
- Un proceso clínico pertenece a un solo gato.
- La subtimeline de un proceso se resuelve con eventos ligados a `process_id`.
- El log de auditoría es obligatorio.

## Reglas de costos

- Los costos son opcionales.
- Los costos deben quedar bien mapeados por gato.
- Deben soportar un solo modo por evento:
  - `none`
  - `per_cat`
  - `shared_total`
- Nunca mezclar `per_cat` y `shared_total` dentro del mismo evento.
- Si el costo es total compartido, no duplicarlo completo por cada gato.
- El monto final por gato debe materializarse explícitamente en `event_cat_costs`.
- El total gastado por gato siempre debe derivarse de `event_cat_costs`.
- El desglose por conceptos es opcional y subordinado al costo principal.
- Cambios de costo, modo, gatos afectados o desglose deben dejar trazabilidad en `audit_log`.
- La UI no debe gritar el costo; debe mostrarse como información secundaria dentro del detalle del evento y en el acumulado por gato.

## Reglas de UI/UX

- La UI debe sentirse limpia, moderna y clara.
- Debe evitar exceso de cajas, tarjetas pesadas o paneles saturados.
- Priorizar jerarquía visual, tipografía limpia, espacios bien resueltos y baja fricción de captura.
- El timeline por gato es una vista principal del producto.
- Un proceso clínico debe verse como un evento principal en el timeline del gato y abrir su propia subtimeline.
- Crear/editar debe resolverse preferentemente con sheets, modales o paneles ligeros, no con pantallas largas innecesarias.
- El log interno debe estar accesible pero discreto.
- Mantener la experiencia ligera, táctil y usable en móvil desde el inicio.
- Evitar interfaces SaaS genéricas, dashboards administrativos y copys incongruentes.

### Preferencia visual

Usar esta paleta como guía visual base:

- Primario morado: `#7848A8`
- Morado profundo / hover: `#583A79`
- Morado ciruela de apoyo: `#974F84`
- Secundario amarillo: `#FC9C06`
- Amarillo cálido de apoyo / hover: `#FEB641`
- Fondo claro sugerido: `#FFFFFF`
- Texto oscuro sugerido: `#3C2355`

Reglas visuales:
- Usar el morado como color primario de botones y acentos principales.
- Usar el amarillo como secundario en botones o estados destacados.
- Mantener alto contraste y buena legibilidad.
- Interfaz limpia, respirada y con pocas cajas.

## Reglas sobre skills

- Cuando la tarea sea visual o de interfaz, priorizar una skill de frontend/UI que emule una estética tipo Liquid Glass de Apple.
- Esa skill debe usarse solo para exploración y construcción visual del frontend.
- No usar skills de frontend para imponer backend, dominio o modelo de datos.
- Si la estética visual entra en conflicto con legibilidad, contraste o usabilidad, prevalece la usabilidad.

## Reglas del módulo Assistant / voz / IA

- Debe vivir en una superficie aislada del resto de la UI, tipo chat embebido.
- Debe aceptar voz y texto.
- Debe servir para registrar y consultar.
- La interpretación del lenguaje natural debe convertirse en acciones estructuradas.
- No acoplar la lógica del asistente directamente a tablas; debe operar mediante acciones de dominio acotadas.

## Forma de trabajar

- Antes de implementar cambios grandes:
  1. proponer plan corto
  2. explicar impacto en datos
  3. indicar pantallas afectadas
  4. listar riesgos
- Favorecer soluciones simples, legibles y extensibles sobre abstracciones prematuras.
- Mantener desacopladas las capas de:
  - UI
  - dominio
  - persistencia
  - Assistant/voz/IA
- Hacer cambios pequeños, revisables y coherentes.
- No reescribir grandes partes sin justificarlo.
- Si una decisión compromete costos, archivado, procesos clínicos o trazabilidad, priorizar consistencia antes que velocidad.

## Qué hacer al iniciar un proyecto nuevo

Antes de escribir código:
1. leer este AGENTS.md
2. entrevistar al usuario para fijar correctamente el producto
3. resumir qué es y qué no es la app
4. proponer arquitectura
5. proponer modelo de datos
6. proponer rutas/pantallas
7. esperar aprobación antes de implementar

## Si falta contexto

Haz supuestos razonables, márcalos claramente y sigue avanzando sin inflar el alcance.