import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { toast } from "sonner";

import { fetchItem, saveRawItem, saveStructuredItem } from "@/lib/api";
import {
  DEFAULT_PRIORITY_OPTIONS,
  STATUS_COLUMNS,
  getAdjacentCanonicalStatus,
  getStatusLabel,
  sortPriorityValues
} from "@/lib/status";
import type { BacklogItem, ItemSummary, MetaCounts, Sections } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type DetailMode = "view" | "structured" | "advanced";

type StructuredDraft = {
  version: string;
  title: string;
  status: string;
  priority: string;
  assignee: string;
  tagsText: string;
  sections: Sections;
};

type Props = {
  open: boolean;
  item: BacklogItem | null;
  loading: boolean;
  meta: MetaCounts | null;
  relatedItems: Record<string, ItemSummary>;
  navigableItems: ItemSummary[];
  selectedOutsideFilter: boolean;
  onClose: () => void;
  onSelectLink: (id: string) => void;
  onItemSync: (item: BacklogItem) => Promise<void> | void;
};

export type ItemDetailHandle = {
  canLeaveCurrentItem: () => boolean;
  openStructuredEditor: () => void;
  requestClose: () => void;
  handleEscape: () => void;
  moveStatus: (direction: "previous" | "next") => void;
};

const STRUCTURED_SECTION_LABELS: Array<[keyof Sections, string]> = [
  ["historia", "Historia"],
  ["alcance", "Alcance"],
  ["criterios", "Criterios de aceptación"],
  ["notas", "Notas técnicas"],
  ["observaciones", "Observaciones"]
];

const DEFAULT_STATUSES = STATUS_COLUMNS.map((column) => column.id);
function toDraft(item: BacklogItem): StructuredDraft {
  return {
    version: item.version,
    title: item.title,
    status: item.status,
    priority: item.priority,
    assignee: item.assignee,
    tagsText: item.tags.join(", "),
    sections: { ...item.sections }
  };
}

function normalizeTags(tagsText: string) {
  return tagsText
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function splitBreadcrumb(sourceSection: string) {
  return sourceSection
    .split("::")
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildViewMarkdown(item: BacklogItem) {
  const blocks = STRUCTURED_SECTION_LABELS.map(([key, label]) => {
    const content = item.sections[key].trim();
    return content ? `## ${label}\n\n${content}` : "";
  }).filter(Boolean);

  return [`# ${item.title}`, ...blocks].join("\n\n");
}

function MetaListRow({
  label,
  value,
  multiline = false
}: {
  label: string;
  value: ReactNode;
  multiline?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid gap-2 border-b border-border/60 py-3 text-sm sm:grid-cols-[120px_minmax(0,1fr)]",
        multiline && "items-start"
      )}
    >
      <dt className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 text-foreground">{value}</dd>
    </div>
  );
}

