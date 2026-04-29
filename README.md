# Backlog Doorstop

Este directorio contiene el backlog local de Epicrisis. La fuente de verdad sigue siendo `requirements/req/REQ*.md`; la UI en `ui/` solo lee y escribe esos archivos mediante la API local.

## Estructura

- `requirements/req`: historias y requisitos en Markdown.
- `evidence/sources`: copia local de la fuente original de importación.
- `public`: salida publicada de Doorstop.
- `ui`: app local para navegar, filtrar y editar el backlog sin depender del HTML publicado.

## Flujo local

### Doorstop

```bash
./.venv/bin/doorstop
./.venv/bin/doorstop publish all ./public
```

### UI local

```bash
pnpm install
pnpm dev
```

Comandos disponibles:

- `pnpm dev`: levanta backend local y frontend Vite.
- `pnpm build`: compila la interfaz en `ui/dist`.
- `pnpm check`: ejecuta pruebas del parser y de la API local.
- `pnpm start`: sirve la API y la UI compilada desde Node.

## Qué soporta la UI

- Vista tablero y vista lista sobre el mismo backlog.
- Edición estructurada completa desde el drawer.
- Edición rápida inline desde las cards:
  - cambio de prioridad
  - cambio de responsable
  - mover al estado anterior o siguiente
- Drag & drop nativo entre columnas canónicas:
  - `backlog`
  - `in progress`
  - `testing`
  - `completed`
- Guardado optimista de cambios de estado y edición rápida.
- Rollback visual si falla el guardado o si hay conflicto de versión.
- El drag & drop ya no recarga toda la lista después del guardado; la UI mantiene el estado local y solo revalida lo necesario.
- Filtros persistidos en la URL.
- Accesos rápidos de “próximas acciones”.
- Atajos globales de teclado cuando el foco no está en un campo editable.

## Filtros y URL

La vista sincroniza estado con query params sin recargar la página:

- `q`: búsqueda libre.
- `status`: filtro por estado; admite múltiples valores repetidos.
- `priority`: filtro por prioridad.
- `assignee`: filtro por responsable.
- `tag`: filtro por tag.
- `view`: `board` o `list`.

Ejemplo:

```text
/?q=login&status=backlog&status=testing&priority=p1&view=board
```

Si la URL contiene valores desconocidos, la app los ignora y vuelve al valor local por defecto.

## Próximas acciones

La UI expone accesos rápidos derivados del listado cargado:

- sin responsable
- sin tags
- en `testing`
- prioridad `p0`
- prioridad `p1`
- con criterios vacíos o mínimos

No existe una vista paralela ni un endpoint adicional; estos accesos aplican filtros reales sobre el backlog actual.

## Atajos de teclado

- `/`: enfoca la búsqueda.
- `j`: selecciona la siguiente HU visible.
- `k`: selecciona la HU anterior visible.
- `e`: abre edición estructurada si el drawer ya está abierto.
- `[`: mueve al estado canónico anterior.
- `]`: mueve al estado canónico siguiente.
- `g`: alterna entre tablero y lista.
- `Escape`: cierra el drawer o sale del modo edición.

## Contrato local

La API local mantiene estos endpoints:

- `GET /api/items`
- `GET /api/items/:id`
- `PUT /api/items/:id/structured`
- `PUT /api/items/:id/raw`
- `GET /api/meta`

Los resúmenes de ítems incluyen flags derivados para operar sin abrir el detalle completo:

- `hasAssignee`
- `hasTags`
- `hasCriterios`

La persistencia sigue pasando por `PUT /api/items/:id/structured` o `PUT /api/items/:id/raw`; no hay un segundo modelo de datos.

## Convenciones

- Cada tarjeta del kanban se representa como un ítem `REQ` normativo.
- La categoría original del kanban se conserva en `source_section`, `tags` y `Observaciones`.
- Los estados canónicos de trabajo son `backlog`, `in progress`, `testing` y `completed`.
- La API sigue tolerando estados ya existentes fuera de ese flujo; las acciones rápidas solo navegan dentro del flujo canónico.
- La prioridad se conserva como `p0`, `p1` o `medium`.
- Doorstop queda como herramienta secundaria de validación y publicación; la operación diaria del backlog se hace sobre los archivos Markdown mediante `ui/`.
