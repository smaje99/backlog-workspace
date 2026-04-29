# Backlog Workspace

Este repositorio contiene una UI local para explorar y editar un backlog en Markdown.

El backend está preparado para leer archivos `REQ*.md` desde `requirements/req/` en la raíz del workspace. En este checkout esa carpeta puede no estar presente, pero ese es el contrato que usa la aplicación.

## Qué incluye

- Un backlog en Markdown cuando el árbol `requirements/req/` está disponible.
- Una API local para leer, filtrar y guardar items.
- Una interfaz web para navegar el backlog, editar detalles y mover elementos entre estados.
- Pruebas para el parser y para el contrato HTTP de la API local.

## Estructura del proyecto

- `ui/`: app local con frontend React/Vite y backend Node.
- `ui/server/`: API local y lógica de persistencia.
- `ui/client/`: interfaz de usuario.
- `ui/test/`: tests del parser y de la API.

## Formato de los REQ

Cada archivo `REQ*.md` sigue esta estructura:

- frontmatter YAML con campos como `status`, `priority`, `assignee`, `tags` y `links`.
- un encabezado H1 con el título del item.
- secciones H2 canónicas:
  - `Historia`
  - `Alcance`
  - `Criterios de aceptacion`
  - `Notas tecnicas`
  - `Observaciones`

La UI valida ese formato al guardar. Las secciones marcadas como obligatorias no pueden quedar vacías.

## Funcionalidad de la UI

- Vista tablero y vista lista sobre el mismo backlog.
- Filtros por búsqueda, estado, prioridad, responsable y tag.
- Accesos rápidos para detectar items sin responsable, sin tags o sin criterios.
- Edición estructurada completa desde un drawer.
- Edición rápida inline para prioridad, responsable y cambio de estado.
- Drag and drop entre los estados canónicos:
  - `backlog`
  - `in progress`
  - `testing`
  - `completed`
- Guardado optimista con rollback visual si falla la persistencia.
- Control de concurrencia por versión para evitar sobrescribir cambios externos.
- Filtros sincronizados con la URL.
- Atajos globales de teclado cuando el foco no está en un campo editable.

## API local

La app expone estos endpoints:

- `GET /api/items`
- `GET /api/items/:id`
- `PUT /api/items/:id/structured`
- `PUT /api/items/:id/raw`
- `GET /api/meta`

Además, el backend sirve la UI compilada si existe `ui/dist`, o responde con un mensaje informativo cuando solo está activa la API.

## Scripts

Desde la raíz del repositorio:

```bash
pnpm install
pnpm dev
pnpm build
pnpm check
pnpm start
```

- `pnpm dev`: levanta la UI en desarrollo con backend local.
- `pnpm build`: compila la interfaz en `ui/dist`.
- `pnpm check`: ejecuta las pruebas.
- `pnpm start`: sirve la API y la UI compilada.

## Convenciones

- Cada tarjeta del tablero representa un item normativo `REQ`.
- La prioridad admite `p0`, `p1`, `high`, `medium` y `low`.
- La API conserva estados no canónicos si ya existen en los archivos.
- Los cambios se guardan sobre el archivo Markdown correspondiente y no en una base de datos separada.