export const ItemDetail = forwardRef<ItemDetailHandle, Props>(function ItemDetail(
  {
    open,
    item,
    loading,
    meta,
    relatedItems,
    navigableItems,
    selectedOutsideFilter,
    onClose,
    onSelectLink,
    onItemSync
  },
  ref
) {
  const [mode, setMode] = useState<DetailMode>("view");
  const [structuredDraft, setStructuredDraft] = useState<StructuredDraft | null>(
    null
  );
  const [rawDraft, setRawDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!item) {
      setStructuredDraft(null);
      setRawDraft("");
      return;
    }

    setMode("view");
    setStructuredDraft(toDraft(item));
    setRawDraft(item.rawMarkdown);
  }, [item?.id, item?.version]);

  const structuredDirty =
    !!item &&
    !!structuredDraft &&
    (structuredDraft.title !== item.title ||
      structuredDraft.status !== item.status ||
      structuredDraft.priority !== item.priority ||
      structuredDraft.assignee !== item.assignee ||
      structuredDraft.tagsText !== item.tags.join(", ") ||
      Object.entries(structuredDraft.sections).some(
        ([key, value]) => value !== item.sections[key as keyof Sections]
      ));

  const rawDirty = !!item && rawDraft !== item.rawMarkdown;
  const breadcrumb = item ? splitBreadcrumb(item.sourceSection) : [];
  const viewMarkdown = useMemo(
    () => (item ? buildViewMarkdown(item) : ""),
    [item]
  );
  const currentIndex = item
    ? navigableItems.findIndex((candidate) => candidate.id === item.id)
    : -1;
  const previousItem = currentIndex > 0 ? navigableItems[currentIndex - 1] : null;
  const nextItem =
    currentIndex >= 0 && currentIndex < navigableItems.length - 1
      ? navigableItems[currentIndex + 1]
      : null;
  const previousStatus = item
    ? getAdjacentCanonicalStatus(item.status, "previous")
    : null;
  const nextStatus = item ? getAdjacentCanonicalStatus(item.status, "next") : null;

  function resetDrafts() {
    if (!item) {
      return;
    }

    setStructuredDraft(toDraft(item));
    setRawDraft(item.rawMarkdown);
  }

  function confirmLeaveCurrentItem() {
    if (!structuredDirty && !rawDirty) {
      return true;
    }

    return window.confirm(
      "Hay cambios sin guardar en este requerimiento. Si continúas, se descartarán."
    );
  }

  function requestClose() {
    if (!confirmLeaveCurrentItem()) {
      return;
    }

    onClose();
  }

  function navigateToItem(id: string) {
    if (!confirmLeaveCurrentItem()) {
      return;
    }

    onSelectLink(id);
  }

  function leaveEditMode() {
    if (mode === "structured" && structuredDirty) {
      const confirmed = window.confirm(
        "Hay cambios estructurados sin guardar. Si sales del modo edición, se descartarán."
      );
      if (!confirmed) {
        return;
      }
    }

    if (mode === "advanced" && rawDirty) {
      const confirmed = window.confirm(
        "Hay cambios Markdown sin guardar. Si sales del modo edición, se descartarán."
      );
      if (!confirmed) {
        return;
      }
    }

    resetDrafts();
    setMode("view");
  }

  function openStructuredEditor() {
    if (!item) {
      return;
    }

    if (mode === "advanced" && rawDirty) {
      const confirmed = window.confirm(
        "Hay cambios Markdown sin guardar. Pasar a la edición estructurada va a descartarlos."
      );
      if (!confirmed) {
        return;
      }
      resetDrafts();
    }

    setMode("structured");
  }

  async function enterAdvancedMode() {
    if (!item) {
      return;
    }

    if (
      structuredDirty &&
      !window.confirm(
        "Hay cambios estructurados sin guardar. Cambiar a Markdown va a recargar el archivo actual y descartarlos."
      )
    ) {
      return;
    }

    setBusy(true);
    try {
      const fresh = await fetchItem(item.id);
      setRawDraft(fresh.rawMarkdown);
      setStructuredDraft(toDraft(fresh));
      setMode("advanced");
      await onItemSync(fresh);
    } catch (caughtError) {
      toast.error(
        caughtError instanceof Error
          ? caughtError.message
          : "No fue posible recargar el archivo actual."
      );
    } finally {
      setBusy(false);
    }
  }

  async function persistStructuredDraft(
    draft: StructuredDraft,
    successMessage: string,
    nextMode?: DetailMode
  ) {
    if (!item) {
      return;
    }

    setBusy(true);
    try {
      const updated = await saveStructuredItem(item.id, {
        version: draft.version,
        title: draft.title,
        status: draft.status,
        priority: draft.priority,
        assignee: draft.assignee,
        tags: normalizeTags(draft.tagsText),
        sections: draft.sections
      });
      setStructuredDraft(toDraft(updated));
      setRawDraft(updated.rawMarkdown);
      if (nextMode) {
        setMode(nextMode);
      }
      await onItemSync(updated);
      toast.success(successMessage);
    } catch (caughtError) {
      toast.error(
        caughtError instanceof Error
          ? caughtError.message
          : "No fue posible guardar los cambios estructurados."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleStructuredSave() {
    if (!item || !structuredDraft) {
      return;
    }

    await persistStructuredDraft(
      structuredDraft,
      "Cambios estructurados guardados en el archivo REQ.",
      "view"
    );
  }

  async function moveStatus(direction: "previous" | "next") {
    if (!item) {
      return;
    }

    if (mode === "advanced") {
      toast.error("Guarda o sal del modo Markdown antes de cambiar el estado de la historia.");
      return;
    }

    const target = direction === "previous" ? previousStatus?.id : nextStatus?.id;

    if (!target) {
      return;
    }

    const baseDraft = structuredDraft ?? toDraft(item);
    await persistStructuredDraft(
      {
        ...baseDraft,
        status: target
      },
      `Estado actualizado a ${getStatusLabel(target)}.`
    );
  }

  async function handleRawSave() {
    if (!item) {
      return;
    }

    setBusy(true);
    try {
      const updated = await saveRawItem(item.id, {
        version: item.version,
        rawMarkdown: rawDraft
      });
      setStructuredDraft(toDraft(updated));
      setRawDraft(updated.rawMarkdown);
      setMode("view");
      await onItemSync(updated);
      toast.success("Markdown guardado y reparseado correctamente.");
    } catch (caughtError) {
      toast.error(
        caughtError instanceof Error ? caughtError.message : "No fue posible guardar el Markdown."
      );
    } finally {
      setBusy(false);
    }
  }

  useImperativeHandle(
    ref,
    () => ({
      canLeaveCurrentItem: confirmLeaveCurrentItem,
      openStructuredEditor,
      requestClose,
      handleEscape() {
        if (mode === "view") {
          requestClose();
          return;
        }

        leaveEditMode();
      },
      moveStatus(direction) {
        void moveStatus(direction);
      }
    }),
    [mode, item, structuredDraft, rawDraft, structuredDirty, rawDirty, previousStatus, nextStatus]
  );

  return (
    <Drawer
      open={open}
      onClose={requestClose}
      title={item?.title ?? "Detalle del requerimiento"}
      description={
        item ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{item.id}</Badge>
            <Badge>{getStatusLabel(item.status)}</Badge>
            <Badge>{item.priority}</Badge>
            {selectedOutsideFilter ? (
              <Badge className="border-amber-500/25 bg-amber-500/12 text-amber-200">
                fuera del filtro actual
              </Badge>
            ) : null}
          </div>
        ) : (
          "Selecciona un requerimiento para abrirlo."
        )
      }
    >
      <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4 sm:px-6">
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border border-border/70 bg-background/80 p-1">
              <button
                type="button"
                onClick={() => {
                  if (mode === "view") {
                    return;
                  }

                  leaveEditMode();
                }}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  mode === "view"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                Vista
              </button>
              <button
                type="button"
                onClick={openStructuredEditor}
                disabled={!item}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  mode === "structured"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                Estructurado
              </button>
              <button
                type="button"
                onClick={() => void enterAdvancedMode()}
                disabled={!item}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  mode === "advanced"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                Markdown
              </button>
            </div>
            {mode === "advanced" ? (
              <p className="text-xs text-muted-foreground">
                El modo Markdown siempre recarga el archivo antes de editar.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!previousItem}
              onClick={() => previousItem && navigateToItem(previousItem.id)}
            >
              HU anterior
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!nextItem}
              onClick={() => nextItem && navigateToItem(nextItem.id)}
            >
              HU siguiente
            </Button>
            {currentIndex >= 0 ? (
              <span className="text-xs text-muted-foreground">
                {currentIndex + 1} de {navigableItems.length} en el contexto actual
              </span>
            ) : item ? (
              <span className="text-xs text-muted-foreground">
                Este requerimiento no está dentro del filtro activo.
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!previousStatus || busy}
              onClick={() => void moveStatus("previous")}
            >
              Estado anterior
            </Button>
            <Button
              size="sm"
              disabled={!nextStatus || busy}
              onClick={() => void moveStatus("next")}
            >
              Estado siguiente
            </Button>
            {item ? (
              <span className="text-xs text-muted-foreground">
                Flujo: {STATUS_COLUMNS.map((column) => getStatusLabel(column.id)).join(" / ")}
              </span>
            ) : null}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={requestClose}>
          Cerrar
        </Button>
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        {!item && loading ? (
          <div className="rounded-3xl border border-border/70 bg-background/40 px-6 py-16 text-center text-sm text-muted-foreground">
            Cargando detalle…
          </div>
        ) : null}

        {!item && !loading ? (
          <div className="rounded-3xl border border-border/70 bg-background/40 px-6 py-16 text-center">
            <p className="text-xl font-semibold text-foreground">
              Selecciona una historia
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              El drawer muestra la lectura completa del `REQ` y sus modos de edición.
            </p>
          </div>
        ) : null}

        {item ? (
          <>
            <dl className="rounded-[calc(var(--radius)+4px)] border border-border/70 bg-background/30 px-4 sm:px-5">
              <MetaListRow
                label="Responsable"
                value={item.assignee || "Sin responsable"}
              />
              <MetaListRow label="Creado" value={item.createdAt || "Sin fecha"} />
              <MetaListRow
                label="Ruta"
                value={
                  <code className="break-all rounded bg-slate-950/65 px-1.5 py-0.5 font-mono text-[0.92em] text-sky-100">
                    {item.path}
                  </code>
                }
              />
              <MetaListRow
                label="Tags"
                value={item.tags.length > 0 ? item.tags.join(", ") : "Sin tags"}
              />
            </dl>

            {breadcrumb.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {breadcrumb.map((part) => (
                  <span
                    key={part}
                    className="rounded-full border border-border/70 px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    {part}
                  </span>
                ))}
              </div>
            ) : null}

            {mode === "view" ? (
              <section className="rounded-[calc(var(--radius)+8px)] border border-border/70 bg-background/35 p-5">
                <MarkdownRenderer markdown={viewMarkdown} />
              </section>
            ) : null}

            {mode === "structured" && structuredDraft ? (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Título
                    </label>
                    <Input
                      value={structuredDraft.title}
                      onChange={(event) =>
                        setStructuredDraft({
                          ...structuredDraft,
                          title: event.target.value
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Estado
                    </label>
                    <select
                      value={structuredDraft.status}
                      onChange={(event) =>
                        setStructuredDraft({
                          ...structuredDraft,
                          status: event.target.value
                        })
                      }
                      className="h-10 w-full rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/80 px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
                    >
                      {Array.from(
                        new Set([
                          ...DEFAULT_STATUSES,
                          ...Object.keys(meta?.statuses ?? {}),
                          structuredDraft.status
                        ])
                      ).map((status) => (
                        <option key={status} value={status}>
                          {getStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Prioridad
                    </label>
                    <select
                      value={structuredDraft.priority}
                      onChange={(event) =>
                        setStructuredDraft({
                          ...structuredDraft,
                          priority: event.target.value
                        })
                      }
                      className="h-10 w-full rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/80 px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
                    >
                      {sortPriorityValues(
                        Array.from(
                          new Set([
                            ...DEFAULT_PRIORITY_OPTIONS,
                            ...Object.keys(meta?.priorities ?? {}),
                            structuredDraft.priority
                          ])
                        )
                      ).map((priority) => (
                        <option key={priority} value={priority}>
                          {priority}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Responsable
                    </label>
                    <Input
                      value={structuredDraft.assignee}
                      onChange={(event) =>
                        setStructuredDraft({
                          ...structuredDraft,
                          assignee: event.target.value
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Tags
                    </label>
                    <Input
                      value={structuredDraft.tagsText}
                      onChange={(event) =>
                        setStructuredDraft({
                          ...structuredDraft,
                          tagsText: event.target.value
                        })
                      }
                      placeholder="tag-uno, tag-dos"
                    />
                  </div>
                </div>

                {STRUCTURED_SECTION_LABELS.map(([key, label]) => (
                  <div key={key} className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {label}
                    </label>
                    <Textarea
                      value={structuredDraft.sections[key]}
                      onChange={(event) =>
                        setStructuredDraft({
                          ...structuredDraft,
                          sections: {
                            ...structuredDraft.sections,
                            [key]: event.target.value
                          }
                        })
                      }
                      className={key === "criterios" ? "min-h-44" : "min-h-28"}
                    />
                  </div>
                ))}

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    onClick={() => void handleStructuredSave()}
                    disabled={!structuredDirty || busy}
                  >
                    {busy ? "Guardando…" : "Guardar cambios"}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Guardado explícito. No hay autosave.
                  </span>
                </div>
              </div>
            ) : null}

            {mode === "advanced" ? (
              <div className="space-y-4">
                <Textarea
                  value={rawDraft}
                  onChange={(event) => setRawDraft(event.target.value)}
                  className="min-h-[32rem] font-mono text-xs leading-6"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={() => void handleRawSave()} disabled={!rawDirty || busy}>
                    {busy ? "Guardando…" : "Guardar Markdown"}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void enterAdvancedMode()}
                  >
                    Recargar desde disco
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/65 p-4">
                <h3 className="text-lg font-semibold text-foreground">
                  Historias relacionadas
                </h3>
                {item.links.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No hay relaciones internas registradas.
                  </p>
                ) : (
                  item.links.map((link) => {
                    const related = relatedItems[link.id];
                    return (
                      <button
                        key={link.raw}
                        type="button"
                        onClick={() => navigateToItem(link.id)}
                        className="flex w-full items-start justify-between gap-3 rounded-[calc(var(--radius)-6px)] border border-border/60 bg-card/60 px-3 py-3 text-left hover:bg-accent"
                      >
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {link.id}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {related?.title ?? "Abrir historia relacionada"}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">abrir</span>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="space-y-3 rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/65 p-4">
                <h3 className="text-lg font-semibold text-foreground">
                  Referencias locales
                </h3>
                {item.references.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No hay referencias locales registradas.
                  </p>
                ) : (
                  item.references.map((reference) => (
                    <a
                      key={`${reference.path}-${reference.sha ?? ""}`}
                      href={`/app-assets?path=${encodeURIComponent(reference.path)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-[calc(var(--radius)-6px)] border border-border/60 bg-card/60 px-3 py-3 hover:bg-accent"
                    >
                      <p className="text-sm font-semibold text-foreground">
                        {reference.path}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {reference.type ?? "file"}{" "}
                        {reference.sha ? `• ${reference.sha.slice(0, 12)}…` : ""}
                      </p>
                    </a>
                  ))
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </Drawer>
  );
});
